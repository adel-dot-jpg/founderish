// Apollo adapter (plan.md §6). Header auth only; search is free, enrichment costs credits.
import type { ApolloFilters } from "./db/schema";
import { isDemoMode, sendAllowlist } from "./env";
import { SEED_PEOPLE } from "./apollo-seed";

const BASE = "https://api.apollo.io/api/v1";

export type PeopleFilters = ApolloFilters & { page?: number };

export interface ApolloPerson {
  apolloId: string;
  name: string;
  title: string | null;
  company: string | null;
  location?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

export class ApolloError extends Error {
  constructor(
    public status: number,
    public body: string,
    public hint: string,
  ) {
    super(`Apollo ${status}: ${hint}`);
  }
}

function hintFor(status: number, body: string): string {
  if (status === 401) return "bad or missing APOLLO_API_KEY";
  if (status === 403)
    return /master/i.test(body)
      ? "this endpoint needs a master API key (Apollo Settings > API > create a master key)"
      : "access denied: free accounts need a work-email registration for some endpoints, or the key lacks permission";
  if (status === 422) return "malformed request body";
  if (status === 429) return "rate limited";
  return "unexpected error";
}

async function apolloPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": process.env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new ApolloError(res.status, text, hintFor(res.status, text));
  return JSON.parse(text) as T;
}

type RawPerson = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  title?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  country?: string | null;
  organization?: { name?: string | null } | null;
};

function toPerson(p: RawPerson): ApolloPerson {
  const name = p.name || [p.first_name, p.last_name || p.last_name_obfuscated].filter(Boolean).join(" ");
  return {
    apolloId: p.id,
    name,
    title: p.title ?? null,
    company: p.organization?.name ?? null,
    location: [p.city, p.country].filter(Boolean).join(", ") || null,
    email: p.email ?? null,
    linkedinUrl: p.linkedin_url ?? null,
  };
}

// Free (0 credits), so it runs live even in DEMO_MODE. Returns no emails.
// Falls back to seed people when there's no key or Apollo errors, so the pipeline never blocks on it.
export async function searchPeople(filters: PeopleFilters): Promise<ApolloPerson[]> {
  const perPage = filters.per_page ?? 10;
  if (!process.env.APOLLO_API_KEY) return SEED_PEOPLE.slice(0, perPage);
  try {
    const data = await apolloPost<{ people?: RawPerson[] }>("/mixed_people/api_search", { ...filters, per_page: perPage });
    return (data.people ?? []).map(toPerson);
  } catch (err) {
    if (!isDemoMode()) throw err;
    console.warn("[apollo] search failed, using seed people:", err instanceof Error ? err.message : err);
    return SEED_PEOPLE.slice(0, perPage);
  }
}

// COSTS CREDITS. Up to 10 ids per call. In DEMO_MODE nobody is enriched: each id gets a SEND_ALLOWLIST
// address instead, so demo sends reach teammates, never the real person. { live: true } forces a real call.
export async function enrichPeople(ids: string[], opts: { live?: boolean } = {}): Promise<ApolloPerson[]> {
  if (ids.length === 0) return [];
  if (ids.length > 10) throw new Error("enrichPeople takes at most 10 ids per call");
  if (isDemoMode() && !opts.live) {
    const allow = sendAllowlist();
    return ids.map((id, i) => {
      const seed = SEED_PEOPLE.find((p) => p.apolloId === id);
      return {
        ...(seed ?? { apolloId: id, name: "", title: null, company: null }),
        email: allow.length ? allow[i % allow.length] : null,
        linkedinUrl: null,
      };
    });
  }
  const data = await apolloPost<{ matches?: (RawPerson | null)[] }>("/people/bulk_match", {
    details: ids.map((id) => ({ id })),
    reveal_personal_emails: false,
  });
  return (data.matches ?? []).filter((m): m is RawPerson => m != null).map(toPerson);
}

export async function enrichPerson(id: string, opts: { live?: boolean } = {}): Promise<ApolloPerson | null> {
  const [person] = await enrichPeople([id], opts);
  return person ?? null;
}
