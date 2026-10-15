-- Schema studio is created and owned by studio_migrator before this runs
-- (scripts/roles/10-create-roles.sql), so nothing here needs database-level rights.

-- CreateEnum
CREATE TYPE "workspace_status" AS ENUM ('active', 'read_only', 'deactivated');

-- CreateEnum
CREATE TYPE "content_mode" AS ENUM ('block', 'keyed');

-- CreateEnum
CREATE TYPE "request_type" AS ENUM ('change', 'new_page');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('draft', 'paused', 'submitted', 'building', 'checking', 'uat', 'live', 'pending_chi', 'closed');

-- CreateEnum
CREATE TYPE "close_reason" AS ENUM ('client_cancelled', 'no_reply', 'agent_closed');

-- CreateEnum
CREATE TYPE "chat_role" AS ENUM ('client', 'ba');

-- CreateEnum
CREATE TYPE "attachment_purpose" AS ENUM ('screenshot', 'sketch');

-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('pending', 'confirmed');

-- CreateEnum
CREATE TYPE "patch_status" AS ENUM ('draft', 'applied', 'rejected', 'reverted');

-- CreateEnum
CREATE TYPE "check_result" AS ENUM ('pass', 'fail');

-- CreateEnum
CREATE TYPE "ledger_kind" AS ENUM ('grant', 'topup', 'usage', 'adjust', 'refund');

-- CreateEnum
CREATE TYPE "credit_bucket" AS ENUM ('grant', 'topup');

-- CreateEnum
CREATE TYPE "topup_status" AS ENUM ('requested', 'paid', 'approved', 'cancelled');

-- CreateEnum
CREATE TYPE "budget_scope" AS ENUM ('month', 'request');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('reserved', 'settled', 'released');

-- CreateEnum
CREATE TYPE "agent_status" AS ENUM ('active', 'retired');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('queued', 'working', 'waiting', 'done');

-- CreateTable
CREATE TABLE "workspace" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "workspace_status" NOT NULL DEFAULT 'active',
    "grant_balance" INTEGER NOT NULL DEFAULT 0,
    "topup_balance" INTEGER NOT NULL DEFAULT 0,
    "credits_held" INTEGER NOT NULL DEFAULT 0,
    "monthly_grant" INTEGER NOT NULL DEFAULT 200,
    "ai_cap_micro_usd" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "domain" VARCHAR(253) NOT NULL,
    "repo_provider" VARCHAR(20) NOT NULL,
    "repo" VARCHAR(200) NOT NULL,
    "prod_branch" VARCHAR(100) NOT NULL,
    "dev_branch" VARCHAR(100) NOT NULL,
    "hosting" VARCHAR(40) NOT NULL,
    "hosting_project" VARCHAR(200) NOT NULL,
    "content_mode" "content_mode" NOT NULL,
    "languages" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_manifest" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "site_id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "commit_sha" VARCHAR(40) NOT NULL,
    "manifest" JSONB NOT NULL,
    "built_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_manifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "site_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" "request_type" NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'draft',
    "close_reason" "close_reason",
    "credits_price" INTEGER NOT NULL DEFAULT 0,
    "credits_held" INTEGER NOT NULL DEFAULT 0,
    "requirements_summary" TEXT,
    "branch" VARCHAR(200),
    "pr_url" TEXT,
    "preview_url" TEXT,
    "jira_key" VARCHAR(20),
    "layout_options" JSONB,
    "page_plan" JSONB,
    "signed_off_at" TIMESTAMPTZ(3),
    "uat_sent_at" TIMESTAMPTZ(3),
    "live_at" TIMESTAMPTZ(3),
    "remark" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "request_id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "from_status" "request_status",
    "to_status" "request_status" NOT NULL,
    "actor_account_id" VARCHAR(64),
    "actor_agent" VARCHAR(40),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "request_id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" "chat_role" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "request_id" UUID NOT NULL,
    "message_id" UUID,
    "purpose" "attachment_purpose" NOT NULL,
    "r2_key" VARCHAR(300) NOT NULL,
    "mime" VARCHAR(20) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "attachment_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patch" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "request_id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "base_commit" VARCHAR(40) NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "patch_status" NOT NULL DEFAULT 'draft',
    "merge_commit" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_run" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "request_id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "patch_id" UUID,
    "check" VARCHAR(40) NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "result" "check_result",
    "detail" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "check_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "kind" "ledger_kind" NOT NULL,
    "bucket" "credit_bucket" NOT NULL,
    "credits" INTEGER NOT NULL,
    "request_id" UUID,
    "topup_request_id" UUID,
    "period" VARCHAR(7),
    "idem_key" VARCHAR(120) NOT NULL,
    "created_by" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topup_request" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "pack" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount_sen" BIGINT NOT NULL,
    "status" "topup_status" NOT NULL DEFAULT 'requested',
    "billing_ref" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topup_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_budget" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "scope" "budget_scope" NOT NULL,
    "period" VARCHAR(7),
    "request_id" UUID,
    "cap_micro_usd" BIGINT NOT NULL,
    "spent_micro_usd" BIGINT NOT NULL DEFAULT 0,
    "reserved_micro_usd" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reservation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "budget_id" UUID NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "request_id" UUID,
    "agent" VARCHAR(40) NOT NULL,
    "amount_micro_usd" BIGINT NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'reserved',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "request_id" UUID,
    "reservation_id" UUID,
    "provider_message_id" VARCHAR(100) NOT NULL,
    "agent" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micro_usd" BIGINT NOT NULL,
    "cost_usd_exact" DECIMAL(20,10) NOT NULL,
    "price_snapshot" JSONB NOT NULL,
    "fx_rate" DECIMAL(12,6) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" VARCHAR(40) NOT NULL,
    "role" VARCHAR(80) NOT NULL,
    "skills" TEXT[],
    "tools" TEXT[],
    "model" VARCHAR(80) NOT NULL,
    "pipeline_step" VARCHAR(20) NOT NULL DEFAULT 'none',
    "status" "agent_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER NOT NULL,
    "agent_id" UUID NOT NULL,
    "request_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "public_label" VARCHAR(200) NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'queued',
    "is_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" VARCHAR(64),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" INTEGER,
    "actor_account_id" VARCHAR(64),
    "actor_agent" VARCHAR(40),
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_workspace_id_idx" ON "site"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_id_workspace_id_key" ON "site"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "site_manifest_site_id_built_at_idx" ON "site_manifest"("site_id", "built_at" DESC);

