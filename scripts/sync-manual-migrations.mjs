#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Đồng bộ drizzle/manual/*.sql  ->  drizzle/<tag>.sql (migration drizzle-kit thật).
 *
 * VÌ SAO PHẢI CÓ BƯỚC NÀY
 *
 * RLS policy, hàm PL/pgSQL và trigger nằm ngoài khả năng biểu diễn của schema
 * Drizzle, nên chúng được viết tay trong `drizzle/manual/`. Nhưng drizzle-kit chỉ
 * đọc những file có ĐĂNG KÝ trong `drizzle/meta/_journal.json` — nó không bao giờ
 * ngó tới thư mục con `manual/`. Nếu chỉ để file ở đó, `npm run db:migrate` sẽ
 * chạy qua mà không áp dụng gì cả, và database lên production thiếu sạch RLS.
 *
 * Script này chép nội dung sang đúng file migration đã đăng ký, với 2 biến đổi:
 *
 *   1. BỎ `BEGIN;` và `COMMIT;` ở top-level. drizzle-kit đã bọc toàn bộ migration
 *      trong một transaction; giữ lại `COMMIT;` sẽ commit sớm transaction của nó,
 *      khiến các lệnh còn lại chạy ngoài transaction và không rollback được.
 *
 *   2. KHÔNG chèn dấu tách statement của drizzle. `readMigrationFiles()` tách file
 *      bằng đúng chuỗi đó và KHÔNG tách theo dấu `;`, nên để nguyên thì cả file
 *      chạy như một batch — các khối `DO $$ ... $$;` và thân hàm PL/pgSQL (vốn
 *      chứa đầy dấu `;`) không bị cắt giữa chừng.
 *
 * CÁCH DÙNG
 *   node scripts/sync-manual-migrations.mjs          # ghi
 *   node scripts/sync-manual-migrations.mjs --check  # chỉ kiểm tra, khác thì exit 1 (dùng cho CI)
 *
 * THÊM MIGRATION THỦ CÔNG MỚI
 *   1. npx drizzle-kit generate --custom --name=<ten>   (tạo slot rỗng + entry journal)
 *   2. Viết SQL vào drizzle/manual/<so>_<ten>.sql
 *   3. Thêm cặp tương ứng vào PAIRS bên dưới rồi chạy script này.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRIZZLE = path.join(ROOT, 'drizzle');

/** [file nguồn trong manual/, file migration đã đăng ký trong journal] */
const PAIRS = [
  ['0001_v12_rls_and_audit_guard.sql', '0001_v12_rls_and_audit_guard.sql'],
  ['0002_v12_authz_bootstrap.sql', '0002_v12_authz_bootstrap.sql'],
  ['0003_v12_versioning.sql', '0003_v12_versioning.sql'],
];

// Ghép lúc chạy để chính file script này không chứa literal đó — nếu nó lọt vào
// nội dung migration, drizzle sẽ cắt file ngay tại chỗ và sinh SQL hỏng.
const BREAKPOINT = '--' + '> statement' + '-breakpoint';

const HEADER = [
  '-- ==========================================================================',
  '-- SINH TU DONG tu drizzle/manual/ - KHONG SUA TRUC TIEP FILE NAY.',
  '-- Sua o drizzle/manual/<cung ten>.sql roi chay:',
  '--     node scripts/sync-manual-migrations.mjs',
  '--',
  '-- Khac biet duy nhat so voi ban manual: da BO `BEGIN;` va `COMMIT;` o',
  '-- top-level. drizzle-kit migrate da boc san toan bo migration trong mot',
  '-- transaction; giu lai `COMMIT;` se commit som transaction do va lam cac',
  '-- lenh con lai chay ngoai transaction.',
  '--',
  '-- File nay co CHU DICH khong chua dau tach statement cua drizzle, de ca file',
  '-- chay nhu mot batch va cac khoi DO $$ ... $$; khong bi cat giua chung.',
  '-- ==========================================================================',
  '',
  '',
].join('\n');

const checkOnly = process.argv.includes('--check');

/** Bỏ đúng các dòng BEGIN;/COMMIT; ở đầu dòng (top-level), giữ nguyên phần còn lại. */
function strip(raw, src) {
  const lines = raw.split(/\r?\n/);
  let begins = 0;
  let commits = 0;
  const kept = lines.filter((line) => {
    if (/^BEGIN;\s*$/.test(line)) {
      begins++;
      return false;
    }
    if (/^COMMIT;\s*$/.test(line)) {
      commits++;
      return false;
    }
    return true;
  });
  if (begins !== 1 || commits !== 1) {
    throw new Error(
      `${src}: kỳ vọng đúng 1 BEGIN; và 1 COMMIT; ở top-level, thực tế ${begins}/${commits}. ` +
        `Transaction lồng nhau không an toàn — sửa file manual trước.`,
    );
  }
  return kept.join('\n');
}

let drift = 0;
for (const [srcName, dstName] of PAIRS) {
  const srcPath = path.join(DRIZZLE, 'manual', srcName);
  const dstPath = path.join(DRIZZLE, dstName);

  if (!fs.existsSync(srcPath)) throw new Error(`Không thấy file nguồn: ${srcPath}`);
  if (!fs.existsSync(dstPath)) {
    throw new Error(
      `Không thấy migration đích: ${dstPath}\n` +
        `Tạo slot trước bằng: npx drizzle-kit generate --custom --name=${dstName.replace(/^\d+_/, '').replace(/\.sql$/, '')}`,
    );
  }

  const next = HEADER + strip(fs.readFileSync(srcPath, 'utf8'), srcName);

  if (next.includes(BREAKPOINT)) {
    throw new Error(`${dstName}: nội dung chứa dấu tách statement của drizzle — sẽ sinh SQL hỏng.`);
  }

  const current = fs.readFileSync(dstPath, 'utf8');
  if (current === next) {
    console.log(`  đồng bộ   ${dstName}`);
    continue;
  }

  drift++;
  if (checkOnly) {
    console.error(`  LỆCH      ${dstName}  (manual/ đã đổi nhưng migration chưa cập nhật)`);
  } else {
    fs.writeFileSync(dstPath, next, 'utf8');
    console.log(`  đã ghi    ${dstName}`);
  }
}

// Mọi migration thủ công phải có mặt trong journal, nếu không db:migrate bỏ qua nó.
const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE, 'meta', '_journal.json'), 'utf8'));
const tags = new Set(journal.entries.map((e) => `${e.tag}.sql`));
const missing = PAIRS.map(([, d]) => d).filter((d) => !tags.has(d));
if (missing.length) {
  throw new Error(
    `Chưa đăng ký trong meta/_journal.json: ${missing.join(', ')}\n` +
      `db:migrate sẽ BỎ QUA các file này. Tạo bằng: npx drizzle-kit generate --custom --name=<ten>`,
  );
}

if (checkOnly && drift) {
  console.error(`\n${drift} file lệch. Chạy: node scripts/sync-manual-migrations.mjs`);
  process.exit(1);
}
console.log(`\nOK — ${PAIRS.length} migration thủ công khớp với manual/ và đã có trong journal.`);
