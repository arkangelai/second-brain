import { z } from "zod";

export const NoteFrontmatterSchema = z
  .object({
    created_by: z.string().min(1),
    created_at: z.string().datetime(),
    tags: z.array(z.string().min(1)).optional(),
    lock: z.boolean().optional(),
    source_url: z.string().url().optional(),
    wiki_links: z.array(z.string().min(1)).optional(),
    append_sections: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type NoteFrontmatter = z.infer<typeof NoteFrontmatterSchema>;

export const NoteActorTypeSchema = z.enum(["human", "agent", "system"]);
export type NoteActorType = z.infer<typeof NoteActorTypeSchema>;

export const NoteRevisionOpSchema = z.enum([
  "create",
  "edit",
  "append",
  "link",
  "archive",
  "restore",
]);
export type NoteRevisionOp = z.infer<typeof NoteRevisionOpSchema>;

export const NoteRecordSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  folder: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  frontmatter: NoteFrontmatterSchema,
  version: z.number().int().positive(),
  created_by: z.string().uuid().nullable(),
  created_by_type: z.enum(["human", "agent"]),
  updated_by: z.string().uuid().nullable(),
  updated_by_type: z.enum(["human", "agent"]),
  archived_at: z.string().datetime().nullable(),
  archived_reason: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type NoteRecord = z.infer<typeof NoteRecordSchema>;

export const NoteRevisionSchema = z.object({
  id: z.string().uuid(),
  note_id: z.string().uuid(),
  version: z.number().int().positive(),
  op_type: NoteRevisionOpSchema,
  author_id: z.string().uuid().nullable(),
  author_type: NoteActorTypeSchema,
  before_body: z.string().nullable().optional(),
  after_body: z.string().nullable().optional(),
  summary: z.string().nullable(),
  diff_preview: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type NoteRevision = z.infer<typeof NoteRevisionSchema>;

export const NoteLinkSchema = z.object({
  source_slug: z.string().min(1),
  target_slug: z.string().min(1),
  exists: z.boolean(),
});
export type NoteLink = z.infer<typeof NoteLinkSchema>;

export const NoteWithLinksResponseSchema = z.object({
  note: NoteRecordSchema,
  links_in: z.array(NoteLinkSchema),
  links_out: z.array(NoteLinkSchema),
  last_revisions: z.array(NoteRevisionSchema),
});
export type NoteWithLinksResponse = z.infer<typeof NoteWithLinksResponseSchema>;

export const NoteRevisionsResponseSchema = z.object({
  revisions: z.array(NoteRevisionSchema),
  next_before: z.string().datetime().nullable(),
});
export type NoteRevisionsResponse = z.infer<typeof NoteRevisionsResponseSchema>;

export const ListNotesResponseSchema = z.object({
  notes: z.array(NoteRecordSchema),
  next_updated_before: z.string().datetime().nullable(),
});
export type ListNotesResponse = z.infer<typeof ListNotesResponseSchema>;

export const CreateNoteRequestSchema = z.object({
  slug: z.string().min(1).optional(),
  folder: z.string().min(1).optional(),
  title: z.string().min(1),
  body: z.string().default(""),
  frontmatter: NoteFrontmatterSchema.partial().default({}),
});
export type CreateNoteRequest = z.infer<typeof CreateNoteRequestSchema>;

export const PatchNoteRequestSchema = z
  .object({
    if_version: z.number().int().positive(),
    body: z.string().optional(),
    title: z.string().min(1).optional(),
    folder: z.string().min(1).optional(),
    frontmatter_patch: NoteFrontmatterSchema.partial().optional(),
  })
  .refine(
    (value) =>
      value.body !== undefined ||
      value.title !== undefined ||
      value.folder !== undefined ||
      value.frontmatter_patch !== undefined,
    "At least one patch field is required",
  );
export type PatchNoteRequest = z.infer<typeof PatchNoteRequestSchema>;

export const AppendNoteRequestSchema = z.object({
  section: z.string().min(1),
  text: z.string().min(1),
  wiki_links: z.array(z.string().min(1)).optional(),
});
export type AppendNoteRequest = z.infer<typeof AppendNoteRequestSchema>;

export const LinkNoteRequestSchema = z.object({
  target_slug: z.string().min(1),
  context_phrase: z.string().min(1).optional(),
});
export type LinkNoteRequest = z.infer<typeof LinkNoteRequestSchema>;

export const ArchiveNoteRequestSchema = z.object({
  reason: z.string().min(10),
});
export type ArchiveNoteRequest = z.infer<typeof ArchiveNoteRequestSchema>;
