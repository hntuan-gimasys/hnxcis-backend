/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ActorType = 'HNX' | 'ORGANIZATION' | 'EXTERNAL' | 'PUBLIC';

export type UserRoleCode =
  | 'ROLE_SYS_ADMIN'
  | 'ROLE_BIZ_ADMIN'
  | 'ROLE_QLNY_STAFF'
  | 'ROLE_QLNY_MANAGER'
  | 'ROLE_TTTP_STAFF'
  | 'ROLE_TTTP_MANAGER'
  | 'ROLE_TTTT_STAFF'
  | 'ROLE_TTTT_MANAGER'
  | 'ROLE_HTGD_STAFF'
  | 'ROLE_HNX_EXEC'
  | 'ROLE_ORG_STAFF'
  | 'ROLE_ORG_MANAGER'
  | 'ROLE_TREASURY'
  | 'ROLE_INVESTOR'
  | 'ROLE_PUBLIC';

export type SecurityType = 'EQUITY' | 'BOND_LISTED' | 'BOND_PRIVATE' | 'BOND_GREEN';
export type BoardType = 'HNX' | 'UPCOM' | 'PRIVATE_BOND';

export type SecurityStatus =
  | 'NORMAL'
  | 'WARNING'
  | 'CONTROL'
  | 'TRADING_RESTRICTED'
  | 'TRADING_HALT'
  | 'DELISTED';

export type BondStatus = 'LISTED' | 'SUSPENDED' | 'MATURED' | 'DELISTED';

export type SubmissionStatus =
  | 'DRAFT'
  | 'PENDING_ORG_APPROVAL'
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'REVIEWED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'CORRECTED'
  | 'HIDDEN'
  | 'CANCELLED'
  | 'ARCHIVED';

export type BusinessCaseStatus =
  | 'PENDING'
  | 'IN_APPRAISAL'
  | 'AWAITING_SUPPLEMENT'
  | 'PENDING_APPROVAL'
  | 'RETURNED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type NewsGroupCode =
  | 'PERIODIC'
  | 'EXTRAORDINARY'
  | 'BOND'
  | 'TRADING'
  | 'ON_DEMAND'
  | 'HNX_NEWS';

export interface BaseEntity {
  id: number;
  createdAt: string;
  createdBy: number;
  updatedAt?: string;
  updatedBy?: number;
  deletedAt?: string;
  deletedBy?: number;
  deleteReason?: string;
  versionNo: number;
  isCurrent: boolean;
  parentId?: number;
}

export interface Organization extends BaseEntity {
  taxCode: string;
  nameVi: string;
  nameEn?: string;
  shortName: string;
  orgType: 'LISTED' | 'UPCOM_REGISTERED' | 'PRIVATE_BOND_ISSUER' | 'STARTUP';
  businessRegNo: string;
  businessRegDate: string;
  charterCapital: number;
  industryCode: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  legalRepName: string;
  disclosureRepName: string;
  disclosureRepEmail: string;
  isPublicCompany: boolean;
  publicCompanyDate?: string;
  status: 'APPROVED' | 'PENDING' | 'SUSPENDED';
}

export interface SecurityItem extends BaseEntity {
  organizationId: number;
  symbol: string;
  securityType: SecurityType;
  board: BoardType;
  isin?: string;
  status: SecurityStatus;
  listingStatusNote?: string;
}

export interface EquityProfile extends BaseEntity {
  securityId: number;
  equityName: string;
  firstTradingDate?: string;
  issuedQuantity: number;
  listedQuantity: number;
  outstandingQuantity: number;
  treasuryQuantity: number;
  listingDecisionDate: string;
  listingDecisionNo: string;
  delistingDate?: string;
  securityStatus: SecurityStatus;
  marginEligible: boolean;
  firstDayRefPrice: number;
  listingBoard: BoardType;
}

