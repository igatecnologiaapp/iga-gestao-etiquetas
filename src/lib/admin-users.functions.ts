import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "administrador" | "supervisor" | "operador" | "consulta";

function genStrongPassword(): string {
  // 32-char random password, never returned, never logged.
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return (
    Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("") +
    "Aa1!"
  );
}

async function assertAdmin(supabase: any, userId: string, companyId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _company_id: companyId,
    _role: "administrador",
  });
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Forbidden: requer perfil administrador");
}

// Lista TODOS os usuários do sistema; quando há vínculo com a empresa selecionada,
// inclui role/link_id. Usuários sem vínculo aparecem com role=null (Sem acesso),
// permitindo ao administrador conceder acesso diretamente.
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: links, error: lErr }] = await Promise.all([
      supabaseAdmin.from("user_profiles").select("id, full_name, email, status, created_at"),
      supabaseAdmin.from("user_company_roles")
        .select("id, role, user_id, created_at").eq("company_id", data.companyId),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (lErr) throw new Error(lErr.message);

    const linkByUser = new Map<string, { id: string; role: AppRole; created_at: string }>();
    for (const l of links ?? []) {
      // Se houver múltiplas (não deveria), mantém a última.
      linkByUser.set(l.user_id, { id: l.id, role: l.role as AppRole, created_at: l.created_at });
    }

    // last_sign_in_at via Admin API — best-effort
    const lastById: Record<string, string | null> = {};
    for (const p of profiles ?? []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
        lastById[p.id] = u?.user?.last_sign_in_at ?? null;
      } catch {
        lastById[p.id] = null;
      }
    }

    const rows = (profiles ?? []).map((p: any) => {
      const link = linkByUser.get(p.id);
      return {
        link_id: link?.id ?? p.id, // chave única para o React
        user_id: p.id,
        role: (link?.role ?? null) as AppRole | null,
        full_name: p.full_name ?? null,
        email: p.email ?? null,
        status: p.status ?? "ativo",
        created_at: p.created_at ?? link?.created_at ?? null,
        last_sign_in_at: lastById[p.id] ?? null,
        has_access: !!link,
      };
    });
    // Ordena: com acesso primeiro, depois por nome/email
    rows.sort((a, b) => {
      if (a.has_access !== b.has_access) return a.has_access ? -1 : 1;
      return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
    });
    return rows;
  });

// Remove o vínculo do usuário com a empresa (revoga acesso). Mantém o auth user.
export const adminRevokeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    if (data.userId === context.userId) throw new Error("Você não pode revogar o próprio acesso");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Não revogar último administrador ativo
    const { data: admins } = await supabaseAdmin
      .from("user_company_roles")
      .select("user_id, user_profiles(status)")
      .eq("company_id", data.companyId).eq("role", "administrador");
    const targetIsAdmin = (admins ?? []).some((a: any) => a.user_id === data.userId);
    const outrosAdminsAtivos = (admins ?? []).filter(
      (a: any) => a.user_id !== data.userId && a.user_profiles?.status === "ativo",
    );
    if (targetIsAdmin && outrosAdminsAtivos.length === 0) {
      throw new Error("Não é possível revogar: precisa restar outro administrador ativo");
    }

    const { error } = await supabaseAdmin.from("user_company_roles")
      .delete().eq("user_id", data.userId).eq("company_id", data.companyId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId, user_id: context.userId,
      action: "DELETE", table_name: "user_company_roles", record_id: data.userId,
      reason: "admin_revoke_access",
    });
    return { ok: true };
  });

