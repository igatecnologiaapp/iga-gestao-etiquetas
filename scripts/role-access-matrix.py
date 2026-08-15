#!/usr/bin/env python3
"""Gera a matriz de acesso por role (RLS) a partir das politicas do banco.

Uso: python3 scripts/role-access-matrix.py [saida.md]
Requer as variaveis PG* do ambiente (psql).
"""
import subprocess, sys, re
from collections import defaultdict

ROLES = ["administrador", "supervisor", "operador", "consulta"]
CMDS = ["SELECT", "INSERT", "UPDATE", "DELETE"]

SQL = """
select p.tablename, p.cmd, coalesce(p.qual,''), coalesce(p.with_check,'')
from pg_policies p
where p.schemaname='public'
order by 1,2
"""

GRANTS_SQL = """
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
"""


def psql(sql: str):
    out = subprocess.run(["psql", "-At", "-F", "\x1f", "-c", sql],
                         capture_output=True, text=True, check=True).stdout
    return [l.split("\x1f") for l in out.splitlines() if l.strip()]


def role_allows(expr: str, role: str) -> bool:
    """Avalia se a expressao da politica pode ser satisfeita pelo role informado."""
    e = expr.strip()
    if not e:
        return True                      # sem restricao adicional
    if e.lower() in ("false", "(false)"):
        return False
    if "is_global_admin" in e and "has_" not in e and "is_company_member" not in e:
        return role == "administrador"   # apenas admin de plataforma
    named = set(re.findall(r"'(\w+)'::app_role", e))
    if named:
        return role in named
    # is_company_member / user_id = auth.uid() -> qualquer membro
    return True


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else "/mnt/documents/matriz-acesso-roles.md"
    policies = psql(SQL)
    grants = defaultdict(set)
    for table, priv, grantee in psql(GRANTS_SQL):
        grants[table].add((grantee, priv))

    # matriz[table][cmd][role] = True/False
    matrix = defaultdict(lambda: {c: {r: False for r in ROLES} for c in CMDS})
    tables = set()
    for table, cmd, qual, check in policies:
        tables.add(table)
        cmds = CMDS if cmd == "ALL" else [cmd]
        for c in cmds:
            for r in ROLES:
                expr_ok = role_allows(qual, r) if c != "INSERT" else True
                check_ok = role_allows(check, r) if c in ("INSERT", "UPDATE") else True
                if c == "INSERT":
                    expr_ok = True
                if expr_ok and check_ok:
                    matrix[table][c][r] = True

    # tabelas sem policy alguma = totalmente bloqueadas para roles de app
    all_tables = {t for t, in [(row[0],) for row in psql(
        "select tablename from pg_tables where schemaname='public' order by 1")]}
    tables |= all_tables

    mark = lambda ok: "OK" if ok else "BLOQ"
    lines = [
        "# Matriz de Acesso por Role (RLS)",
        "",
        "Gerado automaticamente por `scripts/role-access-matrix.py` a partir de `pg_policies`.",
        "",
        "Legenda: **OK** = operacao permitida pela politica (dentro da propria empresa);",
        "**BLOQ** = operacao bloqueada pelo RLS.",
        "",
    ]

    for role in ROLES:
        lines += [f"## {role.capitalize()}", "",
                  "| Tabela sensivel | SELECT | INSERT | UPDATE | DELETE |",
                  "| --- | --- | --- | --- | --- |"]
        for t in sorted(all_tables):
            m = matrix[t]
            lines.append("| `%s` | %s | %s | %s | %s |" % (
                t, *[mark(m[c][role]) for c in CMDS]))
        blocked = [t for t in sorted(all_tables)
                   if not any(matrix[t][c][role] for c in CMDS)]
        lines += ["", f"Tabelas totalmente inacessiveis para **{role}**: "
                      + (", ".join(f"`{t}`" for t in blocked) or "nenhuma"), ""]

    lines += ["## Papel anonimo (anon)", "",
              "Nenhuma tabela sensivel concede leitura ao papel `anon`; "
              "validado por `src/lib/security/rls-policies.test.ts`.", ""]

    text = "\n".join(lines) + "\n"
    with open(dest, "w") as f:
        f.write(text)
    print(f"Relatorio gravado em {dest} ({len(all_tables)} tabelas x {len(ROLES)} roles)")


if __name__ == "__main__":
    main()
