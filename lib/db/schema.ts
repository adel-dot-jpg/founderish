// Shared contract (plan.md §3). Don't rename tables, columns or enum values without telling the team.
import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const factSource = pgEnum("fact_source", ["repo", "readme", "commit", "signup", "reply", "manual"]);
export const direction = pgEnum("direction", ["up", "down"]);
export const audienceStatus = pgEnum("audience_status", ["testing", "winner", "dropped"]);
export const contactStatus = pgEnum("contact_status", ["found", "drafted", "sent", "replied", "meeting", "dead"]);
export const draftKind = pgEnum("draft_kind", ["email", "followup", "reply", "post", "connect_note"]);
// checking = waiting on receipt.check; flagged = failed it and needs a human.
export const draftStatus = pgEnum("draft_status", ["checking", "flagged", "pending", "approved", "sent", "rejected"]);
export const messageDirection = pgEnum("message_direction", ["out", "in"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  repoUrl: text("repo_url").notNull(),
  description: text("description"),
  pitch: text("pitch"),
  ownerEmail: text("owner_email").notNull(),
  createdAt: createdAt(),
});

// The receipts: the only claims any output may make.
export const facts = pgTable("facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sourceType: factSource("source_type").notNull(),
  sourceUrl: text("source_url"),
  createdAt: createdAt(),
});

export type ApolloFilters = {
  person_titles?: string[];
  person_seniorities?: string[];
  person_locations?: string[];
  q_organization_domains_list?: string[];
  q_keywords?: string;
  per_page?: number;
};

// direction=down: candidate user niches. direction=up: the upward profile sets (founders, angels, ...).
export const audiences = pgTable("audiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  direction: direction("direction").notNull().default("down"),
  name: text("name").notNull(),
  description: text("description"),
  apolloFilters: jsonb("apollo_filters").$type<ApolloFilters>().notNull().default({}),
  status: audienceStatus("status").notNull().default("testing"),
  createdAt: createdAt(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    direction: direction("direction").notNull(),
    audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
    apolloId: text("apollo_id"),
    name: text("name").notNull(),
    title: text("title"),
    company: text("company"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    score: integer("score"),
    reason: text("reason"),
    status: contactStatus("status").notNull().default("found"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contacts_project_apollo_idx").on(t.projectId, t.apolloId)],
);

export const drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  kind: draftKind("kind").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  factIds: uuid("fact_ids").array().notNull().default(sql`'{}'::uuid[]`),
  status: draftStatus("status").notNull().default("checking"),
  briefNumber: integer("brief_number"),
  createdAt: createdAt(),
});

// Email log. contact_id is null for mail that isn't tied to a contact (e.g. the owner's brief replies).
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  direction: messageDirection("direction").notNull(),
  threadId: text("thread_id"),
  providerMessageId: text("provider_message_id").unique(), // Agentboxd message id, needed to reply in-thread
  subject: text("subject"),
  body: text("body"),
  classification: text("classification"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const links = pgTable("links", {
  token: text("token").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const signups = pgTable(
  "signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    linkToken: text("link_token").references(() => links.token, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("signups_project_email_idx").on(t.projectId, t.email)],
);

// Every trigger. Feeds the activity feed; project_id is null for events we can't tie to a project.
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export type Project = typeof projects.$inferSelect;
export type Fact = typeof facts.$inferSelect;
export type Audience = typeof audiences.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Event = typeof events.$inferSelect;
