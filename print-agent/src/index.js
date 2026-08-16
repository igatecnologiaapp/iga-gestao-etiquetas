#!/usr/bin/env node
/* eslint-disable */
/**
 * Lovable Print Agent — agente local Windows (Node.js)
 *
 * Escuta em 127.0.0.1:17777 e expõe a mesma API contratual descrita em
 * docs/PRINT_AGENT_PROTOCOL.md (health, listar impressoras, enviar job,
 * status do job, cancelar, ping).
 *
 * Pareamento por código curto (FASE 16):
 *   - Comando: `PrintAgent.exe pair 123456` (ou via tray UI)
 *   - O agente envia POST {code} para /api/public/print-agent/exchange
 *     e grava o token retornado em `%PROGRAMDATA%\LovablePrintAgent\agent.json`.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync, spawn } = require("child_process");
const express = require("express");
const cors = require("cors");

// -------- Config --------
const PORT = Number(process.env.PRINT_AGENT_PORT || 17777);
const VERSION = "1.3.0";
const BASE_DIR = process.platform === "win32"
  ? path.join(process.env.PROGRAMDATA || "C:\\ProgramData", "LovablePrintAgent")
  : path.join(os.homedir(), ".lovable-print-agent");
const PROFILE_PATH = path.join(BASE_DIR, "agent.json");
const LOG_PATH = path.join(BASE_DIR, "agent.log");
const DEFAULT_API = process.env.PRINT_AGENT_API
  || "https://iga-gestao-etiquetas.lovable.app";

// -------- FASE 1 (C-01): CORS restritivo --------
// Allowlist estática (produção + previews Lovable).
const STATIC_ALLOWED_ORIGINS = [
  "https://iga-gestao-etiquetas.lovable.app",
];
const ALLOWED_ORIGIN_PATTERNS = [
  // Preview stable: id-preview--<uuid>.lovable.app
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/i,
  // Preview builds e projetos publicados: <slug>.lovable.app
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  // project--<id> URLs (published/preview estáveis)
  /^https:\/\/project--[a-z0-9-]+(?:-dev)?\.lovable\.app$/i,
];
const DEV_MODE = String(process.env.PRINT_AGENT_DEV || "").toLowerCase() === "1"
  || String(process.env.PRINT_AGENT_DEV || "").toLowerCase() === "true";

function readProfileAllowedOrigins() {
  try {
    const p = loadProfile();
    const list = Array.isArray(p?.allowed_origins) ? p.allowed_origins : [];
    return list.filter((o) => typeof o === "string" && /^https?:\/\//i.test(o)).slice(0, 20);
  } catch { return []; }
}

function isOriginAllowed(origin) {
  // Sem Origin: chamadas server-side / CLI / curl locais. Somente rotas que
  // não têm segredo (health, diagnostics, pair) já respondem sem Origin;
  // rotas autenticadas ainda exigem X-Company-Id + agent.json. Permitir.
  if (!origin) return true;
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) return true;
  if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return true;
  if (readProfileAllowedOrigins().includes(origin)) return true;
  if (DEV_MODE) {
    if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
    if (/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) return true;
  }
  return false;
}


function ensureDir() {
  try { fs.mkdirSync(BASE_DIR, { recursive: true }); } catch {}
}

function log(...args) {
  ensureDir();
  const line = `[${new Date().toISOString()}] ${args.map(String).join(" ")}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch {}
  process.stdout.write(line);
}

function loadProfile() {
  try {
    return JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  ensureDir();
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
  try { fs.chmodSync(PROFILE_PATH, 0o600); } catch {}
}

function generateDeviceId() {
  return `lpa_${crypto.randomBytes(12).toString("hex")}`;
}

function tokenInfo(token) {
  const value = typeof token === "string" ? token : "";
  return {
    present: value.length > 0,
    prefix: value ? value.slice(0, 12) : null,
    suffix: value ? value.slice(-6) : null,
    length: value.length,
  };
}

function sanitizeProfile(profile) {
  if (!profile) return { exists: false, path: PROFILE_PATH, paired: false, token_present: false };
  const info = tokenInfo(profile.token);
  return {
    exists: true,
    path: PROFILE_PATH,
    paired: profile.paired !== false && !!profile.token,
    company_id: profile.company_id ?? null,
    device_id: profile.device_id ?? null,
    device_name: profile.device_name ?? os.hostname(),
    pairing_id: profile.pairing_id ?? null,
    label: profile.label ?? null,
    api_base: profile.api_base ?? null,
    paired_at: profile.paired_at ?? null,
    token_present: info.present,
    token_prefix: info.prefix,
    token_suffix: info.suffix,
    token_length: info.length,
    last_exchange: profile.last_exchange ?? null,
    credentials_reload: "agent.json é lido novamente a cada requisição; reinício do serviço não é necessário para trocar token.",
  };
}

function queryWindowsService() {
  const serviceName = "LovablePrintAgent";
  const base = {
    service_name: serviceName,
    platform: process.platform,
    pid: process.pid,
    process_path: process.execPath,
    running: true,
    port: PORT,
  };
  if (process.platform !== "win32") return { ...base, installed: null, state: "not_windows" };
  try {
    const r = spawnSync("sc", ["query", serviceName], { encoding: "utf8", timeout: 5000 });
    const out = `${r.stdout || ""}\n${r.stderr || ""}`;
    const stateMatch = out.match(/STATE\s*:\s*\d+\s+(\w+)/i);
    return {
      ...base,
      installed: r.status === 0,
      state: stateMatch?.[1] ?? (r.status === 0 ? "UNKNOWN" : "NOT_INSTALLED"),
      raw_status: out.slice(0, 800),
    };
  } catch (e) {
    return { ...base, installed: null, state: "QUERY_FAILED", error: e.message };
  }
}

function sanitizeExchangePayload(result) {
  if (!result || typeof result !== "object") return null;
  const info = tokenInfo(result.token);
  return {
    ok: !!result.ok,
    company_id: result.company_id ?? result.pairing?.company_id ?? null,
    pairing_id: result.pairing?.id ?? null,
    label: result.pairing?.label ?? null,
    token_returned: info.present,
    token_prefix: info.prefix,
    token_length: info.length,
    paired: result.paired ?? true,
    exchanged_at: new Date().toISOString(),
  };
}

function buildHealth() {
  const profile = loadProfile();
  const info = tokenInfo(profile?.token);
  const paired = !!profile?.token && profile.paired !== false;
  return {
    ok: true,
    reachable: true,
    connected: true,
    status: "ok",
    version: VERSION,
    port: PORT,
    paired,
    token_valid: paired ? true : false,
    token_prefix: info.prefix,
    token_length: info.length || null,
    company_id: profile?.company_id ?? null,
    device_id: profile?.device_id ?? null,
    device_name: profile?.device_name ?? os.hostname(),
    platform: process.platform,
    service: queryWindowsService(),
    profile: sanitizeProfile(profile),
  };
}

function buildAuthReport(req) {
  const profile = loadProfile();
  const header = req.headers.authorization || "";
  const sentToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const sentCompanyId = req.headers["x-company-id"] ? String(req.headers["x-company-id"]) : null;
  let validation_result = "valid";
  let failure_reason = null;
  let status = 200;
  let code = null;
  let message = "Autenticação local válida.";

  if (!profile || !profile.token || profile.paired === false) {
    validation_result = "failed";
    failure_reason = "estação não pareada";
    status = 401;
    code = "NOT_PAIRED";
    message = "Estação não pareada: agent.json ausente ou sem token.";
  } else if (!sentCompanyId) {
    validation_result = "failed";
    failure_reason = "company_id ausente";
    status = 401;
    code = "UNAUTHORIZED";
    message = "Cabeçalho X-Company-Id não foi enviado.";
  } else if (sentCompanyId !== profile.company_id) {
    validation_result = "failed";
    failure_reason = "company_id divergente";
    status = 401;
    code = "COMPANY_ID_MISMATCH";
    message = "Empresa enviada não corresponde ao pareamento gravado no agent.json.";
  } else if (sentToken && sentToken !== profile.token) {
    validation_result = "failed";
    failure_reason = "token inválido";
    status = 401;
    code = "INVALID_TOKEN";
    message = "Token enviado pelo navegador é diferente do token gravado no agent.json.";
  } else if (!sentToken) {
    validation_result = "valid_without_browser_token";
    message = "Token do navegador não foi enviado; aceito porque a estação local está pareada e a empresa confere.";
  }

  const auth = {
    token_found: tokenInfo(profile?.token),
    token_sent: tokenInfo(sentToken),
    token_expected: tokenInfo(profile?.token),
    company_id_sent: sentCompanyId,
    company_id_expected: profile?.company_id ?? null,
    device_id_expected: profile?.device_id ?? null,
    validation_result,
    failure_reason,
    token_valid: status === 200,
  };
  return { ok: status === 200, status, code, message, auth };
}

function authErrorBody(report) {
  return {
    ok: false,
    code: report.code || "UNAUTHORIZED",
    message: report.message,
    error: report.message,
    details: {
      reason: report.auth.failure_reason || "outro motivo",
      validation_result: report.auth.validation_result,
      token_found: report.auth.token_found,
      token_sent: report.auth.token_sent,
      token_expected: report.auth.token_expected,
      company_id_sent: report.auth.company_id_sent,
      company_id_expected: report.auth.company_id_expected,
      device_id_expected: report.auth.device_id_expected,
    },
  };
}

function buildDiagnostics(req) {
  const health = buildHealth();
  const profile = loadProfile();
  const service = queryWindowsService();
  const authReport = buildAuthReport(req);
  let printersCheck;
  if (!authReport.ok) {
    printersCheck = {
      ok: false,
      status: authReport.status,
      code: authReport.code,
      message: authReport.message,
      details: authErrorBody(authReport).details,
    };
  } else {
    const printers = listWindowsPrinters();
    printersCheck = { ok: true, status: 200, count: printers.length, printers };
  }
  const steps = [
    { key: "installation", label: "Verificar instalação do agente", ok: true, message: `Processo ativo em ${process.execPath}` },
    { key: "windows_service", label: "Verificar serviço Windows", ok: service.platform !== "win32" || service.installed !== false, status: service.state, message: service.platform === "win32" ? `Serviço ${service.service_name}: ${service.state}` : "Não aplicável fora do Windows." },
    { key: "port", label: "Verificar porta 17777", ok: true, message: `Servidor respondendo em 127.0.0.1:${PORT}` },
    { key: "health", label: "Verificar /health", ok: health.ok && health.reachable, message: health.paired ? "Health respondeu com estação pareada." : "Health respondeu, mas estação não está pareada." },
    { key: "token", label: "Verificar token", ok: !!profile?.token, status: profile?.token ? "TOKEN_FOUND" : "MISSING_TOKEN", message: profile?.token ? "Token encontrado no agent.json." : "Token inexistente no agent.json." },
    { key: "agent_json", label: "Verificar agent.json", ok: !!profile, message: profile ? `agent.json lido em ${PROFILE_PATH}` : `agent.json não encontrado em ${PROFILE_PATH}` },
    { key: "pairing", label: "Verificar pareamento", ok: !!profile?.token && profile.paired !== false, message: profile?.token ? `Pareado com empresa ${profile.company_id}` : "Estação não pareada." },
    { key: "auth", label: "Verificar autenticação", ok: authReport.ok, status: authReport.code || authReport.auth.validation_result, message: authReport.message },
    { key: "printers", label: "Verificar GET /printers", ok: printersCheck.ok, status: printersCheck.code || String(printersCheck.status), message: printersCheck.ok ? `${printersCheck.count} impressora(s) retornada(s).` : printersCheck.message },
  ];
  return {
    ok: steps.every((s) => s.ok),
    generated_at: new Date().toISOString(),
    version: VERSION,
    base_url: `http://127.0.0.1:${PORT}`,
    port: PORT,
    health,
    agent_json: sanitizeProfile(profile),
    service,
    auth: authReport.auth,
    exchange: profile?.last_exchange ?? null,
    printers_check: printersCheck,
    steps,
  };
}

// -------- Pareamento --------
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body), "utf8");
    const opts = {
      method: "POST",
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        "content-type": "application/json",
        "content-length": data.length,
        "user-agent": `LovablePrintAgent/${VERSION}`,
      },
    };
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          const json = JSON.parse(text);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(json.error || `HTTP ${res.statusCode}`));
        } catch {
          reject(new Error(`Resposta inválida (HTTP ${res.statusCode}): ${text.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function pair(code, apiBase = DEFAULT_API) {
  const cleaned = String(code).replace(/\D/g, "");
  if (cleaned.length !== 6) throw new Error("Código deve ter 6 dígitos.");
  const url = `${apiBase.replace(/\/$/, "")}/api/public/print-agent/exchange`;
  log("Trocando código por token em", url);
  const existing = loadProfile();
  const deviceId = existing?.device_id || generateDeviceId();
  const result = await postJson(url, {
    code: cleaned,
    device_id: deviceId,
    device_name: os.hostname(),
    agent_version: VERSION,
  });
  if (!result.ok || !result.token) throw new Error("Resposta sem token.");
  const sanitizedExchange = sanitizeExchangePayload(result);
  saveProfile({
    paired: true,
    token: result.token,
    company_id: result.company_id,
    device_id: deviceId,
    pairing_id: result.pairing?.id ?? null,
    label: result.pairing?.label ?? null,
    api_base: apiBase,
    paired_at: new Date().toISOString(),
    device_name: os.hostname(),
    last_exchange: sanitizedExchange,
  });
  log("Pareamento concluído. Empresa:", result.company_id, "Device:", deviceId, "Token:", tokenInfo(result.token).prefix);
  return result;
}

// -------- Impressoras locais (Windows) --------
function listWindowsPrinters() {
  if (process.platform !== "win32") return [];
  try {
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", "Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | ConvertTo-Json -Compress"],
      { encoding: "utf8", timeout: 8000 },
    );
    if (r.status !== 0) return [];
    const parsed = JSON.parse(r.stdout || "[]");
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((p) => {
      const statusRaw = String(p.PrinterStatus ?? "Unknown").toLowerCase();
      const status = statusRaw.includes("normal") || statusRaw === "0" || statusRaw === "online"
        ? "online"
        : statusRaw === "unknown" ? "unknown" : "offline";
      return {
        id: p.Name,            // no Windows o nome é o identificador estável
        name: p.Name,
        driver: p.DriverName,
        port: p.PortName,
        default: false,
        status,
      };
    });
  } catch (e) {
    log("Falha ao listar impressoras:", e.message);
    return [];
  }
}

function normalizeLanguage(language, driver) {
  const raw = String(language || "").trim().toUpperCase().replace(/[\s/_-]/g, "");
  if (["ZPL", "EPL", "PPLA", "PPLB", "TSPL", "ESCPOS", "GDI"].includes(raw)) return raw;
  const d = String(driver || "").toLowerCase();
  if (d.includes("zpl") || d.includes("zebra") || d.includes("zdesigner")) return "ZPL";
  if (d.includes("epl") || d.includes("eltron")) return "EPL";
  if (d.includes("ppla")) return "PPLA";
  if (d.includes("pplb") || d.includes("argox")) return "PPLB";
  if (d.includes("tspl") || d.includes("tsc") || d.includes("elgin") || d.includes("4barcode")) return "TSPL";
  if (d.includes("esc/pos") || d.includes("escpos")) return "ESCPOS";
  return "GDI";
}

function safeText(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/"/g, "'")
    .trim()
    .slice(0, 120);
}

function buildTestPayload(driver, language, printerName) {
  const lang = normalizeLanguage(language, driver);
  const lines = [
    "TESTE DE IMPRESSAO DIRETA",
    "Produto Teste",
    new Date().toLocaleString("pt-BR"),
    "Quantidade: 1",
    `Impressora: ${safeText(printerName)}`,
  ];
  if (lang === "ZPL") {
    return { language: lang, raw: ["^XA", "^CI28", "^PW812", "^LL406", ...lines.map((l, i) => `^FO40,${40 + i * 38}^A0N,28,28^FD${safeText(l).replace(/[\\^~]/g, " ")}^FS`), "^PQ1", "^XZ"].join("\n") };
  }
  if (lang === "TSPL") {
    return { language: lang, raw: ["SIZE 100 mm,50 mm", "GAP 2 mm,0 mm", "DIRECTION 1", "CLS", ...lines.map((l, i) => `TEXT 35,${30 + i * 38},\"3\",0,1,1,\"${safeText(l)}\"`), "PRINT 1,1"].join("\n") };
  }
  if (lang === "EPL" || lang === "PPLA" || lang === "PPLB") {
    return { language: lang, raw: ["N", "q800", "Q400,24", ...lines.map((l, i) => `A35,${30 + i * 36},0,3,1,1,N,\"${safeText(l)}\"`), "P1"].join("\n") };
  }
  if (lang === "ESCPOS") return { language: lang, raw: `\x1b@${lines.join("\r\n")}\r\n\x1dV\x00` };
  return { language: lang, raw: `${lines.join("\r\n")}\r\n\f` };
}

function translateSpoolerStderr(text) {
  const t = String(text || "");
  if (/n[ãa]o foi encontrad|cannot find the network|network name cannot be found|0x80070043|error 67/i.test(t)) {
    return "Impressora não está compartilhada localmente (\\\\localhost\\<nome>). Use winspool_raw ou habilite compartilhamento.";
  }
  if (/acesso negado|access is denied|0x80070005/i.test(t)) {
    return "Acesso negado ao spooler. Execute o serviço LovablePrintAgent como Administrador / LocalSystem.";
  }
  if (/n[ãa]o foi poss[ií]vel|not a valid Win32 application|0x800700C1/i.test(t)) {
    return "Arquivo inválido enviado ao spooler.";
  }
  return t.trim();
}

function writeRawViaWinspool(printerName, rawBytes, jobName, timeoutMs) {
  const tmpScript = path.join(os.tmpdir(), `lpa-winspool-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
  const script = `
param([string]$PrinterName,[string]$Base64,[string]$JobName)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFOA { [MarshalAs(UnmanagedType.LPStr)] public string pDocName; [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);
}
"@
$bytes=[Convert]::FromBase64String($Base64)
$h=[IntPtr]::Zero
if(-not [RawPrinterHelper]::OpenPrinter($PrinterName,[ref]$h,[IntPtr]::Zero)){ throw "OpenPrinter falhou: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
try {
  $di=New-Object RawPrinterHelper+DOCINFOA
  $di.pDocName=$JobName; $di.pDataType='RAW'
  if(-not [RawPrinterHelper]::StartDocPrinter($h,1,$di)){ throw "StartDocPrinter falhou: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  try {
    if(-not [RawPrinterHelper]::StartPagePrinter($h)){ throw "StartPagePrinter falhou: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
    try {
      $written=0
      if(-not [RawPrinterHelper]::WritePrinter($h,$bytes,$bytes.Length,[ref]$written)){ throw "WritePrinter falhou: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
      Write-Output "RAW_OK bytes=$written"
    } finally { [RawPrinterHelper]::EndPagePrinter($h) | Out-Null }
  } finally { [RawPrinterHelper]::EndDocPrinter($h) | Out-Null }
} finally { [RawPrinterHelper]::ClosePrinter($h) | Out-Null }
`.trim();
  // BOM UTF-8 — algumas instalações falham no Add-Type sem ele
  fs.writeFileSync(tmpScript, "\ufeff" + script, "utf8");
  try {
    return spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmpScript, printerName, rawBytes.toString("base64"), jobName || "Lovable Print Job"], { encoding: "utf8", timeout: timeoutMs, windowsHide: true });
  } finally {
    try { fs.unlinkSync(tmpScript); } catch {}
  }
}

function ensureLocalShare(printerName) {
  // Compartilha a impressora localmente (necessário para o fallback \\localhost\nome).
  // Idempotente: se já estiver compartilhada, ignora.
  const shareName = `LPA_${printerName.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60)}`;
  const ps = spawnSync("powershell.exe", ["-NoProfile", "-Command",
    `try { $p=Get-Printer -Name ${JSON.stringify(printerName)} -ErrorAction Stop; if(-not $p.Shared){ Set-Printer -Name ${JSON.stringify(printerName)} -Shared $true -ShareName ${JSON.stringify(shareName)} -ErrorAction Stop }; (Get-Printer -Name ${JSON.stringify(printerName)}).ShareName } catch { Write-Error $_.Exception.Message }`,
  ], { encoding: "utf8", timeout: 15000, windowsHide: true });
  const out = String(ps.stdout || "").trim();
  return { ok: ps.status === 0, shareName: out || shareName, status: ps.status, stderr: String(ps.stderr || "").slice(0, 500) };
}

function printRawToWindows(printerName, rawBytes, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || 60000);
  const jobName = opts.jobName || "Lovable Print Job";
  const attempts = [];

  if (process.platform !== "win32") throw new Error("Impressão direta disponível apenas no Windows.");

  const raw = writeRawViaWinspool(printerName, rawBytes, jobName, timeoutMs);
  attempts.push({ method: "winspool_raw", status: raw.status, stdout: String(raw.stdout || "").slice(0, 1000), stderr: String(raw.stderr || "").slice(0, 1000), signal: raw.signal || null });
  if (raw.status === 0) return { ok: true, method: "winspool_raw", attempts };

  const tmp = path.join(os.tmpdir(), `lpa-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  fs.writeFileSync(tmp, rawBytes);
  try {
    // Garante share local antes do copy_unc.
    const share = ensureLocalShare(printerName);
    attempts.push({ method: "ensure_share", status: share.status, stdout: share.shareName, stderr: share.stderr, signal: null });
    const shareTarget = share.ok ? share.shareName : printerName;
    const copy = spawnSync("cmd.exe", ["/c", "copy", "/B", tmp, `\\\\localhost\\${shareTarget}`], { encoding: "utf8", timeout: Math.min(timeoutMs, 30000), windowsHide: true });
    const copyStderr = translateSpoolerStderr(copy.stderr || copy.stdout);
    attempts.push({ method: "copy_unc", target: `\\\\localhost\\${shareTarget}`, status: copy.status, stdout: String(copy.stdout || "").slice(0, 1000), stderr: copyStderr.slice(0, 1000), signal: copy.signal || null });
    if (copy.status === 0) return { ok: true, method: "copy_unc", attempts };

    const ps = spawnSync("powershell.exe", ["-NoProfile", "-Command", `Get-Content -Raw -Path ${JSON.stringify(tmp)} | Out-Printer -Name ${JSON.stringify(printerName)}`], { encoding: "utf8", timeout: Math.min(timeoutMs, 30000), windowsHide: true });
    attempts.push({ method: "powershell_out_printer", status: ps.status, stdout: String(ps.stdout || "").slice(0, 1000), stderr: String(ps.stderr || "").slice(0, 1000), signal: ps.signal || null });
    if (ps.status === 0) return { ok: true, method: "powershell_out_printer", attempts, warning: "Fallback GDI/texto usado; linguagens RAW podem não ser interpretadas." };

    const start = spawnSync("powershell.exe", ["-NoProfile", "-Command", `$f=${JSON.stringify(tmp)}; $p=${JSON.stringify(printerName)}; Start-Process -FilePath notepad.exe -ArgumentList @('/pt',$f,$p) -Wait`], { encoding: "utf8", timeout: Math.min(timeoutMs, 30000), windowsHide: true });
    attempts.push({ method: "powershell_start_process_printto", status: start.status, stdout: String(start.stdout || "").slice(0, 1000), stderr: String(start.stderr || "").slice(0, 1000), signal: start.signal || null });
    if (start.status === 0) return { ok: true, method: "powershell_start_process_printto", attempts, warning: "Fallback Start-Process/PrintTo usado; indicado para GDI/texto." };
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
  // Prioriza o erro do método PRINCIPAL (winspool_raw) — é o mais informativo.
  const primary = attempts.find((a) => a.method === "winspool_raw");
  const last = attempts[attempts.length - 1] || {};
  const primaryMsg = primary ? translateSpoolerStderr(primary.stderr || primary.stdout) : "";
  const fallbackMsg = translateSpoolerStderr(last.stderr || last.stdout);
  const msg = (primaryMsg && primaryMsg !== "0") ? `winspool_raw: ${primaryMsg}` : (fallbackMsg || `Falha no spooler (${last.method || "desconhecido"})`);
  const err = new Error(msg);
  err.attempts = attempts;
  throw err;
}


// -------- HTTP server --------
function buildServer() {
  const app = express();
  // FASE 1 (C-01) — CORS restritivo por origem, apenas GET/POST/OPTIONS,
  // e apenas os headers realmente usados pelo painel.
  //
  // AUDITORIA (P0-IMP-01) — Private Network Access (PNA):
  // o painel roda em https://*.lovable.app (origem pública) e o agente em
  // http://127.0.0.1:17777 (rede local). Navegadores Chromium enviam o
  // preflight com `Access-Control-Request-Private-Network: true` e exigem
  // `Access-Control-Allow-Private-Network: true` na resposta. Sem esse header
  // o fetch é bloqueado ANTES de chegar ao agente e o painel só observa um
  // TypeError de rede — indistinguível de "agente desligado".
  // O header só é emitido para origens já aprovadas pela allowlist acima.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (req.headers["access-control-request-private-network"] && isOriginAllowed(origin)) {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    next();
  });
  app.use(cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      log("CORS_BLOCKED origin=", origin || "(none)");
      return callback(new Error("Origin não autorizado"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Company-Id"],
    credentials: false,
    maxAge: 86400,
    optionsSuccessStatus: 204,
  }));
  // Handler explícito para OPTIONS (preflight) de qualquer rota
  app.options("*", cors());
  app.use(express.json({ limit: "10mb" }));

  function auth(req, res, next) {
    const report = buildAuthReport(req);
    log(
      "AUTH", req.method, req.path,
      "result=", report.auth.validation_result,
      "reason=", report.auth.failure_reason || "ok",
      "found=", JSON.stringify(report.auth.token_found),
      "sent=", JSON.stringify(report.auth.token_sent),
      "expected=", JSON.stringify(report.auth.token_expected),
      "company_sent=", report.auth.company_id_sent,
      "company_expected=", report.auth.company_id_expected,
    );
    if (!report.ok) return res.status(report.status).json(authErrorBody(report));
    req.profile = loadProfile();
    next();
  }

  app.get("/health", (_req, res) => {
    res.json(buildHealth());
  });

  app.get("/auth/status", (req, res) => {
    res.json(buildDiagnostics(req));
  });

  app.get("/diagnostics", (req, res) => {
    res.json(buildDiagnostics(req));
  });


  app.get("/printers", auth, (_req, res) => {
    // Cliente espera o array cru.
    res.json(listWindowsPrinters());
  });

  // Pareamento via API local (útil para tray UI futura ou painel).
  app.post("/pair", async (req, res) => {
    try {
      const { code, api_base } = req.body || {};
      const result = await pair(code, api_base || DEFAULT_API);
      res.json({
        ok: true,
        token: result.token,
        company_id: result.company_id,
        device_id: loadProfile()?.device_id ?? null,
        pairing_id: result.pairing?.id,
        paired: true,
        token_prefix: tokenInfo(result.token).prefix,
        token_length: tokenInfo(result.token).length,
        exchange: sanitizeExchangePayload(result),
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // Página de teste: gera raw mínimo conforme o driver e envia ao spooler.
  app.post("/printers/:id/test-page", auth, (req, res) => {
    const printer = decodeURIComponent(req.params.id);
    const startedAt = Date.now();
    try {
      const list = listWindowsPrinters();
      const found = list.find((p) => p.name === printer);
      if (!found) return res.status(404).json({ code: "PRINTER_NOT_FOUND", message: `Impressora '${printer}' não encontrada no Windows.` });
      const built = buildTestPayload(found.driver, req.body?.language, printer);
      const raw = req.body?.raw ? String(req.body.raw) : built.raw;
      const rawBytes = Buffer.from(raw, "utf8");
      log("TEST_PAGE", "endpoint=/printers/:id/test-page", "printer=", printer, "driver=", found.driver, "language=", built.language, "bytes=", rawBytes.length);
      const spooler = printRawToWindows(printer, rawBytes, { jobName: "Teste de impressão direta", timeoutMs: req.body?.timeoutMs || 60000 });
      res.json({
        ok: true,
        jobId: `test-${Date.now()}`,
        endpoint: `/printers/${printer}/test-page`,
        printerId: printer,
        language: built.language,
        rawBytes: rawBytes.length,
        copies: 1,
        durationMs: Date.now() - startedAt,
        spooler,
        progress: ["Gerando comando", "Enviando ao agente", "Enviando ao spooler", "Aguardando impressora"],
      });
    } catch (e) {
      log("Falha test-page:", e.message, JSON.stringify(e.attempts || []));
      res.status(500).json({
        ok: false,
        code: "INTERNAL_ERROR",
        message: e.message,
        endpoint: `/printers/${printer}/test-page`,
        printerId: printer,
        durationMs: Date.now() - startedAt,
        details: { attempts: e.attempts || [] },
      });
    }
  });

  app.post("/printers/:id/spooler-test", auth, (req, res) => {
    const printer = decodeURIComponent(req.params.id);
    try {
      const list = listWindowsPrinters();
      const found = list.find((p) => p.name === printer);
      if (!found) return res.status(404).json({ code: "PRINTER_NOT_FOUND", message: `Impressora '${printer}' não encontrada no Windows.` });
      const built = buildTestPayload(found.driver, req.body?.language || "GDI", printer);
      const rawBytes = Buffer.from(built.raw, "utf8");
      const spooler = printRawToWindows(printer, rawBytes, { jobName: "Teste de comunicação com spooler", timeoutMs: 60000 });
      res.json({ ok: true, jobId: `spooler-${Date.now()}`, endpoint: `/printers/${printer}/spooler-test`, printerId: printer, language: built.language, rawBytes: rawBytes.length, copies: 1, spooler });
    } catch (e) {
      res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: e.message, endpoint: `/printers/${printer}/spooler-test`, printerId: printer, details: { attempts: e.attempts || [] } });
    }
  });

  // Impressão real. Aceita o contrato AgentPrintRequest do cliente
  // (printerId, copies, raw, jobName, metadata).
  app.post("/print", auth, (req, res) => {
    const startedAt = Date.now();
    const { printerId, printer: legacyPrinter, raw, copies, jobName, language } = req.body || {};
    const printer = printerId || legacyPrinter;
    if (!printer) return res.status(400).json({ code: "INVALID_PAYLOAD", message: "printerId obrigatório" });
    if (typeof raw !== "string" || raw.length === 0) return res.status(400).json({ code: "INVALID_PAYLOAD", message: "payload sem comando raw (vazio, null ou undefined)" });
    try {
      const list = listWindowsPrinters();
      const found = list.find((p) => p.id === printer || p.name === printer);
      if (!found) return res.status(404).json({ code: "PRINTER_NOT_FOUND", message: `Impressora '${printer}' não encontrada. O printerId deve ser exatamente um id retornado por GET /printers.`, details: { endpoint: "/print", printerIdSent: printer, availablePrinters: list.map((p) => p.id) } });
      const buf = Buffer.from(raw, "utf8");
      const n = Math.min(Math.max(Number(copies) || 1, 1), 50);
      const lang = normalizeLanguage(language, found.driver);
      log("PRINT", "endpoint=/print", "printer=", found.id, "driver=", found.driver, "language=", lang, "copies=", n, "bytes=", buf.length, "job=", jobName || "(sem nome)");
      const spoolerResults = [];
      for (let i = 0; i < n; i++) spoolerResults.push(printRawToWindows(found.id, buf, { jobName: jobName || "Lovable Print Job", timeoutMs: 60000 }));
      res.json({
        ok: true,
        jobId: `${Date.now()}`,
        endpoint: "/print",
        status: "completed",
        printerId: found.id,
        rawBytes: buf.length,
        language: lang,
        copies: n,
        durationMs: Date.now() - startedAt,
        spooler: spoolerResults[0],
      });
    } catch (e) {
      log("Falha na impressão:", e.message, JSON.stringify(e.attempts || []));
      res.status(500).json({
        ok: false,
        code: "INTERNAL_ERROR",
        message: e.message,
        endpoint: "/print",
        printerId,
        language: language || null,
        rawBytes: raw ? Buffer.from(String(raw), "utf8").length : 0,
        copies: Number(copies) || 1,
        durationMs: Date.now() - startedAt,
        details: { attempts: e.attempts || [], stack: e.stack },
      });
    }
  });

  app.post("/jobs/:id/cancel", auth, (req, res) => {
    // Impressão direta é síncrona no MVP — cancelamento é no-op.
    res.json({ jobId: req.params.id, canceled: false, code: "JOB_NOT_CANCELABLE", message: "job já concluído" });
  });

  app.get("/jobs/:id", auth, (req, res) => {
    res.json({ jobId: req.params.id, status: "completed" });
  });

  return app;
}

function startServer() {
  const app = buildServer();
  app.listen(PORT, "127.0.0.1", () => {
    log(`Print Agent v${VERSION} ouvindo em http://127.0.0.1:${PORT}`);
    const profile = loadProfile();
    if (!profile?.token) {
      log("ATENÇÃO: agente não pareado. Execute: PrintAgent.exe pair <código>");
    } else {
      log(`Pareado com empresa ${profile.company_id} (${profile.label ?? "?"})`);
    }
  });
}

// -------- GUI (Windows InputBox via PowerShell) --------
function showWindowsInputBox(prompt, title) {
  if (process.platform !== "win32") return null;
  const ps = `
Add-Type -AssemblyName Microsoft.VisualBasic
$code = [Microsoft.VisualBasic.Interaction]::InputBox(${JSON.stringify(prompt)}, ${JSON.stringify(title)}, "")
Write-Output $code
`.trim();
  const r = spawnSync("powershell.exe", ["-NoProfile", "-STA", "-Command", ps], { encoding: "utf8", timeout: 300000 });
  if (r.status !== 0) return null;
  return String(r.stdout || "").trim();
}

function showWindowsMessage(message, title, icon = "Information") {
  if (process.platform !== "win32") return;
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(${JSON.stringify(message)}, ${JSON.stringify(title)}, 'OK', '${icon}') | Out-Null
`.trim();
  spawnSync("powershell.exe", ["-NoProfile", "-STA", "-Command", ps], { encoding: "utf8", timeout: 60000 });
}

async function pairUI() {
  const code = showWindowsInputBox(
    "Cole ou digite o código de 6 dígitos gerado no painel Lovable (Impressoras → Pareamento do Print Agent).",
    "Parear Print Agent",
  );
  if (!code) {
    showWindowsMessage("Pareamento cancelado.", "Print Agent", "Warning");
    return;
  }
  try {
    const result = await pair(code);
    showWindowsMessage(
      `Pareamento concluído com sucesso!\n\nEmpresa: ${result.company_id}\n\nO serviço já está ativo — volte ao painel e clique em "Detectar impressoras".`,
      "Print Agent",
      "Information",
    );
  } catch (e) {
    showWindowsMessage(
      `Falha ao parear:\n\n${e.message}\n\nGere um novo código no painel e tente novamente.`,
      "Print Agent",
      "Error",
    );
  }
}

// -------- Self-install (Windows) --------
function isAdmin() {
  if (process.platform !== "win32") return false;
  const r = spawnSync("net", ["session"], { encoding: "utf8" });
  return r.status === 0;
}

function relaunchAsAdmin() {
  // UAC elevation via PowerShell Start-Process -Verb RunAs.
  const exe = process.execPath;
  const args = process.argv.slice(1).map((a) => `"${a.replace(/"/g, '`"')}"`).join(" ");
  const ps = `Start-Process -FilePath "${exe}" -ArgumentList "install" -Verb RunAs`;
  spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
}

async function selfInstall() {
  if (process.platform !== "win32") {
    console.error("Auto-instalação suportada apenas em Windows.");
    return;
  }
  if (!isAdmin()) {
    // Solicita elevação via UAC e encerra esta cópia.
    relaunchAsAdmin();
    return;
  }

  const installDir = path.join(process.env.ProgramFiles || "C:\\Program Files", "LovablePrintAgent");
  const exeDst = path.join(installDir, "PrintAgent.exe");
  const exeSrc = process.execPath;
  const serviceName = "LovablePrintAgent";

  try {
    if (!fs.existsSync(installDir)) fs.mkdirSync(installDir, { recursive: true });
    // Só copia se origem ≠ destino (evita EBUSY quando o usuário já roda a partir do destino).
    if (path.resolve(exeSrc).toLowerCase() !== path.resolve(exeDst).toLowerCase()) {
      try { spawnSync("sc", ["stop", serviceName], { encoding: "utf8" }); } catch {}
      fs.copyFileSync(exeSrc, exeDst);
    }
  } catch (e) {
    showWindowsMessage(`Falha ao copiar binário: ${e.message}`, "Print Agent", "Error");
    return;
  }

  // (Re)cria o serviço Windows
  const exists = spawnSync("sc", ["query", serviceName], { encoding: "utf8" });
  if (exists.status !== 0) {
    spawnSync("sc", ["create", serviceName, "binPath=", `"${exeDst}" start`, "start=", "auto", "DisplayName=", "Lovable Print Agent"], { encoding: "utf8" });
    spawnSync("sc", ["description", serviceName, "Recebe comandos de impressao do painel Lovable."], { encoding: "utf8" });
  }
  spawnSync("sc", ["start", serviceName], { encoding: "utf8" });

  // Cria atalho "Parear Print Agent" no Desktop público e Menu Iniciar
  const publicDesktop = path.join(process.env.PUBLIC || "C:\\Users\\Public", "Desktop");
  const startMenu = path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs", "Lovable Print Agent");
  try { if (!fs.existsSync(startMenu)) fs.mkdirSync(startMenu, { recursive: true }); } catch {}
  const shortcutScript = (dest) => `
$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${JSON.stringify(dest)})
$s.TargetPath=${JSON.stringify(exeDst)}
$s.Arguments='pair-ui'
$s.IconLocation=${JSON.stringify(exeDst)}
$s.Description='Parear esta estacao com o painel Lovable'
$s.Save()
`.trim();
  spawnSync("powershell.exe", ["-NoProfile", "-Command", shortcutScript(path.join(publicDesktop, "Parear Print Agent.lnk"))], { encoding: "utf8" });
  spawnSync("powershell.exe", ["-NoProfile", "-Command", shortcutScript(path.join(startMenu, "Parear Print Agent.lnk"))], { encoding: "utf8" });

  // Já abre o pareamento agora
  await pairUI();
}

// -------- CLI --------
async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  switch (cmd) {
    case "pair": {
      if (!arg1) { console.error("Uso: PrintAgent pair <código> [api-base]"); process.exit(1); }
      try {
        await pair(arg1, arg2 || DEFAULT_API);
        console.log("✓ Pareamento concluído. Inicie o serviço com: PrintAgent start");
      } catch (e) {
        console.error("✗ Falha:", e.message); process.exit(2);
      }
      return;
    }
    case "pair-ui": {
      await pairUI();
      return;
    }
    case "install": {
      await selfInstall();
      return;
    }
    case "status": {
      const p = loadProfile();
      if (!p) { console.log("não pareado"); process.exit(0); }
      console.log(JSON.stringify({ paired: true, company_id: p.company_id, label: p.label, paired_at: p.paired_at }, null, 2));
      return;
    }
    case "unpair": {
      try { fs.unlinkSync(PROFILE_PATH); console.log("Pareamento removido."); } catch { console.log("Nada para remover."); }
      return;
    }
    case "printers": {
      console.log(JSON.stringify(listWindowsPrinters(), null, 2));
      return;
    }
    case "start":
      startServer();
      return;
    case undefined: {
      // Duplo-clique no .exe baixado: roda o instalador GUI, em vez de abrir
      // uma janela de prompt confusa com o servidor HTTP em foreground.
      if (process.platform === "win32") {
        await selfInstall();
      } else {
        startServer();
      }
      return;
    }
    default:
      console.error(`Comando desconhecido: ${cmd}`);
      console.error("Comandos: install | start | pair <código> | pair-ui | status | unpair | printers");
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => { log("FATAL:", e.message); process.exit(1); });
}

module.exports = { buildServer, pair, loadProfile, saveProfile };
