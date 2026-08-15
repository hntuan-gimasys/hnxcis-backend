-- HNX-CIS v1.2 — Gói M2: version-on-approved-edit và soft delete dùng chung.
--
-- Vì sao đặt ở DB chứ không ở TypeScript:
--
-- 1. Hơn 20 bảng cần đúng một hành vi này. Viết ở tầng ứng dụng nghĩa là 20 chỗ
--    có thể làm sai khác nhau.
-- 2. Hàm chạy dưới quyền NGƯỜI GỌI (không phải SECURITY DEFINER), nên RLS vẫn
--    áp lên các lệnh UPDATE/INSERT bên trong. Không thể mượn versioning để lách
--    phạm vi dữ liệu.
-- 3. Thứ tự thao tác có ràng buộc tinh vi (xem chú thích trong hàm) — gói lại
--    một chỗ thì chỉ cần đúng một lần.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Version-on-approved-edit (NT2, CR1 của v1.2)
--
-- Sửa một bản ghi ĐÃ DUYỆT không ghi đè: sinh dòng mới version_no + 1, hạ cờ
-- is_current ở dòng cũ. Quyết định "lần sửa này có phải approved-edit không"
-- KHÔNG nằm ở đây — nó do Workflow Engine đọc từ
-- workflow_transitions.creates_new_version (gói M4). Hàm này chỉ thi hành.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_create_version(
  p_table   regclass,
  p_id      integer,
  p_changes jsonb DEFAULT '{}'::jsonb,
  p_actor   integer DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_src    jsonb;
  v_new_id integer;
  v_seq    text;
BEGIN
  EXECUTE format(
    'SELECT to_jsonb(t) FROM %s t WHERE id = $1 AND is_current AND deleted_at IS NULL',
    p_table
  ) INTO v_src USING p_id;

  IF v_src IS NULL THEN
    RAISE EXCEPTION
      'Không tìm thấy bản ghi hiện hành id=% ở bảng % (đã bị xoá mềm, không phải bản hiện hành, hoặc ngoài phạm vi dữ liệu của bạn).',
      p_id, p_table;
  END IF;

  v_seq := pg_get_serial_sequence(p_table::text, 'id');
  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'Bảng % không có sequence cho cột id — không dùng được versioning.', p_table;
  END IF;
  v_new_id := nextval(v_seq);

  v_src := v_src
    || jsonb_build_object(
         'id',          v_new_id,
         'version_no',  COALESCE((v_src->>'version_no')::integer, 1) + 1,
         'is_current',  true,
         -- parent_id luôn trỏ về GỐC của chuỗi, không phải version liền trước:
         -- lấy toàn bộ lịch sử chỉ cần một điều kiện WHERE parent_id = ...
         'parent_id',   COALESCE((v_src->>'parent_id')::integer, p_id),
         'created_at',  now(),
         'created_by',  p_actor,
         'updated_at',  NULL,
         'updated_by',  NULL,
         'deleted_at',  NULL,
         'deleted_by',  NULL,
         'delete_reason', NULL
       )
    || COALESCE(p_changes, '{}'::jsonb);

  -- Hạ cờ bản cũ TRƯỚC khi chèn bản mới.
  --
  -- Partial unique index của các bảng có version đều mang điều kiện
  -- `WHERE is_current AND deleted_at IS NULL`. Unique index được kiểm tra ngay
  -- ở cuối mỗi câu lệnh chứ không hoãn tới lúc COMMIT, nên chèn trước thì trong
  -- khoảnh khắc đó có hai dòng cùng is_current và câu lệnh chèn sẽ hỏng.
  EXECUTE format(
    'UPDATE %s SET is_current = false, updated_at = now(), updated_by = $2 WHERE id = $1',
    p_table
  ) USING p_id, p_actor;

  EXECUTE format(
    'INSERT INTO %s SELECT * FROM jsonb_populate_record(null::%s, $1)',
    p_table, p_table
  ) USING v_src;

  RETURN v_new_id;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Soft delete (NT2)
--
-- Bắt buộc có lý do: một bản ghi biến mất khỏi mọi màn hình mà không ai biết vì
-- sao là thứ không chấp nhận được trong hệ thống chịu thanh tra.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_soft_delete(
  p_table  regclass,
  p_id     integer,
  p_actor  integer,
  p_reason text
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Xoá bản ghi bắt buộc phải có lý do (delete_reason).';
  END IF;

  EXECUTE format(
    'UPDATE %s SET deleted_at = now(), deleted_by = $2, delete_reason = $3, is_current = false
      WHERE id = $1 AND deleted_at IS NULL',
    p_table
  ) USING p_id, p_actor, p_reason;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 0 dòng ở đây gần như luôn là RLS chặn hoặc bản ghi đã bị xoá trước đó. Báo
  -- lỗi tường minh thay vì trả về im lặng, tránh việc phía gọi tưởng đã xoá.
  IF v_count = 0 THEN
    RAISE EXCEPTION
      'Không xoá được bản ghi id=% ở bảng %: đã bị xoá trước đó hoặc ngoài phạm vi dữ liệu của bạn.',
      p_id, p_table;
  END IF;

  RETURN v_count;
END $$;

-- `is_current = false` ở trên có chủ đích: bản ghi đã xoá mềm không còn là bản
-- hiện hành, nhờ đó partial unique index nhả khoá nghiệp vụ ra cho bản ghi mới
-- dùng lại (VD: cấp lại mã hồ sơ sau khi huỷ).

REVOKE ALL ON FUNCTION app_create_version(regclass, integer, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_soft_delete(regclass, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_create_version(regclass, integer, jsonb, integer) TO hnxcis_app;
GRANT EXECUTE ON FUNCTION app_soft_delete(regclass, integer, integer, text) TO hnxcis_app;

COMMIT;