-- CreateIndex
CREATE INDEX "site_manifest_workspace_id_idx" ON "site_manifest"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_manifest_site_id_commit_sha_key" ON "site_manifest"("site_id", "commit_sha");

-- CreateIndex
CREATE INDEX "request_workspace_id_status_idx" ON "request"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "request_id_workspace_id_key" ON "request"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_workspace_id_number_key" ON "request"("workspace_id", "number");

-- CreateIndex
CREATE INDEX "request_event_request_id_created_at_idx" ON "request_event"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "request_event_workspace_id_idx" ON "request_event"("workspace_id");

-- CreateIndex
CREATE INDEX "chat_message_workspace_id_idx" ON "chat_message"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_id_workspace_id_key" ON "chat_message"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_request_id_seq_key" ON "chat_message"("request_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_r2_key_key" ON "attachment"("r2_key");

-- CreateIndex
CREATE INDEX "attachment_request_id_idx" ON "attachment"("request_id");

-- CreateIndex
CREATE INDEX "attachment_message_id_idx" ON "attachment"("message_id");

-- CreateIndex
CREATE INDEX "attachment_workspace_id_idx" ON "attachment"("workspace_id");

-- CreateIndex
CREATE INDEX "patch_request_id_idx" ON "patch"("request_id");

-- CreateIndex
CREATE INDEX "patch_workspace_id_idx" ON "patch"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "patch_id_workspace_id_key" ON "patch"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "check_run_patch_id_idx" ON "check_run"("patch_id");

-- CreateIndex
CREATE INDEX "check_run_workspace_id_idx" ON "check_run"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_run_request_id_patch_id_check_attempt_key" ON "check_run"("request_id", "patch_id", "check", "attempt");

-- CreateIndex
CREATE INDEX "credit_ledger_workspace_id_created_at_idx" ON "credit_ledger"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_ledger_request_id_idx" ON "credit_ledger"("request_id");

-- CreateIndex
CREATE INDEX "credit_ledger_topup_request_id_idx" ON "credit_ledger"("topup_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_workspace_id_idem_key_key" ON "credit_ledger"("workspace_id", "idem_key");

-- CreateIndex
CREATE UNIQUE INDEX "topup_request_billing_ref_key" ON "topup_request"("billing_ref");

-- CreateIndex
CREATE INDEX "topup_request_workspace_id_idx" ON "topup_request"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "topup_request_id_workspace_id_key" ON "topup_request"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "ai_budget_workspace_id_idx" ON "ai_budget"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_budget_id_workspace_id_key" ON "ai_budget"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "ai_reservation_request_id_idx" ON "ai_reservation"("request_id");

-- CreateIndex
CREATE INDEX "ai_reservation_workspace_id_idx" ON "ai_reservation"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reservation_id_workspace_id_key" ON "ai_reservation"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_provider_message_id_key" ON "ai_usage"("provider_message_id");

-- CreateIndex
CREATE INDEX "ai_usage_workspace_id_created_at_idx" ON "ai_usage"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_request_id_idx" ON "ai_usage"("request_id");

-- CreateIndex
CREATE INDEX "ai_usage_reservation_id_idx" ON "ai_usage"("reservation_id");

-- CreateIndex
CREATE INDEX "task_workspace_id_status_idx" ON "task"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "task_agent_id_idx" ON "task"("agent_id");

-- CreateIndex
CREATE INDEX "task_request_id_idx" ON "task"("request_id");

-- CreateIndex
CREATE INDEX "audit_log_workspace_id_created_at_idx" ON "audit_log"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_manifest" ADD CONSTRAINT "site_manifest_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_manifest" ADD CONSTRAINT "site_manifest_site_id_workspace_id_fkey" FOREIGN KEY ("site_id", "workspace_id") REFERENCES "site"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_site_id_workspace_id_fkey" FOREIGN KEY ("site_id", "workspace_id") REFERENCES "site"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_event" ADD CONSTRAINT "request_event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_event" ADD CONSTRAINT "request_event_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_message_id_workspace_id_fkey" FOREIGN KEY ("message_id", "workspace_id") REFERENCES "chat_message"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch" ADD CONSTRAINT "patch_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch" ADD CONSTRAINT "patch_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_run" ADD CONSTRAINT "check_run_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_run" ADD CONSTRAINT "check_run_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_run" ADD CONSTRAINT "check_run_patch_id_workspace_id_fkey" FOREIGN KEY ("patch_id", "workspace_id") REFERENCES "patch"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_topup_request_id_workspace_id_fkey" FOREIGN KEY ("topup_request_id", "workspace_id") REFERENCES "topup_request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topup_request" ADD CONSTRAINT "topup_request_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reservation" ADD CONSTRAINT "ai_reservation_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reservation" ADD CONSTRAINT "ai_reservation_budget_id_workspace_id_fkey" FOREIGN KEY ("budget_id", "workspace_id") REFERENCES "ai_budget"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reservation" ADD CONSTRAINT "ai_reservation_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_reservation_id_workspace_id_fkey" FOREIGN KEY ("reservation_id", "workspace_id") REFERENCES "ai_reservation"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_request_id_workspace_id_fkey" FOREIGN KEY ("request_id", "workspace_id") REFERENCES "request"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written below this line: what Prisma's schema cannot express.
-- `prisma migrate dev` does not know these exist and will offer to drop the
-- partial indexes in a later migration. Remove those DROP lines; keep these.
-- ---------------------------------------------------------------------------

-- CHECKs ---------------------------------------------------------------------

-- Credits: balances never negative, and holds always covered.
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_balances_check" CHECK (
  "grant_balance" >= 0 AND "topup_balance" >= 0 AND "credits_held" >= 0
  AND "credits_held" <= "grant_balance" + "topup_balance"
);
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_ai_cap_check" CHECK ("ai_cap_micro_usd" >= 0);

-- close_reason is set exactly when the request is closed.
ALTER TABLE "request" ADD CONSTRAINT "request_close_reason_check" CHECK (("status" = 'closed') = ("close_reason" IS NOT NULL));
ALTER TABLE "request" ADD CONSTRAINT "request_credits_check" CHECK ("credits_held" >= 0 AND "credits_price" >= 0);
ALTER TABLE "request" ADD CONSTRAINT "request_number_check" CHECK ("number" > 0);

-- Exactly one actor: a person (auth account) or an agent.
ALTER TABLE "request_event" ADD CONSTRAINT "request_event_actor_check" CHECK (num_nonnulls("actor_account_id", "actor_agent") = 1);
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_check" CHECK (num_nonnulls("actor_account_id", "actor_agent") = 1);

ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_seq_check" CHECK ("seq" > 0);

-- At most 5 MB, PNG, JPG or WebP (the API checks too; this is the floor).
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_file_check" CHECK (
  "bytes" > 0 AND "bytes" <= 5242880 AND "mime" IN ('image/png', 'image/jpeg', 'image/webp')
);

