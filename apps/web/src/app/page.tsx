import { NoteKindSchema, type Note } from "@second-brain/shared";

import { Button } from "@/components/ui/button";

const sampleNote: Note = {
  id: "smoke-test",
  kind: "note",
  title: "Hello from @second-brain/shared",
  path: "01_thinking/hello.md",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ["smoke"],
};

const supportedKinds = NoteKindSchema.options;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Second Brain</h1>
        <p className="text-muted-foreground">
          Local-first, AI-native knowledge management.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-medium">Shared contracts smoke test</h2>
        <p className="text-sm text-muted-foreground">
          The web app and CLI both consume{" "}
          <code className="font-mono text-foreground">@second-brain/shared</code>.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Sample note title</dt>
          <dd>{sampleNote.title}</dd>
          <dt className="text-muted-foreground">Supported kinds</dt>
          <dd className="font-mono text-xs">{supportedKinds.join(", ")}</dd>
        </dl>
      </section>

      <div>
        <Button>Get started</Button>
      </div>
    </main>
  );
}
