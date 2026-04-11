---
name: create-migration
description: Scaffold a new Supabase migration file for the grant-researcher project and apply it via db:push. Use when the user wants to add columns, create tables, or modify the DB schema.
user-invocable: true
---

Help the user create and apply a Supabase migration.

## Steps

1. Ask what schema change is needed (if not already described).

2. Find the latest migration number:
```bash
ls db/migrations/ | sort | tail -5
```

3. Scaffold a new migration file at `db/migrations/<timestamp>_<name>.sql` using the naming convention from existing files.

4. Write the SQL — follow these patterns from the codebase:
   - Use `IF NOT EXISTS` for CREATE TABLE/INDEX
   - Add RLS policies if creating a table that stores user data
   - Match the column types used in `db/src/types.ts`

5. Show the SQL to the user and confirm before applying.

6. Apply with:
```bash
npm run db:push -w db
```

7. Remind the user to update `db/src/types.ts` if new columns were added.
