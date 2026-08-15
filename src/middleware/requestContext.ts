/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { isDatabaseConfigured } from '../config/env.ts';
import type { RequestContext } from '../db/session.ts';
import { resolveRequestContext } from '../modules/authz/identity.ts';
import { HttpError } from './errorHandler.ts';

declare global {
  namespace Express {
    interface Request {
      /** Danh tính đã giải quyết; chỉ có khi người gọi đã xác thực. */
      ctx?: RequestContext;
      /** Lý do không dựng được danh tính, hoãn lại cho `requireContext` ném ra. */
      ctxError?: Error;
      correlationId?: string;
    }
  }
}

/**
 * Gắn `req.ctx` sau khi `attachUser` đã xác thực token Firebase.
 *
 * Middleware này KHÔNG tự từ chối request: endpoint công khai (tin công bố,
 * health check) vẫn phải chạy được khi không có danh tính. Việc bắt buộc đăng
 * nhập do `requireContext` ở từng route đảm nhiệm.
 */
export async function attachRequestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const correlationId = req.header('x-correlation-id')?.trim() || randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  if (!req.user || !isDatabaseConfigured) return next();

  try {
    req.ctx = await resolveRequestContext(req.user.uid, {
      ip: req.ip,
      correlationId,
    });
  } catch (error) {
    // Không ném ở đây. Token hợp lệ nhưng chưa có hồ sơ CIS là chuyện bình
    // thường (tài khoản mới chờ duyệt), và người đó vẫn phải xem được
    // /api/health hay tin đã công bố. Lỗi được giữ lại và chỉ nổ ra khi route
    // thực sự cần danh tính.
    req.ctxError = error as Error;
  }

  next();
}

/**
 * Lấy danh tính cho một route bắt buộc đăng nhập.
 *
 * Trả về context thay vì chỉ kiểm tra rồi để lời gọi tự đọc `req.ctx`: kiểu trả
 * về không-nullable khiến TypeScript chặn ngay tại chỗ biên dịch nếu ai đó quên
 * gọi hàm này trước khi truy vấn — quên nghĩa là truy vấn chạy không có session
 * context, và RLS sẽ lặng lẽ trả về rỗng.
 */
export function requireContext(req: Request): RequestContext {
  if (req.ctx) return req.ctx;

  // Ưu tiên lý do thật (tài khoản chưa khai báo / đang khoá) thay vì 401 chung
  // chung — người dùng cần biết đăng nhập lại cũng vô ích.
  if (req.ctxError) throw req.ctxError;

  throw new HttpError(401, 'Yêu cầu xác thực. Thiếu hoặc sai Firebase ID token.');
}