export interface BondProfile extends BaseEntity {
  securityId: number;
  bondCode: string;
  issueDate: string;
  parValue: number;
  listedQuantity: number;
  totalParValue: number;
  maturityDate: string;
  interestRateDesc: string;
  interestRateType: 'FIXED' | 'FLOATING' | 'FORMULA';
  interestRateValue: number;
  bondStatus: BondStatus;
  isGreenBond: boolean;
  isPrivatePlacement: boolean;
  isConvertible: boolean;
  creditRating?: string;
  creditRatingAgency?: string;
}

export interface BondPaymentSchedule {
  id: number;
  bondProfileId: number;
  periodNo: number;
  paymentType: 'PRINCIPAL' | 'INTEREST' | 'BOTH';
  plannedDate: string;
  principalAmount: number;
  interestAmount: number;
  actualDate?: string;
  actualAmount?: number;
  paymentStatus: 'PLANNED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'DEFAULTED';
}

export interface Investor extends BaseEntity {
  investorType: 'INDIVIDUAL' | 'ORGANIZATION';
  identityNo: string;
  identityType: 'CITIZEN_ID' | 'PASSPORT' | 'TAX_CODE';
  fullName: string;
  fullNameEn?: string;
  nationality: string;
  address: string;
  phone?: string;
  email?: string;
  linkedOrgId?: number;
}

export interface SecurityOwnership extends BaseEntity {
  securityId: number;
  investorId: number;
  holderRole: 'MAJOR_SHAREHOLDER' | 'FOUNDING' | 'INTERNAL' | 'RELATED' | 'STATE' | 'FOREIGN';
  quantity: number;
  ownershipPct: number;
  asOfDate: string;
  unlinkedAt?: string;
  unlinkReason?: string;
}

export interface FieldDefinition extends BaseEntity {
  fieldCode: string;
  parentId?: number;
  labelVi: string;
  labelEn?: string;
  dataType:
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
    | 'FORMULA';
  lookupCatalogCode?: string;
  isRepeatable: boolean;
  nodeType: 'ROOT' | 'GROUP' | 'FIELD';
  sortOrder: number;
  defaultValue?: string;
  validationJson?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLen?: number;
    maxLen?: number;
    regex?: string;
  };
  formulaExpr?: string;
  hasData: boolean;
}

export interface TemplateDefinition extends BaseEntity {
  templateCode: string;
  nameVi: string;
  nameEn?: string;
  templateKind: 'DISCLOSURE_NEWS' | 'DOSSIER' | 'FINANCIAL_STMT' | 'DATA_STRUCTURE';
  newsTypeCode?: string;
  newsGroupCode?: NewsGroupCode;
  ownerUnitCode?: string;
  autoApprove: boolean;
  requireCaSign: boolean;
  postAudit: boolean;
  workflowDefCode: string;
  titleFormula?: string;
  deadlineRuleJson?: {
    basis: 'PERIOD_END' | 'EVENT_DATE';
    offsetWorkingDays?: number;
    offsetHours?: number;
  };
  isActive: boolean;
  inUse: boolean;
  autoTranslate: boolean;
}

export interface TemplateField extends BaseEntity {
  templateId: number;
  fieldDefinitionId: number;
  labelOverrideVi?: string;
  labelOverrideEn?: string;
  sectionCode: string;
  sortOrder: number;
  colSpan: number;
  isRequired: boolean;
  isReadonly: boolean;
  isIndexed: boolean;
  visibleForRoles?: string[];
  editableForRoles?: string[];
}

export interface Submission extends BaseEntity {
  submissionNo: string;
  templateId: number;
  templateKind: string;
  newsGroupCode?: NewsGroupCode;
  organizationId?: number;
  securityId?: number;
  titleVi: string;
  titleEn?: string;
  payload: Record<string, any>;
  periodCode?: string;
  periodEndDate?: string;
  dueDate?: string;
  submittedAt?: string;
  receivedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  publishedAt?: string;
  isLate?: boolean;
  lateDays?: number;
  status: SubmissionStatus;
  workflowInstanceId?: number;
  lang: 'vi' | 'en';
  sourceSubmissionId?: number;
  translationStatus?: 'NONE' | 'AI_DRAFT' | 'HUMAN_REVIEWED' | 'APPROVED';
  correctionOfId?: number;
  correctionType?: 'MINOR_EDIT' | 'MATERIAL_CORRECTION';
  isPublic: boolean;
  hiddenAt?: string;
  hiddenBy?: number;
  hideReason?: string;
  caSignedAt?: string;
  attachments?: Attachment[];
}

