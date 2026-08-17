/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Nguyên tắc 2 — Soft delete trên MỌI bảng nghiệp vụ.
 *
 * Không bao giờ DELETE vật lý. Mọi truy vấn nghiệp vụ phải lọc
 * `deleted_at IS NULL`; ràng buộc này được cưỡng chế thêm một lớp nữa bằng
 * RLS policy ở tầng PostgreSQL (xem drizzle/manual/0001_v12_rls_and_indexes.sql).
 *
 * Bảng cấu hình thuần kỹ thuật (audit_logs, workflow_history) KHÔNG dùng nhóm
 * cột này: chúng là append-only, xoá mềm cũng không được phép.
 */
export const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  updatedBy: integer('updated_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: integer('deleted_by'),
  deleteReason: text('delete_reason'),
};

/**
 * Nguyên tắc 2 — Version-on-approved-edit.
 *
 * Sửa một bản ghi ĐÃ DUYỆT không ghi đè: hệ thống chèn một dòng mới với
 * `version_no + 1`, `parent_id` trỏ về bản gốc (version 1), và hạ
 * `is_current = false` ở bản cũ. Lịch sử vì vậy là append-only.
 *
 * `parent_id` luôn trỏ tới GỐC của chuỗi version (không phải version liền
 * trước) để truy vấn toàn bộ lịch sử chỉ tốn một điều kiện.
 *
 * Mỗi bảng dùng nhóm cột này BẮT BUỘC khai báo một partial unique index trên
 * khoá nghiệp vụ với điều kiện `WHERE is_current AND deleted_at IS NULL` —
 * đó là thứ giữ cho "chỉ có đúng một bản hiện hành" mà vẫn cho phép nhiều
 * version cùng khoá tồn tại song song.
 */
export const versionColumns = {
  versionNo: integer('version_no').notNull().default(1),
  isCurrent: boolean('is_current').notNull().default(true),
  parentId: integer('parent_id'),
};

/** Nhóm cột chuẩn cho bảng nghiệp vụ vừa xoá mềm vừa có version. */
export const baseColumns = {
  ...auditColumns,
  ...versionColumns,
};
