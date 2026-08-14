// Inventário das tabelas sensíveis do sistema para os testes automatizados de RLS.
// Regra do produto: NENHUMA tabela do schema public deve ser legível ou gravável
// por usuários anônimos (não autenticados). Todo o acesso é escopado por empresa
// via user_company_roles / has_role.

/** Tabelas com dados de negócio escopados por empresa. */
export const COMPANY_SCOPED_TABLES = [
  "allergens",
  "branches",
  "brands",
  "categories",
  "companies",
  "email_templates",
  "external_system_mappings",
  "ingredients",
  "integration_configs",
  "integration_event_queue",
  "integration_logs",
  "integration_webhooks",
  "label_categories",
  "label_custom_fields",
  "label_formats",
  "label_layout_elements",
  "label_layout_versions",
  "label_layouts",
  "label_snapshots",
  "layout_associations",
  "nutrition_facts",
  "print_batches",
  "print_events",
  "print_queue",
  "printed_labels",
  "printer_configs",
  "printer_layout_compatibility",
  "product_allergens",
  "product_ingredients",
  "product_price_history",
  "product_prices",
  "products",
  "promotion_products",
  "promotions",
  "scale_configs",
  "system_settings",
  "whatsapp_templates",
] as const;

/**
 * Tabelas de altíssima criticidade: credenciais, auditoria, identidade e
 * controle de acesso. Vazamento aqui é escalada de privilégio.
 */
export const CRITICAL_TABLES = [
  "audit_logs",
  "integration_tokens",
  "permissions",
  "platform_admins",
  "print_agent_pairing_codes",
  "print_agent_pairing_ip_attempts",
  "print_agent_pairings",
  "role_permissions",
  "user_branch_access",
  "user_company_roles",
  "user_profiles",
] as const;

export const SENSITIVE_TABLES = [...CRITICAL_TABLES, ...COMPANY_SCOPED_TABLES] as const;

/** Funções SECURITY DEFINER que jamais devem ser executáveis por anônimos. */
export const PROTECTED_RPCS = [
  "consume_pairing_code",
  "rotate_print_agent_pairing",
  "check_pairing_ip_rate_limit",
  "register_pairing_code_failure",
  "create_company_with_admin",
  "log_audit",
  "is_global_admin",
  "has_role",
  "has_any_role",
  "is_company_member",
] as const;

export type SensitiveTable = (typeof SENSITIVE_TABLES)[number];
