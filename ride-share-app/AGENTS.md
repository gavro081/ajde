<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project database context

Read `supabase/DATABASE_MODELS.md` before changing database-backed features. It is the maintained
reference for the database models, relationships, constraints, and lifecycle behavior. Whenever a
migration changes the database model, update that document in the same change so future sessions
receive accurate schema context. Every database-model change must also regenerate and commit
`lib/supabase/database.types.ts` so the Supabase TypeScript types stay synchronized with the schema.