export interface Attachment extends BaseEntity {
  submissionId?: number;
  fieldCode?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checksumSha256: string;
  isPublic: boolean;
}

export interface WorkflowDefinition {
  id: number;
  code: string;
  nameVi: string;
  targetType: 'SUBMISSION' | 'BUSINESS_CASE' | 'ACCOUNT_REQUEST' | 'CONFIG_CHANGE';
  versionNo: number;
  status: 'ACTIVE' | 'DRAFT' | 'SUSPENDED';
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
}

export interface WorkflowStep {
  id: number;
  workflowDefId: number;
  stepCode: string;
  nameVi: string;
  stepType: 'START' | 'TASK' | 'DECISION' | 'END';
  assigneeMode: 'ROLE' | 'UNIT' | 'SPECIFIC_USER' | 'SUBMITTER_ORG';
  assigneeRef: string[];
  slaWorkingDays?: number;
  allowBulkAction: boolean;
  requireReasonOnReject: boolean;
  dualControl: boolean;
  sortOrder: number;
}

export interface WorkflowTransition {
  id: number;
  workflowDefId: number;
  fromStepCode: string;
  toStepCode: string;
  actionCode: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'REVIEW' | 'PUBLISH' | 'CANCEL' | 'SUPPLEMENT';
  labelVi: string;
  guardExpr?: string;
  targetStatus: string;
}

export interface WorkflowTask {
  id: number;
  instanceId: number;
  targetType: string;
  targetId: number;
  targetNo: string;
  targetTitle: string;
  stepCode: string;
  stepName: string;
  assignedRole: string;
  status: 'OPEN' | 'CLAIMED' | 'DONE' | 'SKIPPED';
  dueAt: string;
  completedAt?: string;
  actionTaken?: string;
  rejectReason?: string;
  isOverdue: boolean;
  organizationName?: string;
}

export interface WorkflowHistory {
  id: number;
  instanceId: number;
  seqNo: number;
  fromStep?: string;
  toStep?: string;
  actionCode: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  comment?: string;
  reason?: string;
  occurredAt: string;
}

export interface RuleDefinition extends BaseEntity {
  ruleCode: string;
  nameVi: string;
  ruleGroup:
    | 'STATUS_WARNING'
    | 'STATUS_CONTROL'
    | 'TRADING_RESTRICTION'
    | 'TRADING_SUSPENSION'
    | 'RELLESTING'
    | 'MANDATORY_DELIST'
    | 'BOND_DELIST'
    | 'UPCOM_DELIST'
    | 'MARGIN_INELIGIBLE'
    | 'MARGIN_RESTORE'
    | 'TRADE_VIOLATION'
    | 'DISCLOSURE_VIOLATION';
  legalBasis: string;
  direction: 'ENTER' | 'EXIT';
  conditionExpr: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  autoCreateCase: boolean;
  targetCaseType?: string;
  isActive: boolean;
  parameters: RuleParameter[];
}

export interface RuleParameter {
  id: number;
  ruleDefId: number;
  paramCode: string;
  paramLabelVi: string;
  dataType: string;
  paramValue: string;
  unit?: string;
  effectiveFrom: string;
}

export interface Alert extends BaseEntity {
  ruleDefId: number;
  ruleCode: string;
  ruleName: string;
  legalBasis: string;
  organizationId?: number;
  organizationName?: string;
  securityId?: number;
  symbol?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  titleVi: string;
  evidenceJson: Record<string, any>;
  suggestedAction?: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'CONFIRMED' | 'DISMISSED' | 'CASE_CREATED';
  handledBy?: number;
  handledAt?: string;
  dismissReason?: string;
  businessCaseId?: number;
}

