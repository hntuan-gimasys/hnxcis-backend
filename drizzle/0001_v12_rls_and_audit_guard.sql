-- ==========================================================================
-- SINH TU DONG tu drizzle/manual/ - KHONG SUA TRUC TIEP FILE NAY.
-- Sua o drizzle/manual/<cung ten>.sql roi chay:
--     node scripts/sync-manual-migrations.mjs
--
-- Khac biet duy nhat so voi ban manual: da BO `BEGIN;` va `COMMIT;` o
-- top-level. drizzle-kit migrate da boc san toan bo migration trong mot
-- transaction; giu lai `COMMIT;` se commit som transaction do va lam cac
-- lenh con lai chay ngoai transaction.
--
-- File nay co CHU DICH khong chua dau tach statement cua drizzle, de ca file
-- chay nhu mot batch va cac khoi DO $$ ... $$; khong bi cat giua chung.
-- ==========================================================================

-- HNX-CIS v1.2 — Gói M1: Row-Level Security, chặn xoá cứng, audit append-only.
--
-- File này KHÔNG do drizzle-kit sinh ra: RLS policy, hàm PL/pgSQL và trigger nằm
-- ngoài khả năng biểu diễn của schema Drizzle. Cách áp dụng ở cuối file.
--
-- Nguyên tắc được cưỡng chế ở đây:
--   NT2  Cấm DELETE vật lý trên mọi bảng nghiệp vụ; audit_log chỉ INSERT.
--   NT3  Phạm vi dữ liệu cắt ở tầng DB, không phải tầng ứng dụng.
--
-- Điểm cốt tử: PostgreSQL BỎ QUA RLS đối với chủ sở hữu bảng. drizzle.config.ts
-- đã tách SQL_ADMIN_USER (owner, chạy migration) khỏi SQL_USER (runtime). Ta bật
-- FORCE ROW LEVEL SECURITY để ngay cả owner cũng bị chặn, và runtime role tuyệt
-- đối không được có thuộc tính BYPASSRLS hay quyền sở hữu bảng.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Runtime role
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hnxcis_app') THEN
    RAISE EXCEPTION
      'Chưa có role "hnxcis_app". Tạo role runtime (NOBYPASSRLS, không sở hữu bảng) trước khi chạy migration này.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hnxcis_app' AND rolbypassrls) THEN
    RAISE EXCEPTION
      'Role "hnxcis_app" đang có BYPASSRLS — toàn bộ phân quyền phạm vi dữ liệu sẽ vô hiệu. Chạy: ALTER ROLE hnxcis_app NOBYPASSRLS;';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO hnxcis_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO hnxcis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hnxcis_app;

-- NT2 — runtime role không bao giờ được DELETE ở bất kỳ bảng nào.
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM hnxcis_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO hnxcis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hnxcis_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Session context
--
-- Backend đặt các biến này ở đầu mỗi transaction bằng SET LOCAL (gói M2).
-- Dùng SET LOCAL chứ không SET: connection pool tái sử dụng kết nối, một biến
-- rò rỉ sang request sau là lỗ hổng cách ly dữ liệu.
--
-- Mọi hàm đều mặc định về trạng thái HẠN CHẾ NHẤT khi biến chưa được đặt:
-- không có context ⇒ bị coi là PUBLIC, không phải admin.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::integer;
$$;

CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::integer;
$$;

CREATE OR REPLACE FUNCTION app_role_code() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role_code', true), ''), 'ROLE_PUBLIC');
$$;

CREATE OR REPLACE FUNCTION app_actor_type() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.actor_type', true), ''), 'PUBLIC');
$$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_role_code() IN ('ROLE_SYS_ADMIN', 'ROLE_BIZ_ADMIN');
$$;

-- Cho phép nhìn thấy bản ghi đã xoá mềm — chỉ admin, chỉ khi bật cờ tường minh.
CREATE OR REPLACE FUNCTION app_include_deleted() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.include_deleted', true), ''), 'off') = 'on'
     AND app_is_admin();
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Trục "Phạm vi dữ liệu" (NT3)
--
-- Một tổ chức được nhìn thấy khi:
--   ORGANIZATION — chỉ dữ liệu của chính tổ chức mình.
--   HNX          — theo data_scope_grants; DENY luôn thắng ALLOW; nếu vai trò
--                  không có grant nào ở chiều ORGANIZATION thì mặc định thấy
--                  toàn thị trường (đúng bản chất cơ quan quản lý).
--   EXTERNAL/PUBLIC — không thấy dữ liệu thuộc tổ chức nào (chỉ đọc được thông
--                  tin đã công bố, qua policy riêng của từng bảng).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_can_see_org(target_org_id integer) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  actor      text := app_actor_type();
  role_code  text := app_role_code();
  user_id    integer := app_current_user_id();
  has_grant  boolean;
  denied     boolean;
  allowed    boolean;
