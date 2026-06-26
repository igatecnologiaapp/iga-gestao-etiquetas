// FASE 14 — Testes de segurança das utilidades de sanitização e guard.

import { describe, expect, it } from "vitest";
import { guardPrintPayload, maskSecretsInString, sanitizeErrorMessage, sanitizePayload } from "./security";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("FASE 14 — sanitização de strings", () => {
  it("mascara token Bearer", () => {
    expect(maskSecretsInString("Authorization: Bearer pat_abcdefghijklmnop"))
      .toBe("Authorization: Bearer ***");
  });
  it("mascara token pat_*", () => {
    const out = maskSecretsInString("falha com token pat_abcdefghijklmnop xpto");
    expect(out).toContain("pat_abcd***");
    expect(out).not.toContain("pat_abcdefghijklmnop");
  });
  it("mascara JWT em string", () => {
    const jwt = "eyJhbGciOi.eyJzdWIiOi.QwerTy123";
    expect(maskSecretsInString(`token=${jwt}`)).not.toContain(jwt);
  });
  it("sanitizeErrorMessage trunca e mascara", () => {
    const out = sanitizeErrorMessage(new Error("Bearer pat_abcdefghij " + "x".repeat(600)));
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out).toContain("Bearer ***");
  });
});

describe("FASE 14 — sanitizePayload", () => {
  it("remove chaves sensíveis", () => {
    const input = {
      company_id: UUID,
      token: "pat_xxxxxxxxxxxxxxxx",
      authorization: "Bearer abc",
      nested: { secret: "y", password: "z", ok: 1 },
      list: [{ api_key: "x", v: 2 }],
    };
    const out: any = sanitizePayload(input);
    expect(out.token).toBeUndefined();
    expect(out.authorization).toBeUndefined();
    expect(out.nested.secret).toBeUndefined();
    expect(out.nested.password).toBeUndefined();
    expect(out.nested.ok).toBe(1);
    expect(out.list[0].api_key).toBeUndefined();
    expect(out.list[0].v).toBe(2);
  });

  it("mascara segredos embutidos em strings", () => {
    const out: any = sanitizePayload({ note: "use Bearer pat_abcdefghij" });
    expect(out.note).toContain("Bearer ***");
  });

  it("limita profundidade", () => {
    let deep: any = { v: 1 };
    for (let i = 0; i < 12; i++) deep = { child: deep };
    const out = sanitizePayload(deep);
    expect(JSON.stringify(out).length).toBeLessThan(2000);
  });
});

describe("FASE 14 — guardPrintPayload", () => {
  const base = {
    company_id: UUID,
    user_id: UUID,
    printer_id: UUID,
    layout_id: UUID,
    product_id: UUID,
    quantity: 5,
    dimensional: { dpi: 203, width_mm: 100, height_mm: 100, rotation: 0 },
  };

  it("aceita payload válido", () => {
    expect(guardPrintPayload(base)).toEqual([]);
  });
  it("rejeita company_id inválido", () => {
    expect(guardPrintPayload({ ...base, company_id: "not-uuid" }).join(" ")).toMatch(/company_id/);
  });
  it("rejeita quantidade absurda", () => {
    expect(guardPrintPayload({ ...base, quantity: 99999 }).join(" ")).toMatch(/Quantidade/);
    expect(guardPrintPayload({ ...base, quantity: 0 }).join(" ")).toMatch(/Quantidade/);
  });
  it("rejeita DPI fora do range", () => {
    expect(
      guardPrintPayload({ ...base, dimensional: { ...base.dimensional, dpi: 9999 } }).join(" "),
    ).toMatch(/DPI/);
  });
  it("rejeita rotação inválida", () => {
    expect(
      guardPrintPayload({ ...base, dimensional: { ...base.dimensional, rotation: 45 } }).join(" "),
    ).toMatch(/Rota/);
  });
  it("rejeita dimensões inválidas", () => {
    expect(
      guardPrintPayload({ ...base, dimensional: { ...base.dimensional, width_mm: 0 } }).join(" "),
    ).toMatch(/Largura/);
  });
});
