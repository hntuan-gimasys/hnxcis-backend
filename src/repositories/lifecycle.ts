/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sql } from 'drizzle-orm';
import type { DbSession, RequestContext } from '../db/session.ts';
import { assertPermission } from '../modules/authz/engine.ts';
import { recordAudit } from '../modules/audit/engine.ts';

/**
 * Tầng Repository — nơi Nguyên tắc 2 và 3 gặp nhau.
 *
 * Mọi thay đổi vòng đời bản ghi (xoá mềm, sinh version) phải đi qua đây. Hai hàm
 * dưới luôn làm đủ ba việc trong cùng một transaction:
 *
 *   1. Kiểm tra phân quyền 3 trục (AuthZ Engine)
 *   2. Thi hành thay đổi qua hàm SQL dùng chung (migration 0003)
 *   3. Ghi vết audit (Audit Engine)
 *
 * Gọi thẳng UPDATE/INSERT ở module nghiệp vụ sẽ bỏ qua bước 1 và 3. RLS vẫn giữ
 * được ranh giới dữ liệu, nhưng vết audit thì mất — và mất vết là không phục hồi
 * được.
 */

/** Tên bảng vật lý; truyền vào hàm SQL dưới dạng regclass. */
export type TableName = string;

export interface SoftDeleteInput {
  table: TableName;
  entityType: string;
  id: number;
  reason: string;
  entityLabel?: string | null;
  organizationId?: number | null;
  /** Mặc định `<ENTITY_TYPE>.DELETE`. */
  permissionCode?: string;
  /** Trạng thái hiện tại — trục 3 của phân quyền. */
  entityStatus?: string | null;
}

export async function softDelete(
  tx: DbSession,
  ctx: RequestContext,
  input: SoftDeleteInput,
): Promise<void> {
  const permissionCode = input.permissionCode ?? `${input.entityType.toUpperCase()}.DELETE`;

  await assertPermission(tx, ctx, {
    permissionCode,
    entityStatus: input.entityStatus ?? null,
    organizationId: input.organizationId ?? null,
  });

  // Chụp lại trạng thái trước khi xoá: sau khi xoá mềm, bản ghi rơi ra khỏi tầm
  // nhìn của RLS nên không đọc lại được để dựng `before_json`.
  const before = await readRow(tx, input.table, input.id);

  await tx.execute(sql`
    select app_soft_delete(
      ${regclassOf(input.table)},
      ${input.id},
      ${ctx.userId},
      ${input.reason}
    )
  `);

  await recordAudit(tx, ctx, {
    entityType: input.entityType,
    entityId: input.id,
    entityLabel: input.entityLabel ?? null,
    organizationId: input.organizationId ?? null,
    action: `${input.entityType.toUpperCase()}.SOFT_DELETE`,
    before,
    after: null,
    reason: input.reason,
  });
}

export interface CreateVersionInput {
  table: TableName;
  entityType: string;
  id: number;
  /** Các trường thay đổi, theo TÊN CỘT trong DB (snake_case). */
  changes: Record<string, unknown>;
  entityLabel?: string | null;
  organizationId?: number | null;
  permissionCode?: string;
  entityStatus?: string | null;
  reason?: string | null;
}

/**
 * Sửa một bản ghi đã duyệt: sinh version mới thay vì ghi đè.
 *
 * `changes` dùng tên cột DB (snake_case) chứ không phải tên thuộc tính Drizzle
 * (camelCase), vì nó được merge thẳng vào `to_jsonb(row)` phía PostgreSQL.
 * Sai quy ước này thì trường bị bỏ qua lặng lẽ, không báo lỗi.
 *
 * @returns id của version mới
 */
export async function createVersion(
  tx: DbSession,
  ctx: RequestContext,
  input: CreateVersionInput,
): Promise<number> {
  const permissionCode = input.permissionCode ?? `${input.entityType.toUpperCase()}.EDIT`;

  await assertPermission(tx, ctx, {
    permissionCode,
    entityStatus: input.entityStatus ?? null,
    organizationId: input.organizationId ?? null,
  });

  const before = await readRow(tx, input.table, input.id);

  const result = await tx.execute<{ new_id: number }>(sql`
    select app_create_version(
      ${regclassOf(input.table)},
      ${input.id},
      ${JSON.stringify(input.changes)}::jsonb,
      ${ctx.userId}
    ) as new_id
  `);

  const newId = result.rows[0]?.new_id;
  if (typeof newId !== 'number') {
    throw new Error(`app_create_version không trả về id mới cho ${input.table}#${input.id}.`);
  }

  const after = await readRow(tx, input.table, newId);

  await recordAudit(tx, ctx, {
    entityType: input.entityType,
    entityId: newId,
    entityLabel: input.entityLabel ?? null,
    organizationId: input.organizationId ?? null,
    action: `${input.entityType.toUpperCase()}.VERSION_CREATED`,
    before,
    after,
    reason: input.reason ?? null,
  });

  return newId;
}

/**
 * Đọc một dòng dưới dạng JSON để dựng before/after cho audit.
 *
 * Trả về null khi RLS che dòng đó — đúng như mong muốn: vết audit không được
 * phép rò rỉ dữ liệu mà người thực hiện vốn không có quyền xem.
 */
async function readRow(
  tx: DbSession,
  table: TableName,
  id: number,
): Promise<Record<string, unknown> | null> {
  const result = await tx.execute<{ row: Record<string, unknown> }>(sql`
    select to_jsonb(t) as row from ${sql.raw(assertSafeTableName(table))} t where t.id = ${id}
  `);
  return result.rows[0]?.row ?? null;
}

/**
 * Tên bảng không tham số hoá được (nó là định danh, không phải giá trị), nên
 * mọi đường đi vào câu lệnh đều phải qua đây trước.
 *
 * Danh sách bảng là hữu hạn và do lập trình viên viết ra, nhưng vẫn chặn: một
 * tên bảng lỡ lấy từ input người dùng sẽ thành SQL injection ngay giữa tầng
 * repository — chỗ tệ nhất có thể.
 */
function assertSafeTableName(table: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error(`Tên bảng không hợp lệ: ${table}`);
  }
  return table;
}

/** Literal `'<table>'::regclass` đã qua kiểm tra, dùng cho các hàm SQL ở migration 0003. */
function regclassOf(table: TableName) {
  return sql.raw(`'${assertSafeTableName(table)}'::regclass`);
}