BEGIN
  IF target_org_id IS NULL THEN
    RETURN actor = 'HNX';
  END IF;

  IF actor = 'ORGANIZATION' THEN
    RETURN app_current_org_id() IS NOT NULL
       AND app_current_org_id() = target_org_id;
  END IF;

  IF actor <> 'HNX' THEN
    RETURN false;
  END IF;

  -- count(*) > 0 chứ không phải hằng true: truy vấn tổng hợp luôn trả về đúng
  -- một dòng kể cả khi không khớp bản ghi nào, nên hằng số sẽ khiến vai trò
  -- không có grant nào bị hiểu nhầm là "có grant nhưng không được phép".
  SELECT
    bool_or(g.effect = 'DENY'  AND app_scope_matches(g.operator, g.values_list, target_org_id)),
    bool_or(g.effect = 'ALLOW' AND app_scope_matches(g.operator, g.values_list, target_org_id)),
    count(*) > 0
  INTO denied, allowed, has_grant
  FROM data_scope_grants g
  WHERE g.deleted_at IS NULL
    AND g.dimension = 'ORGANIZATION'
    AND (
      (g.subject_type = 'ROLE' AND g.subject_ref = role_code)
      OR (g.subject_type = 'USER' AND user_id IS NOT NULL AND g.subject_ref = user_id::text)
    );

  IF NOT COALESCE(has_grant, false) THEN
    RETURN true;
  END IF;

  RETURN COALESCE(allowed, false) AND NOT COALESCE(denied, false);
END $$;

CREATE OR REPLACE FUNCTION app_scope_matches(
  operator text,
  values_list jsonb,
  target_org_id integer
) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE operator
    WHEN 'ALL'    THEN true
    WHEN 'IN'     THEN values_list ? target_org_id::text
    WHEN 'NOT_IN' THEN NOT (values_list ? target_org_id::text)
    ELSE false
  END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Policy cho bảng có phạm vi tổ chức
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
  org_scoped text[] := ARRAY[
    'securities',
    'submissions',
    'attachments',
    'disclosure_obligations',
    'alerts',
    'workflow_tasks',
    'business_cases'
  ];
BEGIN
  FOREACH t IN ARRAY org_scoped LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR SELECT USING (
        (deleted_at IS NULL OR app_include_deleted())
        AND app_can_see_org(organization_id)
      )$p$, t || '_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
        app_can_see_org(organization_id)
      )$p$, t || '_insert', t);

    -- Sửa được thì phải đang nhìn thấy, và không được đẩy bản ghi ra ngoài
    -- phạm vi của chính mình.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR UPDATE
        USING (deleted_at IS NULL AND app_can_see_org(organization_id))
        WITH CHECK (app_can_see_org(organization_id))
      $p$, t || '_update', t);

    -- NT2 — không tồn tại đường DELETE hợp lệ. Xoá là UPDATE deleted_at.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_no_delete', t);
    -- RESTRICTIVE: policy permissive được OR với nhau, nên một policy FOR ALL
    -- của admin sẽ mở lại đường DELETE nếu policy này chỉ là permissive.
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR DELETE USING (false)', t || '_no_delete', t
    );
  END LOOP;
END $$;

-- organizations: dùng chính cột id làm khoá phạm vi.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON organizations;
CREATE POLICY organizations_select ON organizations FOR SELECT USING (
  (deleted_at IS NULL OR app_include_deleted()) AND app_can_see_org(id)
);

DROP POLICY IF EXISTS organizations_insert ON organizations;
CREATE POLICY organizations_insert ON organizations FOR INSERT WITH CHECK (
  app_actor_type() = 'HNX'
);

DROP POLICY IF EXISTS organizations_update ON organizations;
CREATE POLICY organizations_update ON organizations FOR UPDATE
  USING (deleted_at IS NULL AND app_can_see_org(id))
  WITH CHECK (app_can_see_org(id));

DROP POLICY IF EXISTS organizations_no_delete ON organizations;
CREATE POLICY organizations_no_delete ON organizations
  AS RESTRICTIVE FOR DELETE USING (false);

-- organization_translations: thừa hưởng phạm vi từ tổ chức cha.
ALTER TABLE organization_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_translations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_translations_all ON organization_translations;
CREATE POLICY organization_translations_all ON organization_translations FOR ALL
  USING ((deleted_at IS NULL OR app_include_deleted()) AND app_can_see_org(organization_id))
  WITH CHECK (app_can_see_org(organization_id));

DROP POLICY IF EXISTS organization_translations_no_delete ON organization_translations;
CREATE POLICY organization_translations_no_delete ON organization_translations
  AS RESTRICTIVE FOR DELETE USING (false);

-- user_accounts: người dùng doanh nghiệp chỉ thấy đồng nghiệp cùng tổ chức.
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_accounts_select ON user_accounts;
CREATE POLICY user_accounts_select ON user_accounts FOR SELECT USING (
  (deleted_at IS NULL OR app_include_deleted())
  AND (
    id = app_current_user_id()
    OR (organization_id IS NULL AND app_actor_type() = 'HNX')
    OR app_can_see_org(organization_id)
  )
);

