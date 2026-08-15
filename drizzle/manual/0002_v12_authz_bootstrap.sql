-- HNX-CIS v1.2 — Gói M2: bootstrap danh tính dưới RLS.
--
-- Bài toán con gà - quả trứng: để đặt được `app.user_id` / `app.org_id` /
-- `app.role_code`, backend phải đọc `user_accounts` trước — nhưng chính bảng đó
-- đã bật RLS, mà policy của nó lại cần các biến chưa được đặt. Kết quả: 0 dòng,
-- và không ai đăng nhập được.
--
-- Cách xử lý ở đây: backend chỉ biết đúng MỘT thứ sau khi xác thực Firebase là
-- `uid`. Ta đặt `app.uid` trước, rồi mở đúng một khe hẹp cho phép mỗi phiên đọc
-- CHÍNH dòng của mình theo uid đó.
--
-- Cân nhắc đã loại bỏ: hàm SECURITY DEFINER. Vì migration 0001 bật
-- FORCE ROW LEVEL SECURITY, chủ sở hữu bảng cũng bị RLS chặn, nên SECURITY
-- DEFINER sẽ không giải quyết được gì trừ khi cấp BYPASSRLS — đúng thứ mà 0001
-- cố tình cấm. Policy hẹp dưới đây an toàn hơn: nó không mở thêm dòng nào ngoài
-- dòng của chính người gọi.

BEGIN;

CREATE OR REPLACE FUNCTION app_current_uid() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.uid', true), '');
$$;

-- Khe hẹp: chỉ SELECT, chỉ dòng có uid khớp phiên hiện tại, chỉ khi chưa xoá.
-- Không có INSERT/UPDATE nào đi qua policy này.
DROP POLICY IF EXISTS user_accounts_self_bootstrap ON user_accounts;
CREATE POLICY user_accounts_self_bootstrap ON user_accounts FOR SELECT USING (
  deleted_at IS NULL
  AND app_current_uid() IS NOT NULL
  AND uid = app_current_uid()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Trục 1 (Chức năng) + Trục 3 (Trạng thái) — kiểm tra ngay trong DB.
--
-- AuthZ Engine ở tầng repository gọi hàm này. Đặt logic ở DB thay vì chỉ ở
-- TypeScript để một repository viết ẩu cũng không thể bỏ qua: cùng một nguồn sự
-- thật với RLS, cùng một transaction.
--
-- DENY luôn thắng ALLOW. Không có bản ghi nào khớp ⇒ từ chối (default deny) —
-- ngược hẳn với trục Phạm vi dữ liệu, nơi "không có grant" nghĩa là cơ quan
-- quản lý thấy toàn thị trường.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_can_perform(
  p_permission_code text,
  p_entity_status text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  role_code text := app_role_code();
  denied    boolean;
  allowed   boolean;
BEGIN
  SELECT
    bool_or(rp.effect = 'DENY'),
    bool_or(
      rp.effect = 'ALLOW'
      -- Trục 3: allowed_statuses NULL = không ràng buộc trạng thái.
      AND (
        rp.allowed_statuses IS NULL
        OR p_entity_status IS NULL
        OR rp.allowed_statuses ? p_entity_status
      )
    )
  INTO denied, allowed
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE rp.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.is_active
    AND rp.role_code = role_code
    AND p.permission_code = p_permission_code;

  RETURN COALESCE(allowed, false) AND NOT COALESCE(denied, false);
END $$;

COMMIT;

-- Áp dụng: giống 0001 — dán vào một migration tạo bằng
--   npx drizzle-kit generate --custom --name=v12_authz_bootstrap
-- rồi chạy npm run db:migrate.
