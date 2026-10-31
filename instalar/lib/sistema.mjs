// Alfa na Steam · dependências reais do instalador (os testes trocam todas por falsas, CONTRATO.md §7)
import path from 'node:path';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { trava, anexar, carimbo } from './disco.mjs';
import { RAIZ } from './constantes.mjs';

const SYS = process.env.SystemRoot ?? 'C:\\Windows';
const TAR = path.join(SYS, 'System32', 'tar.exe'); // caminho fixo: o "tar" do Git Bash não entende C:\
const POWERSHELL = path.join(SYS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

function rodar(exe, args, opcoes = {}) {
  return new Promise((ok, falha) => {
    execFile(exe, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 60_000, ...opcoes },
      (erro, saida) => (erro ? falha(erro) : ok(saida)));
  });
}

// extrai zip com o bsdtar do Windows (recusa caminho absoluto e "..")
export function extrairZip(zip, destino) {
  trava(zip); trava(destino, true);
  execFileSync(TAR, ['-xf', zip, '-C', destino], { windowsHide: true, stdio: 'ignore', timeout: 120_000 });
}

// monta zip (usado pelos testes): tar -a escolhe o formato pela extensão .zip
export function montarZip(zip, pasta, itens) {
  trava(zip, true);
  execFileSync(TAR, ['-a', '-c', '-f', zip, '-C', pasta, ...itens], { windowsHide: true, stdio: 'ignore', timeout: 120_000 });
}

const processos = {
  // só nomes, rápido (tasklist): usado na espera da Steam fechar
  async listar() {
    const saida = await rodar('tasklist', ['/FO', 'CSV', '/NH']);
    return saida.split(/\r?\n/).map((l) => l.match(/^"([^"]+)"/)?.[1]).filter(Boolean).map((nome) => ({ nome, caminho: null }));
  },
  // nomes + caminho do exe (para achar jogo em steamapps\common)
  async listarComCaminho() {
    try {
      const saida = await rodar(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command',
        'Get-CimInstance Win32_Process | Select-Object Name,ExecutablePath | ConvertTo-Json -Compress']);
      const dados = JSON.parse(saida || '[]');
      return (Array.isArray(dados) ? dados : [dados]).map((p) => ({ nome: p.Name, caminho: p.ExecutablePath || null }));
    } catch {
      return processos.listar(); // sem caminhos: fica só o RunningAppID
    }
  },
  executar(exe, args) {
    trava(exe);
    spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  },
  // abre pelo explorer.exe: sai do sandbox e nunca herda -dev nem elevação
  abrir(exe) {
    trava(exe);
    spawn(path.join(SYS, 'explorer.exe'), [exe], { detached: true, stdio: 'ignore' }).unref();
  },
  // só com --forcar e só depois dos 90 s
  async matar(nome) {
    try { await rodar('taskkill', ['/F', '/IM', nome]); } catch { /* já tinha saído */ }
  },
};

const registro = {
  async ler(chave, valor) {
    try {
      const saida = await rodar('reg', ['query', chave, '/v', valor], { timeout: 10_000 });
      const m = saida.match(new RegExp(`\\s${valor}\\s+REG_\\w+\\s+(.*)`));
      return m ? m[1].trim() : null;
    } catch { return null; }
  },
};

const UA = { 'User-Agent': 'steam-alfa-instalador/1.0.0' };
const rede = {
  async json(url) {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    return r.json();
  },
  async baixar(url, limite = 64 * 1024 * 1024) {
    const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > limite) throw new Error(`download grande demais (${buf.length} bytes)`);
    return buf;
  },
  // usado só pelo verificar --omega (localhost)
  async obter(url, { headers = {}, timeoutMs = 3000, metodo = 'GET', corpo } = {}) {
    const r = await fetch(url, { method: metodo, headers, body: corpo, signal: AbortSignal.timeout(timeoutMs) });
    return { status: r.status, texto: await r.text() };
  },
};

const relogio = {
  agora: () => Date.now(),
  dormir: (ms) => new Promise((ok) => setTimeout(ok, ms)),
};

// Authenticode dos binários (uma chamada só para todos)
async function assinatura(arquivos) {
  const env = { ...process.env, OMEGA_ARQS: JSON.stringify(arquivos) };
  const cmd = '$a = $env:OMEGA_ARQS | ConvertFrom-Json; @($a | ForEach-Object { $s = Get-AuthenticodeSignature -LiteralPath $_; '
    + '[pscustomobject]@{ arquivo = $_; status = $s.Status.ToString(); signatario = if ($s.SignerCertificate) { $s.SignerCertificate.Subject } else { "" } } }) | ConvertTo-Json -Compress';
  const saida = await rodar(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', cmd], { env });
  const dados = JSON.parse(saida || '[]');
  return Array.isArray(dados) ? dados : [dados];
}

// log no console + arquivo em instalar\log\<nome>-<carimbo>.log
export function criarLog({ nome, pasta = path.join(RAIZ, 'instalar', 'log'), silencioso = false } = {}) {
  const arquivo = path.join(pasta, `${nome}-${carimbo()}.log`);
  const log = (msg) => {
    if (!silencioso) console.log(msg);
    try { anexar(arquivo, `[${new Date().toISOString()}] ${msg}\n`); } catch { /* log nunca derruba o instalador */ }
  };
  log.arquivo = arquivo;
  return log;
}

export function depsReais({ nomeLog, pastaLog, silencioso } = {}) {
  return { processos, registro, rede, relogio, assinatura, log: criarLog({ nome: nomeLog ?? 'instalador', pasta: pastaLog, silencioso }) };
}
