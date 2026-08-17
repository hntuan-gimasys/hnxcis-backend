/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sql } from 'drizzle-orm';
import type { DbSession, RequestContext } from '../../db/session.ts';
import { HttpError } from '../../middleware/errorHandler.ts';

/**
 * AuthZ Engine — phân quyền 3 trục (Nguyên tắc 3).
 *
 *   Trục 1  Chức năng       app_can_perform(permission_code)
 *   Trục 2  Phạm vi dữ liệu app_can_see_org(organization_id)
 *   Trục 3  Trạng thái      app_can_perform(permission_code, entity_status)
 *
 * Cả ba trục đánh giá bằng hàm SQL trong cùng transaction với truy vấn nghiệp
 * vụ, đọc cùng các bảng mà RLS đọc. Điều đó có nghĩa: engine này và RLS không
 * thể lệch nhau: cùng dữ liệu, cùng session context, cùng thời điểm.
 *
 * Vì sao vẫn cần kiểm tra ở tầng repository khi đã có RLS?
 *
 * - RLS lọc DÒNG, không phân biệt HÀNH ĐỘNG. Nó không biết "xem" khác "phê
 *   duyệt", trong khi trục Chức năng và trục Trạng thái thì có.
 * - RLS chặn âm thầm: một UPDATE bị chặn trả về "0 rows", không phải lỗi. Người
 *   dùng sẽ thấy "lưu thành công" trong khi chẳng có gì được lưu. Engine này
 *   ném 403 rõ ràng trước khi chạm tới dữ liệu.
 *
 * RLS là ranh giới bảo mật cuối cùng; engine này là lớp chặn sớm và là nơi sinh
 * ra thông báo lỗi đọc được.
 */

export interface PermissionCheck {
  /** VD: `SUBMISSION.APPROVE`. */
  permissionCode: string;
  /** Trạng thái hiện tại của bản ghi — trục 3. Bỏ qua nếu hành động không gắn với bản ghi nào. */
  entityStatus?: string | null;
  /** Tổ chức sở hữu bản ghi — trục 2. `null` = dữ liệu cấp hệ thống. */
  organizationId?: number | null;
}

export async function canPerform(tx: DbSession, check: PermissionCheck): Promise<boolean> {
  const result = await tx.execute<{ allowed: boolean }>(sql`
    select app_can_perform(
      ${check.permissionCode},
      ${check.entityStatus ?? null}
    ) as allowed
  `);
  return result.rows[0]?.allowed === true;
}

export async function canSeeOrg(tx: DbSession, organizationId: number | null): Promise<boolean> {
  const result = await tx.execute<{ allowed: boolean }>(sql`
    select app_can_see_org(${organizationId}) as allowed
  `);
  return result.rows[0]?.allowed === true;
}

/**
 * Kiểm tra đủ 3 trục, ném 403 kèm lý do nêu rõ trục nào chặn.
 *
 * Thông báo cố ý nói rõ trục bị chặn: người dùng nghiệp vụ cần phân biệt "vai
 * trò tôi không có quyền này" với "hồ sơ đang ở trạng thái không cho làm việc
 * này" — hai tình huống dẫn tới hai hành động xử lý hoàn toàn khác nhau.
 */
export async function assertPermission(
  tx: DbSession,
  ctx: RequestContext,
  check: PermissionCheck,
): Promise<void> {
  if (check.organizationId !== undefined) {
    const scopeOk = await canSeeOrg(tx, check.organizationId);
    if (!scopeOk) {
      throw new HttpError(
        403,
        'Ngoài phạm vi dữ liệu được cấp: bản ghi này không thuộc tổ chức hoặc phạm vi quản lý của bạn.',
      );
    }
  }

  const functionOk = await canPerform(tx, {
    permissionCode: check.permissionCode,
    entityStatus: null,
  });
  if (!functionOk) {
    throw new HttpError(
      403,
      `Vai trò ${ctx.roleCode} không được cấp quyền ${check.permissionCode}.`,
    );
  }

  if (check.entityStatus != null) {
    const statusOk = await canPerform(tx, check);
    if (!statusOk) {
      throw new HttpError(
        403,
        `Không thể thực hiện ${check.permissionCode} khi bản ghi đang ở trạng thái ${check.entityStatus}.`,
      );
    }
  }
}

/**
 * Kiểm soát kép (dual control): người duyệt phải khác người trình.
 *
 * Tách khỏi `assertPermission` vì đây là ràng buộc trên con người của một hồ sơ
 * cụ thể, không phải trên vai trò — cùng một người có đủ quyền phê duyệt vẫn
 * không được tự duyệt hồ sơ mình nộp.
 */
export function assertDualControl(
  ctx: RequestContext,
  submitterId: number | null | undefined,
): void {
  if (submitterId != null && submitterId === ctx.userId) {
    throw new HttpError(
      403,
      'Vi phạm kiểm soát kép: người phê duyệt không được là người trình hồ sơ.',
    );
  }
}
