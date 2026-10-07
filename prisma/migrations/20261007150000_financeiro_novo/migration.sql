-- Financeiro novo (portado de Financeiro/prisma/migrations). Só cria tabelas fin_*: nenhuma
-- tabela existente do CRM (inclusive financeiro_* de Caixa e Carros) é alterada.

-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'WALLET', 'INVESTMENT', 'BENEFIT', 'OTHER');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "IncomeClass" AS ENUM ('BASE', 'COMMISSION', 'EXTRA', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseNature" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'REFUND', 'TRANSFER', 'CARD_PAYMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SETTLED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BOLETO', 'BANK_TRANSFER', 'AUTO_DEBIT', 'CASH', 'BENEFIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurrenceDayRule" AS ENUM ('FIXED_DAY', 'NTH_BUSINESS_DAY', 'LAST_BUSINESS_DAY');

-- CreateEnum
CREATE TYPE "BusinessDayShift" AS ENUM ('NONE', 'NEXT', 'PREVIOUS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "InstallmentPlanStatus" AS ENUM ('ACTIVE', 'FINISHED', 'SETTLED_EARLY', 'CANCELED');

-- CreateEnum
CREATE TYPE "GoalKind" AS ENUM ('EMERGENCY_FUND', 'SAVINGS', 'PURCHASE', 'INVESTMENT', 'DEBT_PAYOFF', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ACHIEVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('INVESTMENT', 'EQUIPMENT', 'VEHICLE', 'REAL_ESTATE', 'OTHER');

-- CreateEnum
CREATE TYPE "LiabilityKind" AS ENUM ('LOAN', 'FINANCING', 'PERSONAL_DEBT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('INFO', 'ATTENTION', 'IMPORTANT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SnapshotPeriod" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('CSV', 'XLSX', 'OFX', 'OPEN_FINANCE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('DRAFT', 'COMMITTED', 'ROLLED_BACK', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "fin_workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "WorkspaceKind" NOT NULL DEFAULT 'PERSONAL',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "base_currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_workspace_members" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_accounts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "institution" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "initial_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "initial_balance_date" DATE NOT NULL,
    "is_liquid" BOOLEAN NOT NULL DEFAULT true,
    "include_in_net_worth" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(7),
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_categories" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "parent_id" UUID,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "income_class" "IncomeClass",
    "default_nature" "ExpenseNature",
    "is_essential" BOOLEAN NOT NULL DEFAULT false,
    "system_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_transactions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "settled_at" DATE,
    "account_id" UUID,
    "transfer_account_id" UUID,
    "credit_card_id" UUID,
    "invoice_id" UUID,
    "category_id" UUID,
    "nature" "ExpenseNature",
    "payment_method" "PaymentMethod",
    "recurrence_id" UUID,
    "recurrence_date" DATE,
    "is_recurrence_override" BOOLEAN NOT NULL DEFAULT false,
    "installment_plan_id" UUID,
    "installment_number" INTEGER,
    "refund_of_id" UUID,
    "is_balance_adjustment" BOOLEAN NOT NULL DEFAULT false,
    "import_batch_id" UUID,
    "external_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_recurrences" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "is_estimated_amount" BOOLEAN NOT NULL DEFAULT false,
    "category_id" UUID,
    "account_id" UUID,
    "credit_card_id" UUID,
    "payment_method" "PaymentMethod",
    "nature" "ExpenseNature",
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "day_rule" "RecurrenceDayRule" NOT NULL DEFAULT 'FIXED_DAY',
    "day_of_month" INTEGER,
    "weekday" INTEGER,
    "month_of_year" INTEGER,
    "non_business_day_shift" "BusinessDayShift" NOT NULL DEFAULT 'NONE',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "max_occurrences" INTEGER,
    "generated_until" DATE,
    "paused_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_subscriptions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "recurrence_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "website" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" DATE,
    "trial_ends_at" DATE,
    "canceled_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_commissions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "client_name" TEXT NOT NULL,
    "sale_description" TEXT NOT NULL,
    "sale_amount" DECIMAL(14,2) NOT NULL,
    "rate_percent" DECIMAL(7,4) NOT NULL,
    "is_amount_overridden" BOOLEAN NOT NULL DEFAULT false,
    "sale_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_credit_cards" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL,
    "last_four" CHAR(4),
    "credit_limit" DECIMAL(14,2) NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "payment_account_id" UUID,
    "color" VARCHAR(7),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_credit_card_invoices" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "credit_card_id" UUID NOT NULL,
    "reference_month" DATE NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "statement_amount" DECIMAL(14,2),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_credit_card_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_installment_plans" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT,
    "category_id" UUID,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "cash_price" DECIMAL(14,2),
    "installment_count" INTEGER NOT NULL,
    "prior_paid_count" INTEGER NOT NULL DEFAULT 0,
    "purchase_date" DATE NOT NULL,
    "first_due_date" DATE NOT NULL,
    "credit_card_id" UUID,
    "account_id" UUID,
    "payment_method" "PaymentMethod",
    "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_budgets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "alert_threshold_percent" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_goals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GoalKind" NOT NULL,
    "target_amount" DECIMAL(14,2) NOT NULL,
    "initial_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "target_date" DATE,
    "linked_account_id" UUID,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "achieved_at" DATE,
    "icon" TEXT,
    "color" VARCHAR(7),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_goal_contributions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "transaction_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_assets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "acquisition_date" DATE,
    "acquisition_value" DECIMAL(14,2),
    "current_value" DECIMAL(14,2) NOT NULL,
    "valued_at" DATE NOT NULL,
    "installment_plan_id" UUID,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_valuations" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_asset_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_liabilities" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LiabilityKind" NOT NULL,
    "creditor" TEXT,
    "original_amount" DECIMAL(14,2) NOT NULL,
    "current_balance" DECIMAL(14,2),
    "balance_updated_at" DATE,
    "monthly_interest_rate" DECIMAL(7,4),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "installment_plan_id" UUID,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fin_liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_financial_snapshots" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "period" "SnapshotPeriod" NOT NULL,
    "date" DATE NOT NULL,
    "liquid_balance" DECIMAL(14,2) NOT NULL,
    "invested_balance" DECIMAL(14,2) NOT NULL,
    "total_assets" DECIMAL(14,2) NOT NULL,
    "total_liabilities" DECIMAL(14,2) NOT NULL,
    "net_worth" DECIMAL(14,2) NOT NULL,
    "income_total" DECIMAL(14,2) NOT NULL,
    "expense_total" DECIMAL(14,2) NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_financial_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_attachments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "transaction_id" UUID,
    "installment_plan_id" UUID,
    "commission_id" UUID,
    "invoice_id" UUID,
    "asset_id" UUID,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_notifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" TEXT,
    "code" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "dismissed_at" TIMESTAMPTZ(3),
    "snoozed_until" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_import_batches" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "source" "ImportSource" NOT NULL,
    "file_name" TEXT,
    "account_id" UUID,
    "credit_card_id" UUID,
    "status" "ImportStatus" NOT NULL DEFAULT 'DRAFT',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_audit_logs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_job_runs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "run_key" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "details" JSONB,

    CONSTRAINT "fin_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_month_closes" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "closed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by_id" TEXT,
    "notes" TEXT,
    "summary" JSONB NOT NULL,

    CONSTRAINT "fin_month_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fin_workspaces_slug_key" ON "fin_workspaces"("slug");

-- CreateIndex
CREATE INDEX "fin_workspace_members_user_id_idx" ON "fin_workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_workspace_members_workspace_id_user_id_key" ON "fin_workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_accounts_workspace_id_name_key" ON "fin_accounts"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "fin_categories_workspace_id_kind_sort_order_idx" ON "fin_categories"("workspace_id", "kind", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "fin_categories_workspace_id_system_key_key" ON "fin_categories"("workspace_id", "system_key");

-- CreateIndex
CREATE INDEX "fin_transactions_workspace_id_due_date_idx" ON "fin_transactions"("workspace_id", "due_date");

-- CreateIndex
CREATE INDEX "fin_transactions_workspace_id_date_idx" ON "fin_transactions"("workspace_id", "date");

-- CreateIndex
CREATE INDEX "fin_transactions_workspace_id_status_due_date_idx" ON "fin_transactions"("workspace_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "fin_transactions_workspace_id_category_id_date_idx" ON "fin_transactions"("workspace_id", "category_id", "date");

-- CreateIndex
CREATE INDEX "fin_transactions_account_id_settled_at_idx" ON "fin_transactions"("account_id", "settled_at");

-- CreateIndex
CREATE INDEX "fin_transactions_credit_card_id_due_date_idx" ON "fin_transactions"("credit_card_id", "due_date");

-- CreateIndex
CREATE INDEX "fin_transactions_invoice_id_idx" ON "fin_transactions"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_transactions_recurrence_id_recurrence_date_key" ON "fin_transactions"("recurrence_id", "recurrence_date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_transactions_installment_plan_id_installment_number_key" ON "fin_transactions"("installment_plan_id", "installment_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_transactions_account_id_external_id_key" ON "fin_transactions"("account_id", "external_id");

-- CreateIndex
CREATE INDEX "fin_recurrences_workspace_id_type_idx" ON "fin_recurrences"("workspace_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "fin_subscriptions_recurrence_id_key" ON "fin_subscriptions"("recurrence_id");

-- CreateIndex
CREATE INDEX "fin_subscriptions_workspace_id_status_idx" ON "fin_subscriptions"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fin_commissions_transaction_id_key" ON "fin_commissions"("transaction_id");

-- CreateIndex
CREATE INDEX "fin_commissions_workspace_id_sale_date_idx" ON "fin_commissions"("workspace_id", "sale_date");

-- CreateIndex
CREATE INDEX "fin_commissions_workspace_id_client_name_idx" ON "fin_commissions"("workspace_id", "client_name");

-- CreateIndex
CREATE UNIQUE INDEX "fin_credit_cards_workspace_id_name_key" ON "fin_credit_cards"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "fin_credit_card_invoices_workspace_id_due_date_idx" ON "fin_credit_card_invoices"("workspace_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_credit_card_invoices_credit_card_id_reference_month_key" ON "fin_credit_card_invoices"("credit_card_id", "reference_month");

-- CreateIndex
CREATE INDEX "fin_installment_plans_workspace_id_status_idx" ON "fin_installment_plans"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "fin_budgets_workspace_id_idx" ON "fin_budgets"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_budgets_category_id_effective_from_key" ON "fin_budgets"("category_id", "effective_from");

-- CreateIndex
CREATE INDEX "fin_goals_workspace_id_status_idx" ON "fin_goals"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fin_goal_contributions_transaction_id_key" ON "fin_goal_contributions"("transaction_id");

-- CreateIndex
CREATE INDEX "fin_goal_contributions_goal_id_date_idx" ON "fin_goal_contributions"("goal_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_assets_installment_plan_id_key" ON "fin_assets"("installment_plan_id");

-- CreateIndex
CREATE INDEX "fin_assets_workspace_id_kind_idx" ON "fin_assets"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "fin_asset_valuations_asset_id_date_key" ON "fin_asset_valuations"("asset_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_liabilities_installment_plan_id_key" ON "fin_liabilities"("installment_plan_id");

-- CreateIndex
CREATE INDEX "fin_liabilities_workspace_id_kind_idx" ON "fin_liabilities"("workspace_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "fin_financial_snapshots_workspace_id_period_date_key" ON "fin_financial_snapshots"("workspace_id", "period", "date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_attachments_storage_key_key" ON "fin_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "fin_attachments_transaction_id_idx" ON "fin_attachments"("transaction_id");

-- CreateIndex
CREATE INDEX "fin_attachments_installment_plan_id_idx" ON "fin_attachments"("installment_plan_id");

-- CreateIndex
CREATE INDEX "fin_attachments_commission_id_idx" ON "fin_attachments"("commission_id");

-- CreateIndex
CREATE INDEX "fin_attachments_invoice_id_idx" ON "fin_attachments"("invoice_id");

-- CreateIndex
CREATE INDEX "fin_attachments_asset_id_idx" ON "fin_attachments"("asset_id");

-- CreateIndex
CREATE INDEX "fin_notifications_workspace_id_dismissed_at_priority_idx" ON "fin_notifications"("workspace_id", "dismissed_at", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "fin_notifications_workspace_id_dedupe_key_key" ON "fin_notifications"("workspace_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "fin_import_batches_workspace_id_created_at_idx" ON "fin_import_batches"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "fin_audit_logs_workspace_id_entity_type_entity_id_idx" ON "fin_audit_logs"("workspace_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "fin_audit_logs_workspace_id_created_at_idx" ON "fin_audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "fin_job_runs_name_run_key_key" ON "fin_job_runs"("name", "run_key");

-- CreateIndex
CREATE UNIQUE INDEX "fin_month_closes_workspace_id_month_key" ON "fin_month_closes"("workspace_id", "month");

-- AddForeignKey
ALTER TABLE "fin_workspace_members" ADD CONSTRAINT "fin_workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_workspace_members" ADD CONSTRAINT "fin_workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_accounts" ADD CONSTRAINT "fin_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_categories" ADD CONSTRAINT "fin_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_categories" ADD CONSTRAINT "fin_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "fin_categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_transfer_account_id_fkey" FOREIGN KEY ("transfer_account_id") REFERENCES "fin_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "fin_credit_cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fin_credit_card_invoices"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fin_categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "fin_recurrences"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "fin_installment_plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_refund_of_id_fkey" FOREIGN KEY ("refund_of_id") REFERENCES "fin_transactions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "fin_import_batches"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_recurrences" ADD CONSTRAINT "fin_recurrences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_recurrences" ADD CONSTRAINT "fin_recurrences_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fin_categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_recurrences" ADD CONSTRAINT "fin_recurrences_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_recurrences" ADD CONSTRAINT "fin_recurrences_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "fin_credit_cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_subscriptions" ADD CONSTRAINT "fin_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_subscriptions" ADD CONSTRAINT "fin_subscriptions_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "fin_recurrences"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_commissions" ADD CONSTRAINT "fin_commissions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_commissions" ADD CONSTRAINT "fin_commissions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "fin_transactions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_credit_cards" ADD CONSTRAINT "fin_credit_cards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_credit_cards" ADD CONSTRAINT "fin_credit_cards_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "fin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_credit_card_invoices" ADD CONSTRAINT "fin_credit_card_invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_credit_card_invoices" ADD CONSTRAINT "fin_credit_card_invoices_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "fin_credit_cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_installment_plans" ADD CONSTRAINT "fin_installment_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_installment_plans" ADD CONSTRAINT "fin_installment_plans_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fin_categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_installment_plans" ADD CONSTRAINT "fin_installment_plans_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "fin_credit_cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_installment_plans" ADD CONSTRAINT "fin_installment_plans_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budgets" ADD CONSTRAINT "fin_budgets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budgets" ADD CONSTRAINT "fin_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fin_categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_goals" ADD CONSTRAINT "fin_goals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_goals" ADD CONSTRAINT "fin_goals_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "fin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_goal_contributions" ADD CONSTRAINT "fin_goal_contributions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_goal_contributions" ADD CONSTRAINT "fin_goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "fin_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_goal_contributions" ADD CONSTRAINT "fin_goal_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "fin_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_assets" ADD CONSTRAINT "fin_assets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_assets" ADD CONSTRAINT "fin_assets_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "fin_installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_valuations" ADD CONSTRAINT "fin_asset_valuations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fin_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_liabilities" ADD CONSTRAINT "fin_liabilities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_liabilities" ADD CONSTRAINT "fin_liabilities_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "fin_installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_financial_snapshots" ADD CONSTRAINT "fin_financial_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "fin_transactions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "fin_installment_plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "fin_commissions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "fin_credit_card_invoices"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fin_assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_attachments" ADD CONSTRAINT "fin_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_notifications" ADD CONSTRAINT "fin_notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_notifications" ADD CONSTRAINT "fin_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_import_batches" ADD CONSTRAINT "fin_import_batches_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_import_batches" ADD CONSTRAINT "fin_import_batches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_import_batches" ADD CONSTRAINT "fin_import_batches_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "fin_credit_cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_audit_logs" ADD CONSTRAINT "fin_audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_audit_logs" ADD CONSTRAINT "fin_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_month_closes" ADD CONSTRAINT "fin_month_closes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Constraints e índices que o Prisma não expressa (Financeiro/docs/03-banco-de-dados.md §7) ───

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Dinheiro
ALTER TABLE fin_transactions       ADD CONSTRAINT fin_transactions_amount_positive CHECK (amount > 0);
ALTER TABLE fin_recurrences        ADD CONSTRAINT fin_recurrences_amount_positive  CHECK (amount > 0);
ALTER TABLE fin_goal_contributions ADD CONSTRAINT fin_goal_contributions_nonzero   CHECK (amount <> 0);
ALTER TABLE fin_installment_plans  ADD CONSTRAINT fin_installment_plans_valid CHECK (
  total_amount > 0 AND installment_count BETWEEN 1 AND 420
  AND prior_paid_count BETWEEN 0 AND installment_count - 1);
ALTER TABLE fin_commissions ADD CONSTRAINT fin_commissions_valid CHECK (
  sale_amount > 0 AND rate_percent > 0 AND rate_percent <= 100);
ALTER TABLE fin_credit_cards ADD CONSTRAINT fin_credit_cards_valid CHECK (
  credit_limit >= 0 AND closing_day BETWEEN 1 AND 31 AND due_day BETWEEN 1 AND 31);

-- Forma de cada tipo de lançamento
ALTER TABLE fin_transactions ADD CONSTRAINT fin_transactions_shape CHECK (
  CASE type
    WHEN 'INCOME' THEN credit_card_id IS NULL AND transfer_account_id IS NULL
                   AND (status <> 'SETTLED' OR account_id IS NOT NULL)
    WHEN 'EXPENSE' THEN transfer_account_id IS NULL
                   AND NOT (account_id IS NOT NULL AND credit_card_id IS NOT NULL)
                   AND (status <> 'SETTLED' OR account_id IS NOT NULL OR credit_card_id IS NOT NULL)
    WHEN 'REFUND' THEN transfer_account_id IS NULL
                   AND (account_id IS NULL) <> (credit_card_id IS NULL)
    WHEN 'TRANSFER' THEN account_id IS NOT NULL AND transfer_account_id IS NOT NULL
                   AND account_id <> transfer_account_id AND credit_card_id IS NULL
    WHEN 'CARD_PAYMENT' THEN account_id IS NOT NULL AND credit_card_id IS NOT NULL
                   AND invoice_id IS NOT NULL
  END);
ALTER TABLE fin_transactions ADD CONSTRAINT fin_transactions_card_has_invoice
  CHECK (credit_card_id IS NULL OR invoice_id IS NOT NULL);
ALTER TABLE fin_transactions ADD CONSTRAINT fin_transactions_settled_date
  CHECK ((status = 'SETTLED') = (settled_at IS NOT NULL));
ALTER TABLE fin_transactions ADD CONSTRAINT fin_transactions_installment_pair
  CHECK ((installment_plan_id IS NULL) = (installment_number IS NULL));
ALTER TABLE fin_transactions ADD CONSTRAINT fin_transactions_recurrence_pair
  CHECK ((recurrence_id IS NULL) = (recurrence_date IS NULL));
ALTER TABLE fin_transactions ADD CONSTRAINT fin_transactions_nature_only_expense
  CHECK (nature IS NULL OR type IN ('EXPENSE','REFUND'));

-- Recorrências
ALTER TABLE fin_recurrences ADD CONSTRAINT fin_recurrences_valid CHECK (
  type IN ('INCOME','EXPENSE') AND interval_count >= 1
  AND (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31)
  AND (weekday IS NULL OR weekday BETWEEN 0 AND 6)
  AND (month_of_year IS NULL OR month_of_year BETWEEN 1 AND 12)
  AND (end_date IS NULL OR end_date >= start_date));

-- Anexo com exatamente um dono
ALTER TABLE fin_attachments ADD CONSTRAINT fin_attachments_single_owner CHECK (
  num_nonnulls(transaction_id, installment_plan_id, commission_id, invoice_id, asset_id) = 1);

-- Uma reserva de emergência ativa por workspace
CREATE UNIQUE INDEX fin_goals_single_emergency_fund ON fin_goals (workspace_id)
  WHERE kind = 'EMERGENCY_FUND' AND status <> 'ARCHIVED';

-- Nome de categoria único por nível, sem diferenciar maiúsculas (PG15+: NULLS NOT DISTINCT)
CREATE UNIQUE INDEX fin_categories_unique_name
  ON fin_categories (workspace_id, kind, parent_id, lower(name)) NULLS NOT DISTINCT
  WHERE archived_at IS NULL;

-- Busca sem acento e por trecho. As extensões podem morar em "public" (local) ou em
-- "extensions" (Supabase): o schema é descoberto aqui em vez de fixado no SQL.
DO $$
DECLARE
  s_unaccent text;
  s_trgm text;
BEGIN
  SELECT n.nspname INTO s_unaccent FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'unaccent';
  SELECT n.nspname INTO s_trgm     FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';

  EXECUTE format(
    'CREATE FUNCTION fin_immutable_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $f$ SELECT %I.unaccent(%L::regdictionary, $1) $f$',
    s_unaccent, s_unaccent || '.unaccent');

  EXECUTE format('CREATE INDEX fin_transactions_search_trgm ON fin_transactions USING gin (fin_immutable_unaccent(lower(description)) %I.gin_trgm_ops) WHERE deleted_at IS NULL', s_trgm);
  EXECUTE format('CREATE INDEX fin_installment_plans_search_trgm ON fin_installment_plans USING gin (fin_immutable_unaccent(lower(description)) %I.gin_trgm_ops) WHERE deleted_at IS NULL', s_trgm);
  EXECUTE format('CREATE INDEX fin_commissions_search_trgm ON fin_commissions USING gin (fin_immutable_unaccent(lower(client_name || '' '' || sale_description)) %I.gin_trgm_ops)', s_trgm);
END $$;