// Cria usuário no Auth + profile + vínculo. Retorna recovery link uma única vez.
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; email: string; fullName: string; role: AppRole }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("E-mail inválido");

    // Existe?
    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("user_profiles").select("id").eq("email", email).maybeSingle();
    if (existing?.id) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: genStrongPassword(),
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (createErr || !created.user) throw new Error(createErr?.message || "Falha ao criar usuário");
      userId = created.user.id;
      // trigger handle_new_user cria profile; garantimos nome:
      await supabaseAdmin.from("user_profiles")
        .upsert({ id: userId, email, full_name: data.fullName, status: "ativo" }, { onConflict: "id" });
    }

    // Vínculo (papel)
    const { error: linkErr } = await supabaseAdmin
      .from("user_company_roles")
      .upsert(
        { user_id: userId, company_id: data.companyId, role: data.role, created_by: context.userId },
        { onConflict: "user_id,company_id,role", ignoreDuplicates: true },
      );
    if (linkErr) throw new Error(linkErr.message);

    // Gera recovery link (uma vez)
    const { data: linkData, error: linkGenErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery", email,
    });
    if (linkGenErr) throw new Error(linkGenErr.message);

    // Auditoria — sem senha, sem link
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId, user_id: context.userId,
      action: "INSERT", table_name: "user_company_roles", record_id: userId,
      new_values: { email, role: data.role, full_name: data.fullName },
      reason: "admin_create_user",
    });

    return { userId, recoveryLink: linkData?.properties?.action_link ?? null };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("user_profiles").select("email").eq("id", data.userId).maybeSingle();
    if (!prof?.email) throw new Error("Usuário sem e-mail");
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery", email: prof.email,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId, user_id: context.userId,
      action: "UPDATE", table_name: "auth.users", record_id: data.userId,
      reason: "admin_password_reset_link",
    });
    return { recoveryLink: linkData?.properties?.action_link ?? null };
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; userId: string; status: "ativo" | "inativo" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    if (data.userId === context.userId && data.status === "inativo") {
      throw new Error("Você não pode inativar a si mesmo");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Não permitir inativar o último administrador ativo da empresa
    if (data.status === "inativo") {
      const { data: admins } = await supabaseAdmin
        .from("user_company_roles")
        .select("user_id, user_profiles(status)")
        .eq("company_id", data.companyId).eq("role", "administrador");
      const ativos = (admins ?? []).filter((a: any) => a.user_profiles?.status === "ativo" && a.user_id !== data.userId);
      const isTargetAdmin = (admins ?? []).some((a: any) => a.user_id === data.userId);
      if (isTargetAdmin && ativos.length === 0) {
        throw new Error("Não é possível inativar: precisa restar pelo menos um administrador ativo");
      }
    }

    const { error } = await supabaseAdmin.from("user_profiles")
      .update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId, user_id: context.userId,
      action: "UPDATE", table_name: "user_profiles", record_id: data.userId,
      new_values: { status: data.status }, reason: "admin_set_status",
    });
    return { ok: true };
  });

