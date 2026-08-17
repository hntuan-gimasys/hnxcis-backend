/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { auditColumns, baseColumns } from './columns.ts';
import type {
  ActorType,
  BoardType,
  BusinessCaseStatus,
  NewsGroupCode,
  SecurityStatus,
  SecurityType,
  SubmissionStatus,
  UserRoleCode,
} from '../types/hnx.ts';

/**
 * HNX-CIS — Schema nền tảng v1.2 (gói M1).
 *
 * Quy ước áp dụng cho toàn bộ file này:
 *
 * - NT2  Mọi bảng nghiệp vụ mang `auditColumns` (soft delete). Bảng nào sửa
 *        được sau khi duyệt thì mang thêm `versionColumns` + partial unique
 *        index `WHERE is_current AND deleted_at IS NULL`.
 * - NT3  Bảng chứa dữ liệu của doanh nghiệp có `organization_id` để RLS policy
 *        cắt theo `app.org_id`. Policy nằm ở migration SQL, không ở đây.
 * - NT4  Nội dung nghiệp vụ song ngữ nằm ở bảng `*_translations` liên kết, KHÔNG
 *        phải cột `*_vi`/`*_en` và tuyệt đối không nằm ở file locale.
 * - NT5  Không có cột hạn nào được tính bằng cộng ngày dương lịch. Mọi mốc sinh
 *        ra từ BusinessCalendarService dựa trên `holiday_calendar` /
 *        `trading_calendar` (gói M3).
 *
 * Trạng thái được lưu dạng `text` + `$type<>()` thay vì pgEnum: hệ thống là
 * metadata-driven, tập trạng thái do Workflow Engine cấu hình chứ không cố định
 * trong DDL, và thêm giá trị mới không cần migration kiểu enum.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Định danh & Tổ chức
 * ──────────────────────────────────────────────────────────────────────────── */

