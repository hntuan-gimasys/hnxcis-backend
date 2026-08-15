/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { schema } from '../../db/index.ts';
import { withBootstrapContext, type RequestContext } from '../../db/session.ts';
import { HttpError } from '../../middleware/errorHandler.ts';

/**
 * Giải quyết danh tính: Firebase UID → bản ghi `user_accounts`.
 *
 * Chạy trong bootstrap context (chỉ đặt `app.uid`), nên truy vấn này đọc được
 * đúng một dòng — dòng của chính người gọi.
 */
export async function resolveRequestContext(
  uid: string,
  meta: { ip?: string; correlationId?: string } = {},
): Promise<RequestContext> {
  const account = await withBootstrapContext(uid, async (tx) => {
    const rows = await tx
      .select({
        id: schema.userAccounts.id,
        fullName: schema.userAccounts.fullName,
        roleCode: schema.userAccounts.roleCode,
        actorType: schema.userAccounts.actorType,
        organizationId: schema.userAccounts.organizationId,
        status: schema.userAccounts.status,
      })
      .from(schema.userAccounts)
      .where(eq(schema.userAccounts.uid, uid))
      .limit(1);

    return rows[0];
  });

  if (!account) {
    // Token Firebase hợp lệ nhưng chưa có hồ sơ trong hệ thống: xác thực xong
    // không đồng nghĩa được cấp quyền.
    throw new HttpError(403, 'Tài khoản chưa được khai báo trong hệ thống HNX-CIS.');
  }

  if (account.status !== 'ACTIVE') {
    throw new HttpError(403, `Tài khoản đang ở trạng thái ${account.status}, không thể truy cập.`);
  }

  // Người dùng phía doanh nghiệp bắt buộc phải gắn với một tổ chức — thiếu nó
  // thì `app.org_id` rỗng và RLS sẽ cho họ thấy dữ liệu ngoài phạm vi.
  if (account.actorType === 'ORGANIZATION' && account.organizationId === null) {
    throw new HttpError(
      403,
      'Tài khoản doanh nghiệp chưa gắn với tổ chức nào. Liên hệ quản trị viên để được cấu hình.',
    );
  }

  return {
    uid,
    userId: account.id,
    fullName: account.fullName,
    roleCode: account.roleCode,
    actorType: account.actorType,
    organizationId: account.organizationId,
    correlationId: meta.correlationId ?? randomUUID(),
    ip: meta.ip,
  };
}
