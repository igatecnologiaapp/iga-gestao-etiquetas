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
const { spawnSync, spawn } = require("child_process");
const express = require("express");
const cors = require("cors");

// -------- Config --------
const PORT = Number(process.env.PRINT_AGENT_PORT || 17777);
const VERSION = "1.0.0";
const BASE_DIR = process.platform === "win32"
  ? path.join(process.env.PROGRAMDATA || "C:\\ProgramData", "LovablePrintAgent")
  : path.join(os.homedir(), ".lovable-print-agent");
const PROFILE_PATH = path.join(BASE_DIR, "agent.json");
const LOG_PATH = path.join(BASE_DIR, "agent.log");
const DEFAULT_API = process.env.PRINT_AGENT_API
  || "https://iga-gestao-etiquetas.lovable.app";

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
  const result = await postJson(url, {
    code: cleaned,
    device_name: os.hostname(),
    agent_version: VERSION,
  });
  if (!result.ok || !result.token) throw new Error("Resposta sem token.");
  saveProfile({
    token: result.token,
    company_id: result.company_id,
    pairing_id: result.pairing?.id ?? null,
    label: result.pairing?.label ?? null,
    api_base: apiBase,
    paired_at: new Date().toISOString(),
    device_name: os.hostname(),
  });
  log("Pareamento concluído. Empresa:", result.company_id);
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

// Mini-ZPL de teste — funciona em qualquer Zebra ZPL; fallback genérico para outras
// linguagens é apenas um texto ASCII, que a maioria dos drivers Windows aceita via spooler.
function buildTestPayload(driver) {
  const d = String(driver || "").toLowerCase();
  if (d.includes("zpl") || d.includes("zebra")) {
    return "^XA^CF0,30^FO50,50^FDLovable Print Agent^FS^FO50,90^FDTeste OK^FS^XZ\n";
  }
  if (d.includes("epl")) {
    return "N\nA50,50,0,3,1,1,N,\"Lovable Print Agent\"\nA50,90,0,3,1,1,N,\"Teste OK\"\nP1\n";
  }
  if (d.includes("tspl") || d.includes("tsc")) {
    return "SIZE 50 mm,30 mm\nCLS\nTEXT 50,50,\"3\",0,1,1,\"Lovable Print Agent\"\nTEXT 50,90,\"3\",0,1,1,\"Teste OK\"\nPRINT 1\n";
  }
  // Argox PPLB ~ EPL2; e fallback texto puro
  return "Lovable Print Agent - Teste OK\r\n\f";
}

function printRawToWindows(printerName, rawBytes) {
  // Estratégia: gravar em arquivo temporário e usar `copy /B file "\\localhost\printer"`.
  const tmp = path.join(os.tmpdir(), `lpa-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  fs.writeFileSync(tmp, rawBytes);
  try {
    const r = spawnSync(
      "cmd.exe",
      ["/c", "copy", "/B", tmp, `\\\\localhost\\${printerName}`],
      { encoding: "utf8", timeout: 15000 },
    );
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || "copy falhou");
    return true;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// -------- HTTP server --------
function buildServer() {
  const app = express();
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: "10mb" }));

  function auth(req, res, next) {
    const profile = loadProfile();
    if (!profile?.token) {
      return res.status(401).json({ ok: false, code: "NOT_PAIRED", error: "Agente não pareado." });
    }
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    // O painel envia o token armazenado localmente no navegador (mesma estação).
    // Para reduzir fricção, aceitamos qualquer requisição local; o emparelhamento
    // serve para identificar a estação, não para autenticar o navegador local.
    // Mantemos verificação opcional: se o caller enviar token, ele deve bater.
    if (token && token !== profile.token) {
      return res.status(403).json({ ok: false, code: "INVALID_TOKEN", error: "Token inválido." });
    }
    req.profile = profile;
    next();
  }

  app.get("/health", (_req, res) => {
    const profile = loadProfile();
    res.json({
      ok: true,
      reachable: true,
      version: VERSION,
      paired: !!profile?.token,
      company_id: profile?.company_id ?? null,
      device_name: profile?.device_name ?? os.hostname(),
      platform: process.platform,
    });
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
      res.json({ ok: true, token: result.token, company_id: result.company_id, pairing_id: result.pairing?.id });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  // Página de teste: gera raw mínimo conforme o driver e envia ao spooler.
  app.post("/printers/:id/test-page", auth, (req, res) => {
    const printer = decodeURIComponent(req.params.id);
    try {
      const list = listWindowsPrinters();
      const found = list.find((p) => p.name === printer);
      if (!found) return res.status(404).json({ code: "PRINTER_NOT_FOUND", message: `Impressora '${printer}' não encontrada no Windows.` });
      const raw = buildTestPayload(found.driver);
      printRawToWindows(printer, Buffer.from(raw, "utf8"));
      res.json({ jobId: `test-${Date.now()}` });
    } catch (e) {
      log("Falha test-page:", e.message);
      res.status(500).json({ code: "INTERNAL_ERROR", message: e.message });
    }
  });

  // Impressão real. Aceita o contrato AgentPrintRequest do cliente
  // (printerId, copies, raw, jobName, metadata).
  app.post("/print", auth, (req, res) => {
    const { printerId, printer: legacyPrinter, raw, copies, jobName } = req.body || {};
    const printer = printerId || legacyPrinter;
    if (!printer) return res.status(400).json({ code: "INVALID_PAYLOAD", message: "printerId obrigatório" });
    if (!raw) return res.status(400).json({ code: "INVALID_PAYLOAD", message: "payload sem comando raw (PDF fallback ainda não suportado pelo agente)" });
    try {
      const buf = Buffer.from(raw, "utf8");
      const n = Math.min(Math.max(Number(copies) || 1, 1), 50);
      for (let i = 0; i < n; i++) printRawToWindows(printer, buf);
      log(`Job ${jobName || "(sem nome)"} → ${printer} × ${n}`);
      res.json({ jobId: `${Date.now()}` });
    } catch (e) {
      log("Falha na impressão:", e.message);
      res.status(500).json({ code: "INTERNAL_ERROR", message: e.message });
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