export const organizations = pgTable(
  'organizations',
  {
    id: serial('id').primaryKey(),
    orgCode: text('org_code').notNull(),
    taxCode: text('tax_code').notNull(),
    shortName: text('short_name').notNull(),
    orgType: text('org_type')
      .$type<'LISTED' | 'UPCOM_REGISTERED' | 'PRIVATE_BOND_ISSUER' | 'STARTUP'>()
      .notNull(),
    businessRegNo: text('business_reg_no'),
    businessRegDate: date('business_reg_date'),
    charterCapital: numeric('charter_capital', { precision: 20, scale: 0 }),
    industryCode: text('industry_code'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    legalRepName: text('legal_rep_name'),
    disclosureRepName: text('disclosure_rep_name'),
    disclosureRepEmail: text('disclosure_rep_email'),
    isPublicCompany: boolean('is_public_company').notNull().default(false),
    publicCompanyDate: date('public_company_date'),
    status: text('status').$type<'APPROVED' | 'PENDING' | 'SUSPENDED'>().notNull().default('PENDING'),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_organizations_org_code_current')
      .on(t.orgCode)
      .where(sql`is_current AND deleted_at IS NULL`),
    uniqueIndex('uq_organizations_tax_code_current')
      .on(t.taxCode)
      .where(sql`is_current AND deleted_at IS NULL`),
    index('ix_organizations_parent').on(t.parentId),
  ],
);

/** NT4 — tên/địa chỉ pháp lý song ngữ nằm ở bản ghi riêng, không phải cột `name_en`. */
export const organizationTranslations = pgTable(
  'organization_translations',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    lang: text('lang').$type<'vi' | 'en'>().notNull(),
    name: text('name').notNull(),
    shortName: text('short_name'),
    address: text('address'),
    industryName: text('industry_name'),
    translationStatus: text('translation_status')
      .$type<'NONE' | 'AI_DRAFT' | 'HUMAN_REVIEWED' | 'APPROVED'>()
      .notNull()
      .default('NONE'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_organization_translations_org_lang')
      .on(t.organizationId, t.lang)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const securities = pgTable(
  'securities',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    symbol: text('symbol').notNull(),
    securityType: text('security_type').$type<SecurityType>().notNull(),
    board: text('board').$type<BoardType>().notNull(),
    isin: text('isin'),
    status: text('status').$type<SecurityStatus>().notNull().default('NORMAL'),
    listingStatusNote: text('listing_status_note'),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_securities_symbol_current')
      .on(t.symbol)
      .where(sql`is_current AND deleted_at IS NULL`),
    index('ix_securities_organization').on(t.organizationId),
  ],
);

export const userAccounts = pgTable(
  'user_accounts',
  {
    id: serial('id').primaryKey(),
    /** Firebase Auth UID — cầu nối sang tầng xác thực. */
    uid: text('uid').notNull(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    actorType: text('actor_type').$type<ActorType>().notNull(),
    /** NULL với người dùng nội bộ HNX; bắt buộc với tài khoản doanh nghiệp. */
    organizationId: integer('organization_id').references(() => organizations.id),
    unitCode: text('unit_code'),
    position: text('position'),
    roleCode: text('role_code').$type<UserRoleCode>().notNull(),
    status: text('status')
      .$type<'ACTIVE' | 'PENDING' | 'LOCKED' | 'DISABLED'>()
      .notNull()
      .default('PENDING'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_user_accounts_uid').on(t.uid).where(sql`deleted_at IS NULL`),
    uniqueIndex('uq_user_accounts_username').on(t.username).where(sql`deleted_at IS NULL`),
    index('ix_user_accounts_organization').on(t.organizationId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Danh mục dùng chung
 * ──────────────────────────────────────────────────────────────────────────── */

export const catalogItems = pgTable(
  'catalog_items',
  {
    id: serial('id').primaryKey(),
    catalogCode: text('catalog_code').notNull(),
    code: text('code').notNull(),
    parentCode: text('parent_code'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_catalog_items_catalog_code')
      .on(t.catalogCode, t.code)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const catalogItemTranslations = pgTable(
  'catalog_item_translations',
  {
    id: serial('id').primaryKey(),
    catalogItemId: integer('catalog_item_id')
      .notNull()
      .references(() => catalogItems.id),
    lang: text('lang').$type<'vi' | 'en'>().notNull(),
    name: text('name').notNull(),
    description: text('description'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_catalog_item_translations_item_lang')
      .on(t.catalogItemId, t.lang)
      .where(sql`deleted_at IS NULL`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 3. Lịch nghiệp vụ (NT5 + v1.2 Tính năng A)
 *
 * v1.2 tách ba hệ đo thời gian khác nhau, KHÔNG được lẫn lộn:
 *   CALENDAR — ngày dương lịch (chỉ dùng khi văn bản pháp lý nói rõ "ngày").
 *   WORKING  — ngày làm việc: trừ T7/CN, trừ `holiday_calendar`, cộng ngày làm bù.
 *   TRADING  — ngày giao dịch: phiên thực mở của từng bảng (HNX/UPCOM/PRIVATE_BOND).
 *
 * Ngày giao dịch KHÔNG đồng nhất ngày làm việc: một ngày làm việc vẫn có thể
 * ngừng giao dịch (sự cố hệ thống, ngày nghỉ giao dịch riêng của một bảng).
 * Vì vậy `trading_calendar` là bảng riêng, liệt kê tường minh theo bảng giao
 * dịch, chứ không suy ra từ `holiday_calendar`.
 * ──────────────────────────────────────────────────────────────────────────── */

export const holidayCalendar = pgTable(
  'holiday_calendar',
  {
    id: serial('id').primaryKey(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    year: integer('year').notNull(),
    holidayType: text('holiday_type').$type<'HOLIDAY' | 'MAKEUP_WORKDAY'>().notNull(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en'),
    legalBasis: text('legal_basis'),
    ...auditColumns,
  },
  (t) => [
    index('ix_holiday_calendar_range').on(t.fromDate, t.toDate).where(sql`deleted_at IS NULL`),
    index('ix_holiday_calendar_year').on(t.year),
  ],
);

export const tradingCalendar = pgTable(
  'trading_calendar',
  {
    id: serial('id').primaryKey(),
    /** NULL = áp dụng cho mọi bảng giao dịch. */
    board: text('board').$type<BoardType>(),
    tradingDate: date('trading_date').notNull(),
    year: integer('year').notNull(),
    sessionType: text('session_type')
      .$type<'FULL' | 'HALF' | 'CLOSED'>()
      .notNull()
      .default('FULL'),
    closeReason: text('close_reason'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_trading_calendar_board_date')
      .on(t.board, t.tradingDate)
      .where(sql`deleted_at IS NULL`),
    index('ix_trading_calendar_year').on(t.year),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 4. AuthZ Engine — phân quyền 3 trục (NT3)
 *
 *   Trục 1 Chức năng      → permissions × role_permissions
 *   Trục 2 Phạm vi dữ liệu → data_scope_grants (chiều ORGANIZATION/BOARD/...)
 *   Trục 3 Trạng thái      → role_permissions.allowed_statuses
 *
 * Cả ba trục phải cùng thoả mãn thì hành động mới được phép. Bảng ở đây là
 * NGUỒN SỰ THẬT; RLS policy đọc trực tiếp từ chúng nên không thể bypass bằng
 * cách gọi thẳng repository (gói M2).
 * ──────────────────────────────────────────────────────────────────────────── */

export const permissions = pgTable(
  'permissions',
  {
    id: serial('id').primaryKey(),
    /** VD: `SUBMISSION.APPROVE`, `ORGANIZATION.EDIT`. */
    permissionCode: text('permission_code').notNull(),
    resourceType: text('resource_type').notNull(),
    action: text('action').notNull(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en'),
    moduleCode: text('module_code'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_permissions_code').on(t.permissionCode).where(sql`deleted_at IS NULL`),
    index('ix_permissions_resource').on(t.resourceType, t.action),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: serial('id').primaryKey(),
    roleCode: text('role_code').$type<UserRoleCode>().notNull(),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id),
    /**
     * Trục 3 — chỉ cho phép hành động khi bản ghi đang ở một trong các trạng
     * thái này. NULL = không ràng buộc trạng thái.
     */
    allowedStatuses: jsonb('allowed_statuses').$type<string[] | null>(),
    effect: text('effect').$type<'ALLOW' | 'DENY'>().notNull().default('ALLOW'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_role_permissions_role_permission')
      .on(t.roleCode, t.permissionId)
      .where(sql`deleted_at IS NULL`),
    index('ix_role_permissions_role').on(t.roleCode),
  ],
);

export const dataScopeGrants = pgTable(
  'data_scope_grants',
  {
    id: serial('id').primaryKey(),
    subjectType: text('subject_type').$type<'USER' | 'ROLE' | 'UNIT'>().notNull(),
    /** ID người dùng, mã vai trò, hoặc mã đơn vị tuỳ `subject_type`. */
    subjectRef: text('subject_ref').notNull(),
    dimension: text('dimension')
      .$type<'ORGANIZATION' | 'BOARD' | 'SECURITY_TYPE' | 'NEWS_GROUP' | 'UNIT' | 'INDUSTRY'>()
      .notNull(),
    operator: text('operator').$type<'IN' | 'NOT_IN' | 'ALL'>().notNull(),
    valuesList: jsonb('values_list').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    effect: text('effect').$type<'ALLOW' | 'DENY'>().notNull().default('ALLOW'),
    ...auditColumns,
  },
  (t) => [
    index('ix_data_scope_grants_subject').on(t.subjectType, t.subjectRef),
    index('ix_data_scope_grants_dimension').on(t.dimension),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Form Engine — metadata form động (NT1)
 * ──────────────────────────────────────────────────────────────────────────── */

export const fieldDefinitions = pgTable(
  'field_definitions',
  {
    id: serial('id').primaryKey(),
    fieldCode: text('field_code').notNull(),
    dataType: text('data_type')
      .$type<
        | 'TEXT'
        | 'LONGTEXT'
        | 'NUMBER'
        | 'DECIMAL'
        | 'DATE'
        | 'DATETIME'
        | 'BOOLEAN'
        | 'PICKLIST'
        | 'MULTI_PICKLIST'
        | 'FILE'
        | 'TABLE'
        | 'RICHTEXT'
        | 'FORMULA'
      >()
      .notNull(),
    nodeType: text('node_type').$type<'ROOT' | 'GROUP' | 'FIELD'>().notNull().default('FIELD'),
    lookupCatalogCode: text('lookup_catalog_code'),
    isRepeatable: boolean('is_repeatable').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    defaultValue: text('default_value'),
    validationJson: jsonb('validation_json').$type<{
      required?: boolean;
      min?: number;
      max?: number;
      minLen?: number;
      maxLen?: number;
      regex?: string;
    }>(),
    formulaExpr: text('formula_expr'),
    /** True khi đã có submission dùng field này ⇒ cấm sửa phá vỡ dữ liệu cũ. */
    hasData: boolean('has_data').notNull().default(false),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_field_definitions_code_current')
      .on(t.fieldCode)
      .where(sql`is_current AND deleted_at IS NULL`),
  ],
);

export const fieldDefinitionTranslations = pgTable(
  'field_definition_translations',
  {
    id: serial('id').primaryKey(),
    fieldDefinitionId: integer('field_definition_id')
      .notNull()
      .references(() => fieldDefinitions.id),
    lang: text('lang').$type<'vi' | 'en'>().notNull(),
    label: text('label').notNull(),
    placeholder: text('placeholder'),
    helpText: text('help_text'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_field_definition_translations_field_lang')
      .on(t.fieldDefinitionId, t.lang)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const templateDefinitions = pgTable(
  'template_definitions',
  {
    id: serial('id').primaryKey(),
    templateCode: text('template_code').notNull(),
    templateKind: text('template_kind')
      .$type<'DISCLOSURE_NEWS' | 'DOSSIER' | 'FINANCIAL_STMT' | 'DATA_STRUCTURE'>()
      .notNull(),
    newsTypeCode: text('news_type_code'),
    newsGroupCode: text('news_group_code').$type<NewsGroupCode>(),
    ownerUnitCode: text('owner_unit_code'),
    workflowDefCode: text('workflow_def_code'),
    autoApprove: boolean('auto_approve').notNull().default(false),
    requireCaSign: boolean('require_ca_sign').notNull().default(false),
    postAudit: boolean('post_audit').notNull().default(false),
    autoTranslate: boolean('auto_translate').notNull().default(false),
    titleFormula: text('title_formula'),
    /**
     * NT5 — chỉ khai báo mốc tính hạn ở dạng dữ liệu; việc quy đổi ra ngày thật
     * do BusinessCalendarService làm. `calendarBasis` là bổ sung của v1.2 để
     * phân biệt ngày dương lịch / ngày làm việc / ngày giao dịch.
     */
    deadlineRuleJson: jsonb('deadline_rule_json').$type<{
      basis: 'PERIOD_END' | 'EVENT_DATE';
      calendarBasis: 'CALENDAR' | 'WORKING' | 'TRADING';
      offsetDays?: number;
      offsetHours?: number;
    }>(),
    isActive: boolean('is_active').notNull().default(true),
    inUse: boolean('in_use').notNull().default(false),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_template_definitions_code_current')
      .on(t.templateCode)
      .where(sql`is_current AND deleted_at IS NULL`),
    index('ix_template_definitions_kind').on(t.templateKind),
  ],
);

export const templateDefinitionTranslations = pgTable(
  'template_definition_translations',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id')
      .notNull()
      .references(() => templateDefinitions.id),
    lang: text('lang').$type<'vi' | 'en'>().notNull(),
    name: text('name').notNull(),
    description: text('description'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_template_definition_translations_template_lang')
      .on(t.templateId, t.lang)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const templateFields = pgTable(
  'template_fields',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id')
      .notNull()
      .references(() => templateDefinitions.id),
    fieldDefinitionId: integer('field_definition_id')
      .notNull()
      .references(() => fieldDefinitions.id),
    sectionCode: text('section_code'),
    sortOrder: integer('sort_order').notNull().default(0),
    colSpan: integer('col_span').notNull().default(24),
    isRequired: boolean('is_required').notNull().default(false),
    isReadonly: boolean('is_readonly').notNull().default(false),
    isIndexed: boolean('is_indexed').notNull().default(false),
    visibleForRoles: jsonb('visible_for_roles').$type<string[] | null>(),
    editableForRoles: jsonb('editable_for_roles').$type<string[] | null>(),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_template_fields_template_field')
      .on(t.templateId, t.fieldDefinitionId)
      .where(sql`deleted_at IS NULL`),
    index('ix_template_fields_template').on(t.templateId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 6. Workflow Engine (NT1)
 * ──────────────────────────────────────────────────────────────────────────── */

export const workflowDefinitions = pgTable(
  'workflow_definitions',
  {
    id: serial('id').primaryKey(),
    workflowCode: text('workflow_code').notNull(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en'),
    entityType: text('entity_type').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_workflow_definitions_code_current')
      .on(t.workflowCode)
      .where(sql`is_current AND deleted_at IS NULL`),
  ],
);

export const workflowSteps = pgTable(
  'workflow_steps',
  {
    id: serial('id').primaryKey(),
    workflowDefId: integer('workflow_def_id')
      .notNull()
      .references(() => workflowDefinitions.id),
    stepCode: text('step_code').notNull(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en'),
    statusCode: text('status_code').notNull(),
    assigneeRoleCode: text('assignee_role_code').$type<UserRoleCode>(),
    /** NT5 — SLA khai báo bằng số lượng + hệ lịch, không quy ra ngày ở đây. */
    slaAmount: integer('sla_amount'),
    slaCalendarBasis: text('sla_calendar_basis').$type<'CALENDAR' | 'WORKING' | 'TRADING'>(),
    isStart: boolean('is_start').notNull().default(false),
    isTerminal: boolean('is_terminal').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_workflow_steps_def_code')
      .on(t.workflowDefId, t.stepCode)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const workflowTransitions = pgTable(
  'workflow_transitions',
  {
    id: serial('id').primaryKey(),
    workflowDefId: integer('workflow_def_id')
      .notNull()
      .references(() => workflowDefinitions.id),
    fromStepId: integer('from_step_id').references(() => workflowSteps.id),
    toStepId: integer('to_step_id')
      .notNull()
      .references(() => workflowSteps.id),
    actionCode: text('action_code').notNull(),
    nameVi: text('name_vi').notNull(),
    nameEn: text('name_en'),
    /** Biểu thức guard dạng text, do Workflow Engine đánh giá (gói M4). */
    guardExpr: text('guard_expr'),
    allowedRoleCodes: jsonb('allowed_role_codes').$type<string[] | null>(),
    /** Cưỡng chế kiểm soát kép: người thực hiện phải khác người ở bước trước. */
    requireDualControl: boolean('require_dual_control').notNull().default(false),
    requireReason: boolean('require_reason').notNull().default(false),
    /** True ⇒ chuyển tiếp này là "approved-edit" ⇒ sinh version mới (CR1 v1.2). */
    createsNewVersion: boolean('creates_new_version').notNull().default(false),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_workflow_transitions_def_from_action')
      .on(t.workflowDefId, t.fromStepId, t.actionCode)
      .where(sql`deleted_at IS NULL`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 7. Rule Engine (NT1)
 * ──────────────────────────────────────────────────────────────────────────── */

export const ruleDefinitions = pgTable(
  'rule_definitions',
  {
    id: serial('id').primaryKey(),
    ruleCode: text('rule_code').notNull(),
    ruleType: text('rule_type')
      .$type<'VALIDATION' | 'WARNING' | 'DEADLINE' | 'ESCALATION'>()
      .notNull(),
    legalBasis: text('legal_basis'),
    severity: text('severity').$type<'INFO' | 'WARNING' | 'CRITICAL'>().notNull().default('WARNING'),
    appliesToEntity: text('applies_to_entity'),
    /** Hệ lịch dùng khi rule tính mốc thời gian (v1.2 Tính năng A). */
    calendarBasis: text('calendar_basis').$type<'CALENDAR' | 'WORKING' | 'TRADING'>(),
    isActive: boolean('is_active').notNull().default(true),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_rule_definitions_code_current')
      .on(t.ruleCode)
      .where(sql`is_current AND deleted_at IS NULL`),
  ],
);

export const ruleDefinitionTranslations = pgTable(
  'rule_definition_translations',
  {
    id: serial('id').primaryKey(),
    ruleDefId: integer('rule_def_id')
      .notNull()
      .references(() => ruleDefinitions.id),
    lang: text('lang').$type<'vi' | 'en'>().notNull(),
    name: text('name').notNull(),
    description: text('description'),
    suggestedAction: text('suggested_action'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_rule_definition_translations_rule_lang')
      .on(t.ruleDefId, t.lang)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const ruleParameters = pgTable(
  'rule_parameters',
  {
    id: serial('id').primaryKey(),
    ruleDefId: integer('rule_def_id')
      .notNull()
      .references(() => ruleDefinitions.id),
    paramCode: text('param_code').notNull(),
    paramValue: text('param_value').notNull(),
    paramType: text('param_type')
      .$type<'NUMBER' | 'TEXT' | 'DATE' | 'BOOLEAN'>()
      .notNull()
      .default('TEXT'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_rule_parameters_rule_code')
      .on(t.ruleDefId, t.paramCode)
      .where(sql`deleted_at IS NULL`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 8. Nghiệp vụ — hồ sơ, nghĩa vụ, cảnh báo
 * ──────────────────────────────────────────────────────────────────────────── */

export const submissions = pgTable(
  'submissions',
  {
    id: serial('id').primaryKey(),
    submissionNo: text('submission_no').notNull(),
    templateId: integer('template_id')
      .notNull()
      .references(() => templateDefinitions.id),
    templateKind: text('template_kind').notNull(),
    newsGroupCode: text('news_group_code').$type<NewsGroupCode>(),
    organizationId: integer('organization_id').references(() => organizations.id),
    securityId: integer('security_id').references(() => securities.id),
    title: text('title').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    periodCode: text('period_code'),
    periodEndDate: date('period_end_date'),
    /** NT5 — luôn do BusinessCalendarService sinh, không bao giờ cộng ngày trực tiếp. */
    dueDate: timestamp('due_date', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    caSignedAt: timestamp('ca_signed_at', { withTimezone: true }),
    isLate: boolean('is_late').notNull().default(false),
    lateDays: integer('late_days'),
    status: text('status').$type<SubmissionStatus>().notNull().default('DRAFT'),
    workflowInstanceId: integer('workflow_instance_id'),
    /**
     * NT4 — bản tiếng Anh là MỘT BẢN GHI RIÊNG trỏ về bản gốc qua
     * `source_submission_id`, không phải cột `title_en` trên cùng dòng.
     */
    lang: text('lang').$type<'vi' | 'en'>().notNull().default('vi'),
    sourceSubmissionId: integer('source_submission_id'),
    translationStatus: text('translation_status').$type<
      'NONE' | 'AI_DRAFT' | 'HUMAN_REVIEWED' | 'APPROVED'
    >(),
    correctionOfId: integer('correction_of_id'),
    correctionType: text('correction_type').$type<'MINOR_EDIT' | 'MATERIAL_CORRECTION'>(),
    isPublic: boolean('is_public').notNull().default(false),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenBy: integer('hidden_by'),
    hideReason: text('hide_reason'),
    ...baseColumns,
  },
  (t) => [
    /** CR1 v1.2 — mỗi (số hồ sơ, ngôn ngữ) chỉ có đúng một bản hiện hành. */
    uniqueIndex('uq_submissions_no_lang_current')
      .on(t.submissionNo, t.lang)
      .where(sql`is_current AND deleted_at IS NULL`),
    index('ix_submissions_organization').on(t.organizationId),
    index('ix_submissions_status').on(t.status),
    index('ix_submissions_due_date').on(t.dueDate),
    index('ix_submissions_source').on(t.sourceSubmissionId),
    index('ix_submissions_parent').on(t.parentId),
  ],
);

export const attachments = pgTable(
  'attachments',
  {
    id: serial('id').primaryKey(),
    submissionId: integer('submission_id').references(() => submissions.id),
    organizationId: integer('organization_id').references(() => organizations.id),
    fieldCode: text('field_code'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    isPublic: boolean('is_public').notNull().default(false),
    ...auditColumns,
  },
  (t) => [index('ix_attachments_submission').on(t.submissionId)],
);

export const disclosureObligations = pgTable(
  'disclosure_obligations',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    securityId: integer('security_id').references(() => securities.id),
    templateId: integer('template_id')
      .notNull()
      .references(() => templateDefinitions.id),
    periodCode: text('period_code').notNull(),
    periodEndDate: date('period_end_date'),
    /** NT5 — sinh bởi BusinessCalendarService từ deadline_rule_json của template. */
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    fulfilledBySubmissionId: integer('fulfilled_by_submission_id').references(() => submissions.id),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    status: text('status')
      .$type<'PENDING' | 'FULFILLED' | 'LATE' | 'WAIVED'>()
      .notNull()
      .default('PENDING'),
    lateDays: integer('late_days'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_disclosure_obligations_org_template_period')
      .on(t.organizationId, t.templateId, t.periodCode)
      .where(sql`deleted_at IS NULL`),
    index('ix_disclosure_obligations_due_date').on(t.dueDate),
    index('ix_disclosure_obligations_organization').on(t.organizationId),
  ],
);

export const alerts = pgTable(
  'alerts',
  {
    id: serial('id').primaryKey(),
    ruleDefId: integer('rule_def_id')
      .notNull()
      .references(() => ruleDefinitions.id),
    organizationId: integer('organization_id').references(() => organizations.id),
    securityId: integer('security_id').references(() => securities.id),
    severity: text('severity').$type<'INFO' | 'WARNING' | 'CRITICAL'>().notNull(),
    title: text('title').notNull(),
    evidenceJson: jsonb('evidence_json').$type<Record<string, unknown>>(),
    status: text('status')
      .$type<'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'>()
      .notNull()
      .default('NEW'),
    ...auditColumns,
  },
  (t) => [
    index('ix_alerts_organization').on(t.organizationId),
    index('ix_alerts_status').on(t.status),
  ],
);

export const workflowTasks = pgTable(
  'workflow_tasks',
  {
    id: serial('id').primaryKey(),
    workflowDefId: integer('workflow_def_id')
      .notNull()
      .references(() => workflowDefinitions.id),
    stepId: integer('step_id')
      .notNull()
      .references(() => workflowSteps.id),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    organizationId: integer('organization_id').references(() => organizations.id),
    assigneeUserId: integer('assignee_user_id').references(() => userAccounts.id),
    assigneeRoleCode: text('assignee_role_code').$type<UserRoleCode>(),
    /** NT5 — do BusinessCalendarService tính từ SLA của step. */
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: integer('completed_by').references(() => userAccounts.id),
    status: text('status')
      .$type<'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>()
      .notNull()
      .default('OPEN'),
    ...auditColumns,
  },
  (t) => [
    index('ix_workflow_tasks_entity').on(t.entityType, t.entityId),
    index('ix_workflow_tasks_assignee').on(t.assigneeUserId),
    index('ix_workflow_tasks_organization').on(t.organizationId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 9. Audit Engine — append-only (MT3 v1.2)
 *
 * KHÔNG có soft delete, KHÔNG có version: bản ghi audit chỉ được INSERT.
 * Quyền UPDATE/DELETE bị thu hồi khỏi runtime role ở migration SQL — đó mới là
 * thứ khiến "append-only" trở thành ràng buộc thật chứ không phải quy ước.
 * ──────────────────────────────────────────────────────────────────────────── */

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorId: integer('actor_id'),
    actorName: text('actor_name'),
    actorRole: text('actor_role'),
    actorIp: text('actor_ip'),
    correlationId: text('correlation_id'),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    entityLabel: text('entity_label'),
    organizationId: integer('organization_id'),
    action: text('action').notNull(),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    diffJson: jsonb('diff_json'),
    reason: text('reason'),
    result: text('result').$type<'SUCCESS' | 'FAILED'>().notNull().default('SUCCESS'),
  },
  (t) => [
    index('ix_audit_logs_entity').on(t.entityType, t.entityId),
    index('ix_audit_logs_occurred_at').on(t.occurredAt),
    index('ix_audit_logs_correlation').on(t.correlationId),
    index('ix_audit_logs_organization').on(t.organizationId),
  ],
);

export const workflowHistory = pgTable(
  'workflow_history',
  {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    organizationId: integer('organization_id'),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    actionCode: text('action_code').notNull(),
    actorId: integer('actor_id'),
    actorRole: text('actor_role'),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ix_workflow_history_entity').on(t.entityType, t.entityId),
    index('ix_workflow_history_organization').on(t.organizationId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────────
 * 10. Business case — hồ sơ nghiệp vụ (niêm yết mới, sửa đổi, huỷ)
 * ──────────────────────────────────────────────────────────────────────────── */

export const businessCases = pgTable(
  'business_cases',
  {
    id: serial('id').primaryKey(),
    caseNo: text('case_no').notNull(),
    caseType: text('case_type').notNull(),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    securityId: integer('security_id').references(() => securities.id),
    templateId: integer('template_id').references(() => templateDefinitions.id),
    title: text('title').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: text('status').$type<BusinessCaseStatus>().notNull().default('PENDING'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    /** NT5 — hạn thẩm định, do BusinessCalendarService tính. */
    appraisalDueAt: timestamp('appraisal_due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...baseColumns,
  },
  (t) => [
    uniqueIndex('uq_business_cases_no_current')
      .on(t.caseNo)
      .where(sql`is_current AND deleted_at IS NULL`),
    index('ix_business_cases_organization').on(t.organizationId),
    index('ix_business_cases_status').on(t.status),
  ],
);
