
-- FASE 4: Tabela de pareamento do Print Agent por empresa.
-- O token bruto é exibido apenas no momento da criação; persistimos apenas o hash SHA-256.

CREATE TABLE public.print_agent_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by UUID,
  revoked_by UUID,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  last_seen_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX print_agent_pairings_company_idx ON public.print_agent_pairings(company_id);
CREATE INDEX print_agent_pairings_hash_idx ON public.print_agent_pairings(token_hash) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE ON public.print_agent_pairings TO authenticated;
GRANT ALL ON public.print_agent_pairings TO service_role;

ALTER TABLE public.print_agent_pairings ENABLE ROW LEVEL SECURITY;

-- Somente administradores globais ou administradores da empresa podem ver os pareamentos.
-- token_hash nunca é "secreto reversível": é apenas a identificação para revogação/auditoria.
CREATE POLICY "pairings: admins read"
ON public.print_agent_pairings FOR SELECT
TO authenticated
USING (
  public.is_global_admin(auth.uid())
  OR public.has_role(auth.uid(), company_id, 'administrador')
);

CREATE POLICY "pairings: admins insert"
ON public.print_agent_pairings FOR INSERT
TO authenticated
WITH CHECK (
  public.is_global_admin(auth.uid())
  OR public.has_role(auth.uid(), company_id, 'administrador')
);

-- UPDATE restrito a revogação/relabel; rotação ocorre via novo INSERT + revoke do antigo.
CREATE POLICY "pairings: admins update"
ON public.print_agent_pairings FOR UPDATE
TO authenticated
USING (
  public.is_global_admin(auth.uid())
  OR public.has_role(auth.uid(), company_id, 'administrador')
)
WITH CHECK (
  public.is_global_admin(auth.uid())
  OR public.has_role(auth.uid(), company_id, 'administrador')
);

-- Atualiza updated_at automaticamente.
CREATE TRIGGER tg_print_agent_pairings_updated_at
BEFORE UPDATE ON public.print_agent_pairings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auditoria automática (usa coluna company_id).
CREATE TRIGGER tg_print_agent_pairings_audit
AFTER INSERT OR UPDATE OR DELETE ON public.print_agent_pairings
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
