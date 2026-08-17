CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_def_id" integer NOT NULL,
	"organization_id" integer,
	"security_id" integer,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"evidence_json" jsonb,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer,
	"organization_id" integer,
	"field_code" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"actor_role" text,
	"actor_ip" text,
	"correlation_id" text,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"entity_label" text,
	"organization_id" integer,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"diff_json" jsonb,
	"reason" text,
	"result" text DEFAULT 'SUCCESS' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_no" text NOT NULL,
	"case_type" text NOT NULL,
	"organization_id" integer NOT NULL,
	"security_id" integer,
	"template_id" integer,
	"title" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"received_at" timestamp with time zone,
	"appraisal_due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "catalog_item_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalog_item_id" integer NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalog_code" text NOT NULL,
	"code" text NOT NULL,
	"parent_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "data_scope_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_ref" text NOT NULL,
	"dimension" text NOT NULL,
	"operator" text NOT NULL,
	"values_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effect" text DEFAULT 'ALLOW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "disclosure_obligations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"security_id" integer,
	"template_id" integer NOT NULL,
	"period_code" text NOT NULL,
	"period_end_date" date,
	"due_date" timestamp with time zone NOT NULL,
	"fulfilled_by_submission_id" integer,
	"fulfilled_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"late_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "field_definition_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_definition_id" integer NOT NULL,
	"lang" text NOT NULL,
	"label" text NOT NULL,
	"placeholder" text,
	"help_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "field_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_code" text NOT NULL,
	"data_type" text NOT NULL,
	"node_type" text DEFAULT 'FIELD' NOT NULL,
	"lookup_catalog_code" text,
	"is_repeatable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_value" text,
	"validation_json" jsonb,
	"formula_expr" text,
	"has_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "holiday_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"year" integer NOT NULL,
	"holiday_type" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text,
	"legal_basis" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "organization_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"address" text,
	"industry_name" text,
	"translation_status" text DEFAULT 'NONE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_code" text NOT NULL,
	"tax_code" text NOT NULL,
	"short_name" text NOT NULL,
	"org_type" text NOT NULL,
	"business_reg_no" text,
	"business_reg_date" date,
	"charter_capital" numeric(20, 0),
	"industry_code" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"legal_rep_name" text,
	"disclosure_rep_name" text,
	"disclosure_rep_email" text,
	"is_public_company" boolean DEFAULT false NOT NULL,
	"public_company_date" date,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"permission_code" text NOT NULL,
	"resource_type" text NOT NULL,
	"action" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text,
	"module_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_code" text NOT NULL,
	"permission_id" integer NOT NULL,
	"allowed_statuses" jsonb,
	"effect" text DEFAULT 'ALLOW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "rule_definition_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_def_id" integer NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"suggested_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "rule_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_code" text NOT NULL,
	"rule_type" text NOT NULL,
	"legal_basis" text,
	"severity" text DEFAULT 'WARNING' NOT NULL,
	"applies_to_entity" text,
	"calendar_basis" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "rule_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_def_id" integer NOT NULL,
	"param_code" text NOT NULL,
	"param_value" text NOT NULL,
	"param_type" text DEFAULT 'TEXT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "securities" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"security_type" text NOT NULL,
	"board" text NOT NULL,
	"isin" text,
	"status" text DEFAULT 'NORMAL' NOT NULL,
	"listing_status_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_no" text NOT NULL,
	"template_id" integer NOT NULL,
	"template_kind" text NOT NULL,
	"news_group_code" text,
	"organization_id" integer,
	"security_id" integer,
	"title" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"period_code" text,
	"period_end_date" date,
	"due_date" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"ca_signed_at" timestamp with time zone,
	"is_late" boolean DEFAULT false NOT NULL,
	"late_days" integer,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"workflow_instance_id" integer,
	"lang" text DEFAULT 'vi' NOT NULL,
	"source_submission_id" integer,
	"translation_status" text,
	"correction_of_id" integer,
	"correction_type" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_by" integer,
	"hide_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "template_definition_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"lang" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "template_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_code" text NOT NULL,
	"template_kind" text NOT NULL,
	"news_type_code" text,
	"news_group_code" text,
	"owner_unit_code" text,
	"workflow_def_code" text,
	"auto_approve" boolean DEFAULT false NOT NULL,
	"require_ca_sign" boolean DEFAULT false NOT NULL,
	"post_audit" boolean DEFAULT false NOT NULL,
	"auto_translate" boolean DEFAULT false NOT NULL,
	"title_formula" text,
	"deadline_rule_json" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"in_use" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "template_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"field_definition_id" integer NOT NULL,
	"section_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"col_span" integer DEFAULT 24 NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
	"is_indexed" boolean DEFAULT false NOT NULL,
	"visible_for_roles" jsonb,
	"editable_for_roles" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "trading_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"board" text,
	"trading_date" date NOT NULL,
	"year" integer NOT NULL,
	"session_type" text DEFAULT 'FULL' NOT NULL,
	"close_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"actor_type" text NOT NULL,
	"organization_id" integer,
	"unit_code" text,
	"position" text,
	"role_code" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_code" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text,
	"entity_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text,
	"version_no" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "workflow_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"organization_id" integer,
	"from_status" text,
	"to_status" text NOT NULL,
	"action_code" text NOT NULL,
	"actor_id" integer,
	"actor_role" text,
	"reason" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_def_id" integer NOT NULL,
	"step_code" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text,
	"status_code" text NOT NULL,
	"assignee_role_code" text,
	"sla_amount" integer,
	"sla_calendar_basis" text,
	"is_start" boolean DEFAULT false NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_def_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"organization_id" integer,
	"assignee_user_id" integer,
	"assignee_role_code" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" integer,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