-- Check names grow over time: text, but shaped.
ALTER TABLE "check_run" ADD CONSTRAINT "check_run_check_name_check" CHECK ("check" ~ '^[a-z][a-z0-9_]*$');
ALTER TABLE "check_run" ADD CONSTRAINT "check_run_attempt_check" CHECK ("attempt" >= 1);

ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_credits_check" CHECK ("credits" <> 0);
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_period_check" CHECK ("period" IS NULL OR "period" ~ '^\d{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "topup_request" ADD CONSTRAINT "topup_request_amounts_check" CHECK ("pack" > 0 AND "credits" > 0 AND "amount_sen" > 0);

-- A month budget has a period and no request; a request budget the reverse.
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_scope_check" CHECK (
  ("scope" = 'month' AND "period" IS NOT NULL AND "request_id" IS NULL)
  OR ("scope" = 'request' AND "period" IS NULL AND "request_id" IS NOT NULL)
);
ALTER TABLE "ai_budget" ADD CONSTRAINT "ai_budget_amounts_check" CHECK (
  "cap_micro_usd" >= 0 AND "spent_micro_usd" >= 0 AND "reserved_micro_usd" >= 0
);
ALTER TABLE "ai_reservation" ADD CONSTRAINT "ai_reservation_amount_check" CHECK ("amount_micro_usd" >= 0);
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_amounts_check" CHECK (
  "cost_micro_usd" >= 0 AND "input_tokens" >= 0 AND "output_tokens" >= 0
  AND "cache_read_tokens" >= 0 AND "cache_write_tokens" >= 0
);

