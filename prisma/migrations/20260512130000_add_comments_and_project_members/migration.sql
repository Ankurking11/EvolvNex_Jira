DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_members'
  ) THEN
    RETURN;
  END IF;

  EXECUTE '
    CREATE TABLE "project_members" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "project_id" UUID NOT NULL,
      "user_id" UUID NOT NULL,
      "role" TEXT NOT NULL DEFAULT ''MEMBER'',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
    )
  ';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    EXECUTE '
      ALTER TABLE "project_members"
      ADD CONSTRAINT "project_members_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Project') THEN
    EXECUTE '
      ALTER TABLE "project_members"
      ADD CONSTRAINT "project_members_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    EXECUTE '
      ALTER TABLE "project_members"
      ADD CONSTRAINT "project_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    EXECUTE '
      ALTER TABLE "project_members"
      ADD CONSTRAINT "project_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id")';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'comments'
  ) THEN
    RETURN;
  END IF;

  EXECUTE '
    CREATE TABLE "comments" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "content" TEXT NOT NULL,
      "task_id" UUID NOT NULL,
      "author_id" UUID NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
    )
  ';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    EXECUTE '
      ALTER TABLE "comments"
      ADD CONSTRAINT "comments_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Task') THEN
    EXECUTE '
      ALTER TABLE "comments"
      ADD CONSTRAINT "comments_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "Task"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    EXECUTE '
      ALTER TABLE "comments"
      ADD CONSTRAINT "comments_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    EXECUTE '
      ALTER TABLE "comments"
      ADD CONSTRAINT "comments_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_members'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'boards'
  ) THEN
    EXECUTE '
      INSERT INTO "project_members" ("project_id", "user_id", "role")
      SELECT DISTINCT b."project_id", t."assignee_id", ''MEMBER''
      FROM "tasks" t
      JOIN "boards" b ON b."id" = t."board_id"
      WHERE t."assignee_id" IS NOT NULL
      ON CONFLICT ("project_id", "user_id") DO NOTHING
    ';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Task'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Board'
  ) THEN
    EXECUTE '
      INSERT INTO "project_members" ("project_id", "user_id", "role")
      SELECT DISTINCT b."projectId", t."assigneeId", ''MEMBER''
      FROM "Task" t
      JOIN "Board" b ON b."id" = t."boardId"
      WHERE t."assigneeId" IS NOT NULL
      ON CONFLICT ("project_id", "user_id") DO NOTHING
    ';
  END IF;
END $$;
