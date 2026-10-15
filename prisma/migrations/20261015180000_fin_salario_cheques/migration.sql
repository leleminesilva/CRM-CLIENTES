-- Folha de pagamento (funcionários e pagamento mensal) e controle de cheques. Só tabelas novas.
-- CreateTable
CREATE TABLE "fin_employees" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "salary" DECIMAL(14,2) NOT NULL,
    "pay_day" INTEGER NOT NULL,
    "crm_user_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_payrolls" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "transaction_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cheques" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "direction" VARCHAR(8) NOT NULL,
    "number" TEXT NOT NULL,
    "bank" TEXT,
    "party" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "bounced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "transaction_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fin_cheques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fin_employees_workspace_id_active_idx" ON "fin_employees"("workspace_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "fin_payrolls_transaction_id_key" ON "fin_payrolls"("transaction_id");

-- CreateIndex
CREATE INDEX "fin_payrolls_workspace_id_month_idx" ON "fin_payrolls"("workspace_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "fin_payrolls_employee_id_month_key" ON "fin_payrolls"("employee_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "fin_cheques_transaction_id_key" ON "fin_cheques"("transaction_id");

-- CreateIndex
CREATE INDEX "fin_cheques_workspace_id_direction_idx" ON "fin_cheques"("workspace_id", "direction");

-- AddForeignKey
ALTER TABLE "fin_employees" ADD CONSTRAINT "fin_employees_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payrolls" ADD CONSTRAINT "fin_payrolls_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payrolls" ADD CONSTRAINT "fin_payrolls_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "fin_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payrolls" ADD CONSTRAINT "fin_payrolls_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "fin_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cheques" ADD CONSTRAINT "fin_cheques_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "fin_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cheques" ADD CONSTRAINT "fin_cheques_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "fin_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras de validade
ALTER TABLE "fin_employees" ADD CONSTRAINT "fin_employees_valid" CHECK (salary >= 0 AND pay_day BETWEEN 1 AND 28);
ALTER TABLE "fin_cheques" ADD CONSTRAINT "fin_cheques_direction" CHECK (direction IN ('ISSUED', 'RECEIVED'));