export const adminChangeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; userId: string; newRole: AppRole }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    if (data.userId === context.userId) throw new Error("Você não pode alterar seu próprio papel");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se rebaixar admin: garantir outro admin ativo
    if (data.newRole !== "administrador") {
      const { data: admins } = await supabaseAdmin
        .from("user_company_roles")
        .select("user_id, user_profiles(status)")
        .eq("company_id", data.companyId).eq("role", "administrador");
      const outrosAtivos = (admins ?? []).filter(
        (a: any) => a.user_id !== data.userId && a.user_profiles?.status === "ativo",
      );
      const targetIsAdmin = (admins ?? []).some((a: any) => a.user_id === data.userId);
      if (targetIsAdmin && outrosAtivos.length === 0) {
        throw new Error("Não é possível rebaixar: precisa restar outro administrador ativo");
      }
    }

    // Remove papéis antigos e cria o novo (papel único por empresa nesta UI)
    await supabaseAdmin.from("user_company_roles")
      .delete().eq("user_id", data.userId).eq("company_id", data.companyId);
    const { error } = await supabaseAdmin.from("user_company_roles")
      .insert({ user_id: data.userId, company_id: data.companyId, role: data.newRole, created_by: context.userId });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      company_id: data.companyId, user_id: context.userId,
      action: "UPDATE", table_name: "user_company_roles", record_id: data.userId,
      new_values: { role: data.newRole }, reason: "admin_change_role",
    });
    return { ok: true };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; userId: string; fullName: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId, data.companyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_profiles")
      .update({ full_name: data.fullName }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bootstrap: cria Souza Aguiar como administrador e rebaixa IGA para consulta + inativo.
// Idempotente: se Souza já é administrador ativo, apenas reaplica.
export const bootstrapPrincipalAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Caller precisa ser administrador em alguma empresa
    const { data: callerRoles } = await supabaseAdmin
      .from("user_company_roles").select("company_id, role").eq("user_id", context.userId);
    const adminCompanies = (callerRoles ?? []).filter((r: any) => r.role === "administrador");
    if (!adminCompanies.length) throw new Error("Forbidden: somente administradores");

    const NEW_EMAIL = "souzaaguiar.producao@gmail.com";
    const OLD_EMAIL = "igacomercial.sp@gmail.com";

    // Buscar empresa principal (primeira em que o caller é admin)
    const companyId = adminCompanies[0].company_id;

    // 1) Souza existe?
    let souzaId: string | null = null;
    const { data: souzaProf } = await supabaseAdmin
      .from("user_profiles").select("id").eq("email", NEW_EMAIL).maybeSingle();
    if (souzaProf?.id) {
      souzaId = souzaProf.id;
    } else {
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: NEW_EMAIL, password: genStrongPassword(),
        email_confirm: true, user_metadata: { full_name: "Souza Aguiar" },
      });
      if (cErr || !created.user) throw new Error(cErr?.message || "Falha ao criar Souza Aguiar");
      souzaId = created.user.id;
    }
    await supabaseAdmin.from("user_profiles").upsert(
      { id: souzaId!, email: NEW_EMAIL, full_name: "Souza Aguiar", status: "ativo" },
      { onConflict: "id" },
    );

    // 2) Vincular Souza como administrador (em todas as empresas onde o caller é admin)
    for (const c of adminCompanies) {
      await supabaseAdmin.from("user_company_roles").upsert(
        { user_id: souzaId!, company_id: c.company_id, role: "administrador", created_by: context.userId },
        { onConflict: "user_id,company_id,role", ignoreDuplicates: true },
      );
    }

    // 3) Recovery link para Souza
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery", email: NEW_EMAIL,
    });

    // 4) Rebaixar IGA → consulta + inativo (mantém histórico).
    //    Permite que o próprio caller (IGA) se rebaixe, pois Souza já é admin ativo.
    const { data: igaProf } = await supabaseAdmin
      .from("user_profiles").select("id").eq("email", OLD_EMAIL).maybeSingle();
    let igaDemoted = false;
    if (igaProf?.id && igaProf.id !== souzaId) {
      for (const c of adminCompanies) {
        await supabaseAdmin.from("user_company_roles")
          .delete().eq("user_id", igaProf.id).eq("company_id", c.company_id);
        await supabaseAdmin.from("user_company_roles")
          .insert({ user_id: igaProf.id, company_id: c.company_id, role: "consulta", created_by: context.userId });
      }
      await supabaseAdmin.from("user_profiles")
        .update({ status: "inativo", full_name: "IGA Comercial (histórico)" }).eq("id", igaProf.id);
      igaDemoted = true;
    }

    // Auditoria
    await supabaseAdmin.from("audit_logs").insert({
      company_id: companyId, user_id: context.userId,
      action: "UPDATE", table_name: "user_company_roles", record_id: souzaId,
      new_values: { handover: true, new_admin_email: NEW_EMAIL },
      reason: "principal_admin_handover",
    });

    return {
      ok: true,
      newAdminEmail: NEW_EMAIL,
      recoveryLink: linkData?.properties?.action_link ?? null,
      oldAdminDemoted: igaDemoted,
      callerWasOldAdmin: igaProf?.id === context.userId,
    };
  });
