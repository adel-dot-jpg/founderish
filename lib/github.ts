// GitHub adapter: repo profile for ingest + push-webhook verification.
import { createHmac, timingSafeEqual } from "node:crypto";
import { Octokit } from "@octokit/rest";

let client: Octokit | null = null;
const octokit = () => (client ??= new Octokit({ auth: process.env.GITHUB_TOKEN }));

// Accepts "owner/name" or any github.com URL.
export function parseRepo(input: string): { owner: string; repo: string } {
  const m = input
    .trim()
    .replace(/\.git$/, "")
    .match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)\/?$/);
  if (!m) throw new Error(`Not a GitHub repo: ${input}`);
  return { owner: m[1], repo: m[2] };
}

export interface RepoProfile {
  fullName: string;
  url: string;
  description: string | null;
  homepage: string | null;
  defaultBranch: string;
  stars: number;
  forks: number;
  topics: string[];
  createdAt: string;
  pushedAt: string | null;
  readme: string | null;
  languages: Record<string, number>;
  files: string[];
  commits: { sha: string; message: string; date: string | null; author: string | null; url: string }[];
}

export async function ingestRepo(input: string): Promise<RepoProfile> {
  const { owner, repo } = parseRepo(input);
  const gh = octokit();
  const { data: r } = await gh.repos.get({ owner, repo });

  const [readme, languages, commits, tree] = await Promise.all([
    gh.repos
      .getReadme({ owner, repo, mediaType: { format: "raw" } })
      .then((res) => res.data as unknown as string)
      .catch(() => null),
    gh.repos.listLanguages({ owner, repo }).then((res) => res.data),
    gh.repos.listCommits({ owner, repo, per_page: 50 }).then((res) => res.data),
    gh.git
      .getTree({ owner, repo, tree_sha: r.default_branch, recursive: "1" })
      .then((res) => res.data.tree)
      .catch(() => []),
  ]);

  return {
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    homepage: r.homepage ?? null,
    defaultBranch: r.default_branch,
    stars: r.stargazers_count,
    forks: r.forks_count,
    topics: r.topics ?? [],
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    readme,
    languages,
    files: tree.filter((t) => t.type === "blob" && t.path).map((t) => t.path!).slice(0, 400),
    commits: commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author?.date ?? null,
      author: c.author?.login ?? c.commit.author?.name ?? null,
      url: c.html_url,
    })),
  };
}

// Verifies X-Hub-Signature-256 against the raw request body.
export function verifyWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
