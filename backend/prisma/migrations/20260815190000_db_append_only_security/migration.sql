-- Application-level DB hardening for Render managed PostgreSQL
-- (no postgresql.conf / pg_hba.conf access).
--
-- Goals:
--   * pgcrypto available for column encryption if needed later
--   * PUBLIC cannot touch tables by default
--   * Money + audit rows cannot be deleted; amounts cannot be rewritten
--   * App still works: stamp redeem UPDATE, visit red-flag UPDATE, Prisma migrate
--
-- Face IDs are NOT encrypted in-place: pechat matching uses employeeNo = driver.id.
-- Device passwords are already AES-256-GCM in the Nest app (DEVICE_CREDENTIALS_ENC_KEY).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- Current Render DB user (Prisma migrate + API) keeps full rights on existing tables.
GRANT ALL ON ALL TABLES IN SCHEMA public TO CURRENT_USER;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Shared: block DELETE / TRUNCATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_forbid_delete_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

-- ---------------------------------------------------------------------------
-- audit_logs: INSERT + SELECT only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_audit_logs_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON "audit_logs";

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION app_audit_logs_guard();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION app_audit_logs_guard();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION app_audit_logs_guard();

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON "audit_logs";
DROP POLICY IF EXISTS audit_logs_insert ON "audit_logs";
CREATE POLICY audit_logs_select ON "audit_logs" FOR SELECT USING (true);
CREATE POLICY audit_logs_insert ON "audit_logs" FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- operator_cash_entries: INSERT + SELECT only (smena kassasi)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_operator_cash_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'operator_cash_entries is append-only: % is not allowed', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS operator_cash_no_update ON "operator_cash_entries";
DROP TRIGGER IF EXISTS operator_cash_no_delete ON "operator_cash_entries";
DROP TRIGGER IF EXISTS operator_cash_no_truncate ON "operator_cash_entries";

CREATE TRIGGER operator_cash_no_update
  BEFORE UPDATE ON "operator_cash_entries"
  FOR EACH ROW EXECUTE FUNCTION app_operator_cash_guard();

CREATE TRIGGER operator_cash_no_delete
  BEFORE DELETE ON "operator_cash_entries"
  FOR EACH ROW EXECUTE FUNCTION app_operator_cash_guard();

CREATE TRIGGER operator_cash_no_truncate
  BEFORE TRUNCATE ON "operator_cash_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION app_operator_cash_guard();

ALTER TABLE "operator_cash_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operator_cash_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_cash_select ON "operator_cash_entries";
DROP POLICY IF EXISTS operator_cash_insert ON "operator_cash_entries";
CREATE POLICY operator_cash_select ON "operator_cash_entries" FOR SELECT USING (true);
CREATE POLICY operator_cash_insert ON "operator_cash_entries" FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- transactions: no DELETE/TRUNCATE; UPDATE only redemption metadata
-- (pechat yechish: redeemedAt / redeemedById / redeemKind / redeemNote)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_transactions_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'transactions is append-only: % is not allowed', TG_OP
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW."driverId" IS DISTINCT FROM OLD."driverId"
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW."operatorId" IS DISTINCT FROM OLD."operatorId"
       OR NEW."deviceId" IS DISTINCT FROM OLD."deviceId"
       OR NEW."productId" IS DISTINCT FROM OLD."productId"
       OR NEW.metadata IS DISTINCT FROM OLD.metadata
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'transactions: only pechat redemption fields may be updated'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS transactions_no_delete ON "transactions";
DROP TRIGGER IF EXISTS transactions_no_truncate ON "transactions";
DROP TRIGGER IF EXISTS transactions_protect_update ON "transactions";

CREATE TRIGGER transactions_protect_update
  BEFORE UPDATE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION app_transactions_guard();

CREATE TRIGGER transactions_no_delete
  BEFORE DELETE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION app_transactions_guard();

CREATE TRIGGER transactions_no_truncate
  BEFORE TRUNCATE ON "transactions"
  FOR EACH STATEMENT EXECUTE FUNCTION app_transactions_guard();

ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactions_select ON "transactions";
DROP POLICY IF EXISTS transactions_insert ON "transactions";
DROP POLICY IF EXISTS transactions_update ON "transactions";
CREATE POLICY transactions_select ON "transactions" FOR SELECT USING (true);
CREATE POLICY transactions_insert ON "transactions" FOR INSERT WITH CHECK (true);
CREATE POLICY transactions_update ON "transactions" FOR UPDATE USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- recognition_events: no DELETE/TRUNCATE; UPDATE only qizil belgi fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_recognition_events_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'recognition_events is append-only: % is not allowed', TG_OP
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW."deviceId" IS DISTINCT FROM OLD."deviceId"
       OR NEW."driverId" IS DISTINCT FROM OLD."driverId"
       OR NEW."employeeNoRaw" IS DISTINCT FROM OLD."employeeNoRaw"
       OR NEW."eventDateTime" IS DISTINCT FROM OLD."eventDateTime"
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW."rawPayload" IS DISTINCT FROM OLD."rawPayload"
       OR NEW."capturedPhotoUrl" IS DISTINCT FROM OLD."capturedPhotoUrl"
       OR NEW."transactionId" IS DISTINCT FROM OLD."transactionId"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    THEN
      RAISE EXCEPTION 'recognition_events: only flag fields may be updated'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recognition_events_protect_update ON "recognition_events";
DROP TRIGGER IF EXISTS recognition_events_no_delete ON "recognition_events";
DROP TRIGGER IF EXISTS recognition_events_no_truncate ON "recognition_events";

CREATE TRIGGER recognition_events_protect_update
  BEFORE UPDATE ON "recognition_events"
  FOR EACH ROW EXECUTE FUNCTION app_recognition_events_guard();

CREATE TRIGGER recognition_events_no_delete
  BEFORE DELETE ON "recognition_events"
  FOR EACH ROW EXECUTE FUNCTION app_recognition_events_guard();

CREATE TRIGGER recognition_events_no_truncate
  BEFORE TRUNCATE ON "recognition_events"
  FOR EACH STATEMENT EXECUTE FUNCTION app_recognition_events_guard();

ALTER TABLE "recognition_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recognition_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recognition_events_select ON "recognition_events";
DROP POLICY IF EXISTS recognition_events_insert ON "recognition_events";
DROP POLICY IF EXISTS recognition_events_update ON "recognition_events";
CREATE POLICY recognition_events_select ON "recognition_events" FOR SELECT USING (true);
CREATE POLICY recognition_events_insert ON "recognition_events" FOR INSERT WITH CHECK (true);
CREATE POLICY recognition_events_update ON "recognition_events" FOR UPDATE USING (true) WITH CHECK (true);