CREATE TABLE "workflow_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_def_id" integer NOT NULL,
	"from_step_id" integer,
	"to_step_id" integer NOT NULL,
	"action_code" text NOT NULL,
	"name_vi" text NOT NULL,
	"name_en" text,
	"guard_expr" text,
	"allowed_role_codes" jsonb,
	"require_dual_control" boolean DEFAULT false NOT NULL,
	"require_reason" boolean DEFAULT false NOT NULL,
	"creates_new_version" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	"delete_reason" text
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_def_id_rule_definitions_id_fk" FOREIGN KEY ("rule_def_id") REFERENCES "public"."rule_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_cases" ADD CONSTRAINT "business_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_cases" ADD CONSTRAINT "business_cases_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_cases" ADD CONSTRAINT "business_cases_template_id_template_definitions_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_item_translations" ADD CONSTRAINT "catalog_item_translations_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_obligations" ADD CONSTRAINT "disclosure_obligations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_obligations" ADD CONSTRAINT "disclosure_obligations_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_obligations" ADD CONSTRAINT "disclosure_obligations_template_id_template_definitions_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_obligations" ADD CONSTRAINT "disclosure_obligations_fulfilled_by_submission_id_submissions_id_fk" FOREIGN KEY ("fulfilled_by_submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_definition_translations" ADD CONSTRAINT "field_definition_translations_field_definition_id_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_translations" ADD CONSTRAINT "organization_translations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_definition_translations" ADD CONSTRAINT "rule_definition_translations_rule_def_id_rule_definitions_id_fk" FOREIGN KEY ("rule_def_id") REFERENCES "public"."rule_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_parameters" ADD CONSTRAINT "rule_parameters_rule_def_id_rule_definitions_id_fk" FOREIGN KEY ("rule_def_id") REFERENCES "public"."rule_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "securities" ADD CONSTRAINT "securities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_template_id_template_definitions_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_definition_translations" ADD CONSTRAINT "template_definition_translations_template_id_template_definitions_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_template_id_template_definitions_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_field_definition_id_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_def_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_def_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_workflow_def_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_def_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_step_id_workflow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_assignee_user_id_user_accounts_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_completed_by_user_accounts_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_def_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_def_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_step_id_workflow_steps_id_fk" FOREIGN KEY ("from_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_step_id_workflow_steps_id_fk" FOREIGN KEY ("to_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_alerts_organization" ON "alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ix_alerts_status" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_attachments_submission" ON "attachments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "ix_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_audit_logs_occurred_at" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "ix_audit_logs_correlation" ON "audit_logs" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "ix_audit_logs_organization" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_business_cases_no_current" ON "business_cases" USING btree ("case_no") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_business_cases_organization" ON "business_cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ix_business_cases_status" ON "business_cases" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_catalog_item_translations_item_lang" ON "catalog_item_translations" USING btree ("catalog_item_id","lang") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_catalog_items_catalog_code" ON "catalog_items" USING btree ("catalog_code","code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_data_scope_grants_subject" ON "data_scope_grants" USING btree ("subject_type","subject_ref");--> statement-breakpoint
CREATE INDEX "ix_data_scope_grants_dimension" ON "data_scope_grants" USING btree ("dimension");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_disclosure_obligations_org_template_period" ON "disclosure_obligations" USING btree ("organization_id","template_id","period_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_disclosure_obligations_due_date" ON "disclosure_obligations" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "ix_disclosure_obligations_organization" ON "disclosure_obligations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_field_definition_translations_field_lang" ON "field_definition_translations" USING btree ("field_definition_id","lang") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_field_definitions_code_current" ON "field_definitions" USING btree ("field_code") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_holiday_calendar_range" ON "holiday_calendar" USING btree ("from_date","to_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_holiday_calendar_year" ON "holiday_calendar" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_organization_translations_org_lang" ON "organization_translations" USING btree ("organization_id","lang") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_organizations_org_code_current" ON "organizations" USING btree ("org_code") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_organizations_tax_code_current" ON "organizations" USING btree ("tax_code") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_organizations_parent" ON "organizations" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions" USING btree ("permission_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_permissions_resource" ON "permissions" USING btree ("resource_type","action");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_permissions_role_permission" ON "role_permissions" USING btree ("role_code","permission_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_role_permissions_role" ON "role_permissions" USING btree ("role_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rule_definition_translations_rule_lang" ON "rule_definition_translations" USING btree ("rule_def_id","lang") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rule_definitions_code_current" ON "rule_definitions" USING btree ("rule_code") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rule_parameters_rule_code" ON "rule_parameters" USING btree ("rule_def_id","param_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_securities_symbol_current" ON "securities" USING btree ("symbol") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_securities_organization" ON "securities" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_submissions_no_lang_current" ON "submissions" USING btree ("submission_no","lang") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_submissions_organization" ON "submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ix_submissions_status" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_submissions_due_date" ON "submissions" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "ix_submissions_source" ON "submissions" USING btree ("source_submission_id");--> statement-breakpoint
CREATE INDEX "ix_submissions_parent" ON "submissions" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_template_definition_translations_template_lang" ON "template_definition_translations" USING btree ("template_id","lang") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_template_definitions_code_current" ON "template_definitions" USING btree ("template_code") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_template_definitions_kind" ON "template_definitions" USING btree ("template_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_template_fields_template_field" ON "template_fields" USING btree ("template_id","field_definition_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_template_fields_template" ON "template_fields" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trading_calendar_board_date" ON "trading_calendar" USING btree ("board","trading_date") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_trading_calendar_year" ON "trading_calendar" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_accounts_uid" ON "user_accounts" USING btree ("uid") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_accounts_username" ON "user_accounts" USING btree ("username") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_user_accounts_organization" ON "user_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workflow_definitions_code_current" ON "workflow_definitions" USING btree ("workflow_code") WHERE is_current AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_workflow_history_entity" ON "workflow_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_workflow_history_organization" ON "workflow_history" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workflow_steps_def_code" ON "workflow_steps" USING btree ("workflow_def_id","step_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ix_workflow_tasks_entity" ON "workflow_tasks" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_workflow_tasks_assignee" ON "workflow_tasks" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "ix_workflow_tasks_organization" ON "workflow_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workflow_transitions_def_from_action" ON "workflow_transitions" USING btree ("workflow_def_id","from_step_id","action_code") WHERE deleted_at IS NULL;