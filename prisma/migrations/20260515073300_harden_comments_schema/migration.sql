CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  author_id UUID NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep add-column guards for partially-applied environments where table exists but columns are missing.
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS task_id UUID,
  ADD COLUMN IF NOT EXISTS author_id UUID,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.comments
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE public.comments
  ALTER COLUMN id TYPE UUID USING (
    CASE
      WHEN id IS NULL THEN gen_random_uuid()
      WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::text::uuid
      ELSE gen_random_uuid()
    END
  );

ALTER TABLE public.comments
  ALTER COLUMN task_id TYPE UUID USING (
    CASE
      WHEN task_id IS NULL THEN NULL
      WHEN task_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN task_id::text::uuid
      ELSE NULL
    END
  );

ALTER TABLE public.comments
  ALTER COLUMN author_id TYPE UUID USING (
    CASE
      WHEN author_id IS NULL THEN NULL
      WHEN author_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN author_id::text::uuid
      ELSE NULL
    END
  );

DO $$
DECLARE
  invalid_task_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_task_count
  FROM public.comments
  WHERE task_id IS NULL;

  IF invalid_task_count > 0 THEN
    RAISE EXCEPTION 'comments migration aborted: found % row(s) with null/invalid task_id. Resolve data manually before retrying.', invalid_task_count
      USING HINT = 'Inspect rows with: SELECT id, task_id, author_id, created_at FROM public.comments WHERE task_id IS NULL LIMIT 50;';
  END IF;
END $$;

UPDATE public.comments
SET content = ''
WHERE content IS NULL;

UPDATE public.comments
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE public.comments
SET created_at = NOW()
WHERE created_at IS NULL;

ALTER TABLE public.comments
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN task_id SET NOT NULL,
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_pkey'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_task_id_fkey'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.tasks(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_author_id_fkey'
  ) THEN
    UPDATE public.comments c
    SET author_id = NULL
    WHERE author_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = c.author_id
      );

    ALTER TABLE public.comments
      ADD CONSTRAINT comments_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.users(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
