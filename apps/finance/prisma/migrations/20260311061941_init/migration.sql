-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('COP', 'USD', 'EUR', 'BTC', 'ETH', 'USDT', 'UVR');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CHECKING', 'CREDIT_CARD', 'LOAN', 'MORTGAGE', 'AFC', 'INVESTMENT', 'CRYPTO');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEBIT', 'CREDIT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DebType" AS ENUM ('CREDIT_CARD', 'LOAN', 'MORTGAGE', 'LINE_OF_CREDIT');

-- CreateEnum
CREATE TYPE "SyncMethod" AS ENUM ('BELVO', 'MANUAL', 'CSV_IMPORT', 'OFX_IMPORT');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'COP',
    "balance_centavos" BIGINT NOT NULL DEFAULT 0,
    "belvo_account_id" TEXT,
    "belvo_link_token" TEXT,
    "sync_method" "SyncMethod" NOT NULL DEFAULT 'MANUAL',
    "last_synced_at" TIMESTAMP(3),
    "is_afc" BOOLEAN NOT NULL DEFAULT false,
    "is_uvr_mortgage" BOOLEAN NOT NULL DEFAULT false,
    "uvr_balance" DECIMAL(20,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount_centavos" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'COP',
    "cop_rate" DECIMAL(20,6),
    "cop_amount_centavos" BIGINT,
    "description" TEXT NOT NULL,
    "merchant_name" TEXT,
    "category_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "transacted_at" TIMESTAMP(3) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_id" TEXT,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "is_subscription" BOOLEAN NOT NULL DEFAULT false,
    "subscription_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "limit_centavos" BIGINT NOT NULL,
    "alert_pct" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "type" "DebType" NOT NULL,
    "account_id" TEXT,
    "principal_centavos" BIGINT NOT NULL,
    "balance_centavos" BIGINT NOT NULL,
    "interest_rate_pct" DECIMAL(8,4) NOT NULL,
    "min_payment_centavos" BIGINT NOT NULL,
    "payment_due_day" INTEGER NOT NULL,
    "is_uvr" BOOLEAN NOT NULL DEFAULT false,
    "credit_limit_centavos" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "ticker" TEXT,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "units" DECIMAL(20,8) NOT NULL,
    "avg_cost_centavos" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "from" "Currency" NOT NULL,
    "to" "Currency" NOT NULL,
    "rate" DECIMAL(20,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "merchant_name" TEXT NOT NULL,
    "amount_centavos" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'COP',
    "frequency_days" INTEGER NOT NULL,
    "last_charged" TIMESTAMP(3) NOT NULL,
    "next_expected" TIMESTAMP(3) NOT NULL,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowPoint" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "projected_balance_centavos" BIGINT NOT NULL,
    "scheduled_income" BIGINT NOT NULL DEFAULT 0,
    "scheduled_expenses" BIGINT NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashFlowPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_account_id_external_id_key" ON "Transaction"("account_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_from_to_date_key" ON "FxRate"("from", "to", "date");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
