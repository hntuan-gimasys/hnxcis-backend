/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema } from '../../db/index.ts';
import { withUserContext, type DbSession, type RequestContext } from '../../db/session.ts';

/**
 * Audit Engine — lưu vết append-only (Nguyên tắc 2, mục tiêu MT3 của v1.2).
 *
 * Bảng `audit_logs` không có `deleted_at`, không có version, và migration 0001
 * đã thu hồi quyền UPDATE/DELETE khỏi runtime role đồng thời gắn trigger chặn.
 * Nghĩa là ghi sai cũng không sửa được — hãy ghi cho đúng ngay từ đầu.
 */

export interface AuditEntry {
  entityType: string;
  entityId: number;
  entityLabel?: string | null;
  /** Để RLS lọc được vết audit theo phạm vi tổ chức. */
  organizationId?: number | null;
  /** VD: `SUBMISSION.APPROVE`, `ORGANIZATION.SOFT_DELETE`. */
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  result?: 'SUCCESS' | 'FAILED';
}

/**
 * Các cột kỹ thuật bị loại khỏi phần diff.
 *
 * Chúng thay đổi ở MỌI lần update theo định nghĩa, nên nếu giữ lại thì diff nào
 * cũng có chúng và người đọc log sẽ mất dấu thay đổi nghiệp vụ thật. Giá trị của
 * chúng vẫn nằm nguyên trong `before_json` / `after_json`, không mất mát gì.
 */
const DIFF_IGNORED_FIELDS = new Set(['updatedAt', 'updatedBy', 'updated_at', 'updated_by']);

export interface FieldDiff {
  before: unknown;
  after: unknown;
}

export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, FieldDiff> | null {
  if (!before || !after) return null;

  const diff: Record<string, FieldDiff> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (DIFF_IGNORED_FIELDS.has(key)) continue;

    // So sánh qua JSON để bắt được thay đổi bên trong payload jsonb lồng nhau;
    // các cột nghiệp vụ ở đây đều là dữ liệu thuần, không có hàm hay vòng lặp
    // tham chiếu.
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) {
      diff[key] = { before: before[key] ?? null, after: after[key] ?? null };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Ghi một vết audit TRONG transaction nghiệp vụ.
 *
 * Cùng transaction là cố ý: thay đổi dữ liệu và vết audit của nó cùng commit
 * hoặc cùng rollback, không bao giờ có chuyện dữ liệu đổi mà không có vết.
 */
export async function recordAudit(
  tx: DbSession,
  ctx: RequestContext,
  entry: AuditEntry,
): Promise<void> {
  await tx.insert(schema.auditLogs).values({
    actorId: ctx.userId,
    actorName: ctx.fullName,
    actorRole: ctx.roleCode,
    actorIp: ctx.ip ?? null,
    correlationId: ctx.correlationId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel ?? null,
    organizationId: entry.organizationId ?? null,
    action: entry.action,
    beforeJson: entry.before ?? null,
    afterJson: entry.after ?? null,
    diffJson: computeDiff(entry.before, entry.after),
    reason: entry.reason ?? null,
    result: entry.result ?? 'SUCCESS',
  });
}

/**
 * Ghi vết cho một hành động BỊ TỪ CHỐI, trong transaction riêng.
 *
 * Đây không phải chi tiết cài đặt tuỳ ý mà là điều kiện đúng đắn: khi AuthZ
 * Engine ném 403, transaction nghiệp vụ rollback — và nếu vết audit nằm trong
 * đó thì nó biến mất cùng. Hệ quả là mọi nỗ lực truy cập trái phép đều không để
 * lại dấu vết, đúng thứ mà audit sinh ra để bắt.
 *
 * Lỗi khi ghi vết được nuốt có chủ đích: một request đã bị từ chối rồi thì
 * không nên biến thành lỗi 500 chỉ vì không ghi được log.
 */
export async function recordAuditFailure(ctx: RequestContext, entry: AuditEntry): Promise<void> {
  try {
    await withUserContext(ctx, async (tx) => {
      await recordAudit(tx, ctx, { ...entry, result: 'FAILED' });
    });
  } catch (error) {
    console.error('[audit] Không ghi được vết cho hành động bị từ chối:', error);
  }
}
