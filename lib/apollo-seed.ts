// Fictional people returned by lib/apollo.ts in DEMO_MODE so development never spends credits.
// Enriched seed emails are mapped onto SEND_ALLOWLIST so demo sends reach teammates.
import type { ApolloPerson } from "./apollo";

export const SEED_PEOPLE: ApolloPerson[] = [
  { apolloId: "seed-01", name: "Maya Okafor", title: "Founder & CEO", company: "Shipwright Labs", location: "Toronto, Canada" },
  { apolloId: "seed-02", name: "Daniel Reyes", title: "Angel Investor", company: "Independent", location: "Toronto, Canada" },
  { apolloId: "seed-03", name: "Priya Natarajan", title: "Venture Scout", company: "Northbound Ventures", location: "Toronto, Canada" },
  { apolloId: "seed-04", name: "Tom Lindqvist", title: "Program Manager", company: "Lakeshore Accelerator", location: "Toronto, Canada" },
  { apolloId: "seed-05", name: "Aisha Rahman", title: "VP Engineering", company: "Pallet Systems", location: "Waterloo, Canada" },
  { apolloId: "seed-06", name: "Ben Carter", title: "Developer Community Lead", company: "DevTO Collective", location: "Toronto, Canada" },
  { apolloId: "seed-07", name: "Sofia Marchetti", title: "Engineering Manager", company: "Quillstack", location: "Toronto, Canada" },
  { apolloId: "seed-08", name: "Kenji Watanabe", title: "Senior Software Engineer", company: "Harbourline", location: "Toronto, Canada" },
  { apolloId: "seed-09", name: "Lena Fischer", title: "Head of Developer Experience", company: "Brightfold", location: "Montreal, Canada" },
  { apolloId: "seed-10", name: "Marcus Bell", title: "CTO", company: "Tinroof Analytics", location: "Toronto, Canada" },
  { apolloId: "seed-11", name: "Grace Liu", title: "Product Manager", company: "Cobalt Health", location: "Toronto, Canada" },
  { apolloId: "seed-12", name: "Omar Haddad", title: "Founder", company: "Patchwork AI", location: "Toronto, Canada" },
];
