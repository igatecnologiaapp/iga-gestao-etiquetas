import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Require at least one valid company/role binding to access /app.
    const { data: roles, error: rolesErr } = await supabase
      .from("user_company_roles")
      .select("company_id, role")
      .eq("user_id", data.user.id)
      .limit(1);

    if (rolesErr || !roles || roles.length === 0) {
      throw redirect({ to: "/auth", search: { reason: "no-access" } as any });
    }

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

