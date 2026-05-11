import { z } from "zod";

export const NoteKindSchema = z.enum([
  "note",
  "moc",
  "book",
  "pipeline-post",
]);
export type NoteKind = z.infer<typeof NoteKindSchema>;

export const NoteSchema = z.object({
  id: z.string().min(1),
  kind: NoteKindSchema,
  title: z.string().min(1),
  path: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()).default([]),
});
export type Note = z.infer<typeof NoteSchema>;
