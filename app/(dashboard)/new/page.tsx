import { NewProjectForm } from "./new-project-form";

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="text-sm text-zinc-400">
          Link a repo you own. founder(ish) reads it, writes down the receipts, picks audiences to test, finds people and drafts outreach for your approval.
        </p>
      </div>
      <NewProjectForm />
    </main>
  );
}
