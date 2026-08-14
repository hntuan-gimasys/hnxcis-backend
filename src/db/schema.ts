import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  fullName: text('full_name'),
  roleCode: text('role_code').notNull().default('COMPLIANCE_OFFICER'),
  organizationId: integer('organization_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  orgCode: text('org_code').notNull().unique(),
  shortName: text('short_name').notNull(),
  nameVi: text('name_vi').notNull(),
  taxCode: text('tax_code'),
  listingStatus: text('listing_status').default('LISTED'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const securities = pgTable('securities', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  organizationId: integer('organization_id').references(() => organizations.id),
  securityType: text('security_type').notNull(), // EQUITY / BOND
  createdAt: timestamp('created_at').defaultNow(),
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  submissionNo: text('submission_no').notNull().unique(),
  organizationId: integer('organization_id').references(() => organizations.id),
  securityId: integer('security_id').references(() => securities.id),
  templateId: integer('template_id'),
  templateKind: text('template_kind'),
  newsGroupCode: text('news_group_code'),
  titleVi: text('title_vi').notNull(),
  payload: jsonb('payload'),
  status: text('status').notNull().default('DRAFT'),
  submittedAt: timestamp('submitted_at'),
  isPublic: boolean('is_public').default(false),
  lang: text('lang').default('vi'),
  versionNo: integer('version_no').default(1),
  isCurrent: boolean('is_current').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  actionCode: text('action_code').notNull(),
  actorId: integer('actor_id'),
  diffData: jsonb('diff_data'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [submissions.organizationId],
    references: [organizations.id],
  }),
  security: one(securities, {
    fields: [submissions.securityId],
    references: [securities.id],
  }),
}));
