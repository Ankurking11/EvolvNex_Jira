BEGIN;

-- A) project_members (idempotent)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_id_user_id_key
  ON public.project_members(project_id, user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_id_fkey'
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- B) tasks.due_date (if missing)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL;

-- C) comments table/columns/FKs (if missing)
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  author_id UUID NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- cleanse orphans before author FK
UPDATE public.comments c
SET author_id = NULL
WHERE author_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = c.author_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_task_id_fkey') THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.tasks(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_author_id_fkey') THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.users(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