DROP POLICY IF EXISTS user_accounts_write ON user_accounts;
CREATE POLICY user_accounts_write ON user_accounts FOR ALL
  USING (deleted_at IS NULL AND (app_is_admin() OR id = app_current_user_id()))
  WITH CHECK (app_is_admin() OR id = app_current_user_id());

DROP POLICY IF EXISTS user_accounts_no_delete ON user_accounts;
CREATE POLICY user_accounts_no_delete ON user_accounts
  AS RESTRICTIVE FOR DELETE USING (false);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Bảng metadata / danh mục / lịch
--
-- Ai đăng nhập cũng đọc được (form và lịch phải render cho mọi vai trò), nhưng
-- chỉ admin mới ghi — cấu hình engine là bề mặt tấn công cao nhất của một hệ
-- metadata-driven.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
  config_tables text[] := ARRAY[
    'catalog_items',
    'catalog_item_translations',
    'holiday_calendar',
    'trading_calendar',
    'permissions',
    'role_permissions',
    'data_scope_grants',
    'field_definitions',
    'field_definition_translations',
    'template_definitions',
    'template_definition_translations',
    'template_fields',
    'workflow_definitions',
    'workflow_steps',
    'workflow_transitions',
    'rule_definitions',
    'rule_definition_translations',
    'rule_parameters'
  ];
BEGIN
  FOREACH t IN ARRAY config_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR SELECT USING (
        deleted_at IS NULL OR app_include_deleted()
      )$p$, t || '_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_write', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR ALL
        USING (app_is_admin())
        WITH CHECK (app_is_admin())
      $p$, t || '_admin_write', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_no_delete', t);
    -- RESTRICTIVE: policy permissive được OR với nhau, nên một policy FOR ALL
    -- của admin sẽ mở lại đường DELETE nếu policy này chỉ là permissive.
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR DELETE USING (false)', t || '_no_delete', t
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Audit Engine — append-only (MT3 v1.2)
--
-- Ba lớp chặn: thu hồi quyền, policy, và trigger. Trigger là lớp cuối cùng còn
-- hiệu lực kể cả khi ai đó cấp nhầm quyền cho một role khác.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs', 'workflow_history'] LOOP
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %I FROM hnxcis_app', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I FOR SELECT USING (
        app_actor_type() = 'HNX' OR app_can_see_org(organization_id)
      )$p$, t || '_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (true)', t || '_insert', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION app_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Bảng % là append-only: không cho phép %. Sửa/xoá vết audit là vi phạm nguyên tắc lõi.',
    TG_TABLE_NAME, TG_OP;
END $$;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

DROP TRIGGER IF EXISTS trg_workflow_history_append_only ON workflow_history;
CREATE TRIGGER trg_workflow_history_append_only
  BEFORE UPDATE OR DELETE ON workflow_history
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Chặn xoá cứng ở mọi bảng nghiệp vụ (NT2)
--
-- Policy FOR DELETE USING (false) đã chặn runtime role. Trigger dưới đây chặn
-- cả những phiên có quyền cao hơn, và nêu rõ lý do thay vì báo "0 rows deleted"
-- khiến lập trình viên tưởng đã xoá thành công.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_forbid_hard_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Cấm DELETE vật lý trên %. Dùng soft delete: UPDATE % SET deleted_at = now(), deleted_by = ..., delete_reason = ...',
    TG_TABLE_NAME, TG_TABLE_NAME;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'deleted_at'
      AND NOT a.attisdropped
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || t || '_no_hard_delete', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app_forbid_hard_delete()',
      'trg_' || t || '_no_hard_delete', t
    );
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Cách áp dụng
--
--   1. Tạo runtime role một lần cho mỗi database (chạy bằng SQL_ADMIN_USER):
--        CREATE ROLE hnxcis_app LOGIN PASSWORD '<SQL_PASSWORD>' NOBYPASSRLS;
--
--   2. Sinh migration schema từ Drizzle:
--        npm run db:generate
--
--   3. Tạo một migration trống có đăng ký trong drizzle/meta/_journal.json rồi
--      dán nội dung file này vào (drizzle-kit không tự đọc thư mục manual/):
--        npx drizzle-kit generate --custom --name=v12_rls_and_audit_guard
--
--   4. Áp dụng: npm run db:migrate
--      (hoặc workflow thủ công .github/workflows/db-migrate.yml — migration cố ý
--       KHÔNG chạy khi deploy Cloud Run)
--
-- Kiểm tra sau khi chạy — cả ba lệnh đều phải THẤT BẠI:
--   SET app.actor_type = 'ORGANIZATION'; SET app.org_id = '1';
--   SELECT * FROM submissions WHERE organization_id <> 1;  -- phải trả 0 dòng
--   DELETE FROM submissions WHERE id = 1;                  -- phải raise exception
--   UPDATE audit_logs SET reason = 'x' WHERE id = 1;       -- phải raise exception
-- ═══════════════════════════════════════════════════════════════════════════
