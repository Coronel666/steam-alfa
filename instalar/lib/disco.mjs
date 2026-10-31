// Alfa na Steam · disco com a trava dos testes (CONTRATO.md §7.4)
// Com STEAM_OMEGA_TESTE=1: qualquer caminho dentro da Steam real lança erro, e escrita fora do %TEMP% também.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PADRAO_STEAM } from './constantes.mjs';

let steamDoRegistroReal; // cache (lido só uma vez, só leitura)

export const modoTeste = () => process.env.STEAM_OMEGA_TESTE === '1';

const norm = (p) => path.resolve(String(p)).toLowerCase().replace(/[\\/]+$/, '');
export function dentro(p, raiz) {
  if (!p || !raiz) return false;
  const a = norm(p), b = norm(raiz);
  return a === b || a.startsWith(b + path.sep);
}
export const mesmoCaminho = (a, b) => norm(a) === norm(b);

function steamReal() {
  if (steamDoRegistroReal === undefined) {
    steamDoRegistroReal = null;
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
        { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 });
      const m = out.match(/SteamPath\s+REG_\w+\s+(.+)/);
      if (m) steamDoRegistroReal = path.normalize(m[1].trim());
    } catch { /* sem registro: só o padrão */ }
  }
  return steamDoRegistroReal;
}

// lança se o caminho for proibido no modo de teste
export function trava(caminho, escrita = false) {
  if (!modoTeste()) return;
  for (const raiz of [PADRAO_STEAM, steamReal()]) {
    if (raiz && dentro(caminho, raiz)) throw new Error(`TRAVA DE TESTE: caminho da Steam real recusado (${caminho})`);
  }
  if (escrita && !dentro(caminho, os.tmpdir())) throw new Error(`TRAVA DE TESTE: escrita fora do %TEMP% recusada (${caminho})`);
}

export function existe(p) { trava(p); return fs.existsSync(p); }
export function ehPasta(p) { trava(p); try { return fs.statSync(p).isDirectory(); } catch { return false; } }
export function lerTexto(p) { trava(p); return fs.readFileSync(p, 'utf8'); }
export function lerBuffer(p) { trava(p); return fs.readFileSync(p); }
export function listar(p) { trava(p); try { return fs.readdirSync(p); } catch { return []; } }

export function criarPasta(p) { trava(p, true); fs.mkdirSync(p, { recursive: true }); }

export function gravar(p, dados) {
  trava(p, true);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, dados);
}

// tmp + rename na mesma pasta: ou fica o antigo inteiro, ou o novo inteiro
export function gravarAtomico(p, texto) {
  trava(p, true);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.omega-tmp`;
  fs.writeFileSync(tmp, texto, 'utf8');
  fs.renameSync(tmp, p);
}

export function anexar(p, texto) {
  trava(p, true);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, texto, 'utf8');
}

// copia arquivo ou pasta (por cópia, não rename: backup pode estar em outro disco)
export function copiar(origem, destino) {
  trava(origem); trava(destino, true);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.cpSync(origem, destino, { recursive: true, force: true, preserveTimestamps: true });
}

export function remover(p) {
  trava(p, true);
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

export function removerSeVazia(p) {
  trava(p, true);
  try {
    if (fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0) { fs.rmdirSync(p); return true; }
  } catch { /* não existe */ }
  return false;
}

export function pastaTemp(prefixo) { return fs.mkdtempSync(path.join(os.tmpdir(), prefixo)); }

export const hashBuffer = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export function hashArquivo(p) { trava(p); return hashBuffer(fs.readFileSync(p)); }

// "2026-10-30T22-05-01-123Z" (sem : e . para nome de pasta)
export const carimbo = (d = new Date()) => d.toISOString().replace(/[:.]/g, '-');
