/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sql } from 'drizzle-orm';
import type { ActorType, UserRoleCode } from '../types/hnx.ts';
// `schema` phải import ở dạng giá trị: nó là namespace object, và `typeof schema`
// bên dưới cần binding giá trị chứ không phải nghĩa kiểu.
import { getDb, schema } from './index.ts';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Kiểu transaction của Drizzle, suy ra từ chính chữ ký `db.transaction` để khỏi
 * phải ghép tay các generic của PgTransaction.
 */
export type DbSession = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];

/** Danh tính đã giải quyết cho một request — nguồn duy nhất cho RLS và audit. */
export interface RequestContext {
  /** Firebase Auth UID. */
  uid: string;
  userId: number;
  fullName: string;
  roleCode: UserRoleCode;
  actorType: ActorType;
  /** NULL với người dùng nội bộ HNX. */
  organizationId: number | null;
  correlationId: string;
  ip?: string;
}

/**
 * Đặt biến phiên cho RLS (Nguyên tắc 3).
 *
 * Dùng `set_config(..., is_local => true)` chứ không phải câu lệnh `SET`:
 *
 * 1. `SET LOCAL` không nhận tham số ⇒ phải nối chuỗi ⇒ mở đường SQL injection
 *    ngay tại chỗ quyết định phân quyền. `set_config()` là lời gọi hàm bình
 *    thường nên tham số hoá được.
 * 2. `is_local = true` giới hạn giá trị trong đúng transaction hiện tại. Đây là
 *    điểm sống còn: pool tái sử dụng kết nối, một biến rò rỉ sang request kế
 *    tiếp nghĩa là doanh nghiệp A đọc được dữ liệu doanh nghiệp B.
 *
 * Vì vậy MỌI truy vấn nghiệp vụ bắt buộc chạy trong transaction, kể cả truy vấn
 * chỉ đọc. Ngoài transaction thì không có context, và RLS trả về 0 dòng.
 */
async function applySessionContext(
  tx: DbSession,
  ctx: RequestContext,
  options: { includeDeleted?: boolean } = {},
): Promise<void> {
  await tx.execute(sql`
    select
      set_config('app.uid',        ${ctx.uid},                              true),
      set_config('app.user_id',    ${String(ctx.userId)},                   true),
      set_config('app.role_code',  ${ctx.roleCode},                         true),
      set_config('app.actor_type', ${ctx.actorType},                        true),
      set_config('app.org_id',     ${ctx.organizationId?.toString() ?? ''}, true),
      set_config('app.include_deleted', ${options.includeDeleted ? 'on' : 'off'}, true)
  `);
}

/**
 * Chạy một khối nghiệp vụ dưới danh tính của người gọi.
 *
 * `includeDeleted` chỉ có tác dụng khi vai trò là admin — điều kiện đó do hàm
 * `app_include_deleted()` trong DB quyết định, không phải do TypeScript, nên
 * người dùng thường có bật cờ cũng vô ích.
 */
export async function withUserContext<T>(
  ctx: RequestContext,
  fn: (tx: DbSession) => Promise<T>,
  options: { includeDeleted?: boolean } = {},
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await applySessionContext(tx, ctx, options);
    return fn(tx);
  });
}

/**
 * Transaction chỉ có `app.uid`, dùng đúng một việc: tra `user_accounts` để biết
 * người gọi là ai. Policy `user_accounts_self_bootstrap` (migration 0002) chỉ
 * cho đọc đúng dòng khớp uid, nên không có gì khác lọt qua khe này.
 */
export async function withBootstrapContext<T>(
  uid: string,
  fn: (tx: DbSession) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.uid', ${uid}, true)`);
    return fn(tx);
  });
}
