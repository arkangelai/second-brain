# AGENTS.md

## Purpose

Second Brain is a local-first, AI-native knowledge management CLI built around markdown files, hybrid search, and agent-assisted workflows.

## Stack

- Bun
- TypeScript
- CLI tooling
- Markdown vault

## Important Paths

- `bin/`: CLI entrypoints
- `src/`: implementation code
- `tools/`: helper tooling
- `vault/`: knowledge vault; see `vault/AGENTS.md` for vault-specific operating guidance

## Common Commands

- `bun install`
- `bun run dev`
- `bun test`
- `bun run typecheck`

## Agent Notes

- Preserve the local-first design and plain-text workflow.
- Be careful when changing CLI behavior because agent workflows may depend on stable commands.
- Keep changes compatible with markdown-based vault usage.
