ALTER TABLE public.print_agent_pairings
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_version TEXT;

CREATE INDEX IF NOT EXISTS print_agent_pairings_device_idx
  ON public.print_agent_pairings(company_id, device_id)
  WHERE status = 'active' AND device_id IS NOT NULL;