export interface BusinessCase extends BaseEntity {
  caseNo: string;
  caseType: string;
  organizationId?: number;
  organizationName?: string;
  securityId?: number;
  symbol?: string;
  submissionId?: number;
  sourceAlertId?: number;
  status: BusinessCaseStatus;
  decisionNo?: string;
  decisionDate?: string;
  effectiveDate?: string;
  reasonCode?: string;
  reasonDetail?: string;
  tags?: string[];
  internalNote?: string;
  slaDueAt?: string;
}

export interface DisclosureObligation extends BaseEntity {
  organizationId: number;
  organizationName: string;
  symbol?: string;
  securityId?: number;
  templateId: number;
  templateName: string;
  newsGroupCode: NewsGroupCode;
  periodCode: string;
  periodEndDate: string;
  dueDate: string;
  submissionId?: number;
  fulfilledAt?: string;
  status: 'PENDING' | 'SUBMITTED' | 'FULFILLED' | 'LATE' | 'MISSING' | 'WAIVED';
  lateDays?: number;
}

export interface FeeSchema extends BaseEntity {
  schemaCode: string;
  nameVi: string;
  feeType: 'INITIAL_LISTING' | 'ANNUAL_MAINTENANCE' | 'ADDITIONAL_LISTING' | 'UPCOM_REG';
  formulaExpr: string;
  minAmount?: number;
  maxAmount?: number;
  prorateBasis?: 'DAY' | 'MONTH' | 'NONE';
  effectiveFrom: string;
}

export interface FeeRecord extends BaseEntity {
  feeSchemaId: number;
  organizationId: number;
  securityId?: number;
  businessCaseId?: number;
  periodFrom: string;
  periodTo: string;
  calcBasisJson: Record<string, any>;
  calculatedAmount: number;
  adjustedAmount?: number;
  adjustReason?: string;
  finalAmount: number;
  calcMode: 'AUTO' | 'MANUAL';
  paymentStatus: 'UNPAID' | 'CONFIRMED' | 'WAIVED';
  paymentConfirmedAt?: string;
  paymentConfirmedBy?: number;
  paymentRef?: string;
}

export interface AuditLog {
  id: number;
  occurredAt: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  actorIp: string;
  correlationId: string;
  entityType: string;
  entityId: number;
  entityLabel: string;
  action: string;
  beforeJson?: any;
  afterJson?: any;
  diffJson?: any;
  reason?: string;
  result: 'SUCCESS' | 'FAILED';
}

export interface NotificationItem extends BaseEntity {
  direction: 'OUTBOUND' | 'INBOUND';
  recipientUserId?: number;
  recipientOrgId?: number;
  senderUserId?: number;
  senderName?: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  subject: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  deepLink?: string;
  notificationType: 'REMINDER' | 'EXPLANATION_REQUEST' | 'SUPPLEMENT_REQUEST' | 'COMPLIANCE' | 'GENERAL';
  priority: 'NORMAL' | 'HIGH';
  sendStatus: 'QUEUED' | 'SENT' | 'FAILED';
  sentAt?: string;
  readAt?: string;
}

export interface UserAccount extends BaseEntity {
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  actorType: ActorType;
  organizationId?: number;
  unitCode?: string;
  position?: string;
  status: 'ACTIVE' | 'PENDING' | 'LOCKED' | 'DISABLED';
  roleCode: UserRoleCode;
  dataScope?: DataScopeGrant[];
}

export interface DataScopeGrant {
  id: number;
  subjectType: 'USER' | 'ROLE' | 'UNIT';
  subjectRef: string;
  dimension: 'ORGANIZATION' | 'BOARD' | 'SECURITY_TYPE' | 'NEWS_GROUP' | 'UNIT' | 'INDUSTRY';
  operator: 'IN' | 'NOT_IN' | 'ALL';
  valuesList: string[];
  effect: 'ALLOW' | 'DENY';
}

export interface CatalogItem {
  id: number;
  catalogCode: string;
  code: string;
  nameVi: string;
  nameEn?: string;
  parentCode?: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
}