ALTER TABLE "agent" ADD CONSTRAINT "agent_pipeline_step_check" CHECK ("pipeline_step" IN ('ba', 'dev', 'qa', 'review', 'none'));

-- Partial unique indexes -------------------------------------------------------

-- Soft-deleted config rows free their name again.
CREATE UNIQUE INDEX "site_domain_live_key" ON "site" ("domain") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "agent_name_live_key" ON "agent" ("name") WHERE "deleted_at" IS NULL;

-- One month budget per workspace per period; one budget per request.
CREATE UNIQUE INDEX "ai_budget_month_key" ON "ai_budget" ("workspace_id", "period") WHERE "scope" = 'month';
CREATE UNIQUE INDEX "ai_budget_request_key" ON "ai_budget" ("request_id") WHERE "scope" = 'request';

-- One working task per agent at a time.
CREATE UNIQUE INDEX "task_one_working_per_agent_key" ON "task" ("agent_id") WHERE "status" = 'working';

-- Partial indexes ----------------------------------------------------------------

-- The 7-day UAT rule.
CREATE INDEX "request_uat_sent_at_idx" ON "request" ("uat_sent_at") WHERE "status" = 'uat';
-- The next reserve releases expired holds on this budget.
CREATE INDEX "ai_reservation_open_idx" ON "ai_reservation" ("budget_id") WHERE "status" = 'reserved';
-- Unsent uploads, for the 24-hour cleanup.
CREATE INDEX "attachment_pending_idx" ON "attachment" ("created_at") WHERE "status" = 'pending';

-- Grants to the API's role ---------------------------------------------------------
--
-- studio_app runs the API. It reads and writes the studio schema, but the four
-- append-only tables refuse it UPDATE and DELETE. Skipped where the role does
-- not exist yet (scripts/roles/README.md creates it); re-run
-- scripts/roles/20-grants.sql after creating it there.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'studio_app') THEN
    GRANT USAGE ON SCHEMA "studio" TO studio_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "studio" TO studio_app;
    REVOKE UPDATE, DELETE ON "credit_ledger", "request_event", "ai_usage", "audit_log" FROM studio_app;
    REVOKE ALL ON "_prisma_migrations" FROM studio_app;
  END IF;
END $$;
