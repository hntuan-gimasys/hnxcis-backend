# Drizzle migrations

```bash
npm run db:generate   # sinh migration từ src/db/schema.ts
npm run db:sync       # đồng bộ manual/*.sql -> migration đã đăng ký (BẮT BUỘC sau khi sửa manual/)
npm run db:migrate    # áp dụng migration đang chờ (cần Cloud SQL Auth Proxy)
```

Trên CI, migration được áp bằng `.github/workflows/db-migrate.yml` (chạy tay).

## Hai loại file trong thư mục này

| | Nguồn | Ai sinh ra |
|---|---|---|
| `0000_*.sql` | `src/db/schema.ts` | `drizzle-kit generate` |
| `0001_*.sql` … `0003_*.sql` | `manual/<cùng tên>.sql` | `npm run db:sync` |

RLS policy, hàm PL/pgSQL và trigger nằm ngoài khả năng biểu diễn của schema
Drizzle, nên chúng được viết tay trong `manual/`.

**Cạm bẫy:** drizzle-kit chỉ đọc file có đăng ký trong `meta/_journal.json` — nó
**không bao giờ** ngó tới thư mục con `manual/`. Để file ở đó thôi thì
`db:migrate` chạy qua mà không áp dụng gì, và database production thiếu sạch RLS
mà không báo lỗi nào. Vì vậy: **sửa `manual/` xong luôn chạy `npm run db:sync`.**

Đừng sửa tay `0001`–`0003` — lần `db:sync` sau sẽ ghi đè. Sửa ở `manual/`.

## Quy tắc

- Không sửa tay `meta/_journal.json`.
- Migration đã áp lên môi trường chung thì **không sửa nữa** — hash của file được
  ghi vào bảng `drizzle.__drizzle_migrations`, sửa file đã áp sẽ làm lệch hash.
  Cần đổi thì thêm migration mới.
- **Không dùng `drizzle-kit push`** cho môi trường thật: nó sinh bảng thẳng từ
  `schema.ts` và bỏ qua toàn bộ `0001`–`0003`, tức mất RLS, mất chặn xoá cứng,
  mất audit append-only, mất versioning.

## Thứ tự áp dụng và điều kiện tiên quyết

| # | Nội dung |
|---|---|
| `0000` | 30 bảng nền tảng sinh từ `schema.ts` |
| `0001` | RLS + `FORCE ROW LEVEL SECURITY`, trigger chặn `DELETE` vật lý, audit append-only |
| `0002` | Bootstrap danh tính dưới RLS (`app_current_uid()`, policy hẹp cho `user_accounts`) |
| `0003` | `app_create_version()` / `app_soft_delete()` dùng chung |

Role runtime `hnxcis_app` phải tồn tại **trước** `0001`, nếu không nó dừng với
`RAISE EXCEPTION`. Tạo bằng `gcloud sql users create hnxcis_app --instance=...`
(xem `docs/gcp-setup.md` mục 3).

## Kiểm tra sau khi migrate

Bắt buộc `SET ROLE hnxcis_app` trước khi thử RLS. Chạy dưới `postgres` sẽ luôn
thấy hết dữ liệu vì **superuser bypass RLS bất kể `FORCE ROW LEVEL SECURITY`** —
kiểm tra dưới `postgres` cho kết quả sai lệch và tạo cảm giác an toàn giả.

```sql
SET ROLE hnxcis_app;
SET app.actor_type = 'ORGANIZATION';
SET app.org_id = '1';

SELECT count(*) FROM submissions WHERE organization_id <> 1;  -- phải = 0
DELETE FROM submissions WHERE id = 1;                         -- phải raise exception
UPDATE audit_logs SET reason = 'x' WHERE id = 1;              -- phải raise exception
```

Bốn con số kỳ vọng sau lần migrate đầu: **30** bảng, **30** bảng bật RLS,
**14** hàm `app_*`, **30** trigger chặn xoá cứng.
