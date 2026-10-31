// Alfa na Steam · pasta da Steam, jogo rodando, fechar e abrir a Steam (CONTRATO.md §7.1 passos 1–3 e 10)
import path from 'node:path';
import { existe, lerTexto, trava, dentro } from './disco.mjs';
import {
  PADRAO_STEAM, CHAVE_STEAM, ErroInstalador, ESPERA_FECHAR_MS, ESPERA_FORCAR_MS, PASSO_ESPERA_MS,
} from './constantes.mjs';

// argumento > registro > padrão (função pura, testada)
export function escolherPastaSteam(argumento, doRegistro) {
  const bruto = (argumento && String(argumento).trim()) || (doRegistro && String(doRegistro).trim()) || PADRAO_STEAM;
  return path.normalize(bruto.replace(/\//g, '\\')).replace(/[\\/]+$/, '');
}

export async function resolverSteam(opcoes, deps) {
  const doRegistro = opcoes.steam ? null : await deps.registro.ler(CHAVE_STEAM, 'SteamPath');
  const steam = escolherPastaSteam(opcoes.steam, doRegistro);
  trava(steam);
  if (!existe(path.join(steam, 'steam.exe'))) {
    throw new ErroInstalador('sem_steam', `Não achei steam.exe em "${steam}". Use --steam "<pasta da Steam>".`);
  }
  return steam;
}

// "0x1a2b" / "6699" / null → número
export function numeroDoRegistro(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  const n = /^0x/i.test(s) ? parseInt(s, 16) : parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

// pastas de biblioteca: a da Steam + as de steamapps\libraryfolders.vdf
export function bibliotecas(steam) {
  const libs = [steam];
  const vdf = path.join(steam, 'steamapps', 'libraryfolders.vdf');
  try {
    if (existe(vdf)) {
      for (const m of lerTexto(vdf).matchAll(/"path"\s+"([^"]+)"/gi)) libs.push(path.normalize(m[1].replace(/\\\\/g, '\\')));
    }
  } catch { /* vdf ilegível: fica só a principal */ }
  const vistos = new Set();
  return libs.filter((l) => { const k = l.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// ferramentas que moram em steamapps\common mas ficam sempre abertas e não são jogo (o Pedro usa as duas o tempo todo)
const FERRAMENTAS_SEMPRE_ABERTAS = new Set(['wallpaper_engine', 'lossless scaling'])
const ehFerramenta = (caminho, comum) => FERRAMENTAS_SEMPRE_ABERTAS.has(path.relative(comum, caminho).split(/[\\/]/)[0].toLowerCase())

// jogo rodando = RunningAppID ≠ 0 ou algum processo dentro de <biblioteca>\steamapps\common (menos as ferramentas acima)
export async function jogoRodando(steam, deps) {
  const appid = numeroDoRegistro(await deps.registro.ler(CHAVE_STEAM, 'RunningAppID'));
  if (appid) return { motivo: 'registro', appid, texto: `RunningAppID ${appid}` };
  const comuns = bibliotecas(steam).map((l) => path.join(l, 'steamapps', 'common'));
  const lista = await deps.processos.listarComCaminho();
  const p = lista.find((x) => x.caminho && comuns.some((c) => dentro(x.caminho, c) && !ehFerramenta(x.caminho, c)));
  if (p) return { motivo: 'processo', processo: p.nome, caminho: p.caminho, texto: `${p.nome} (${p.caminho})` };
  return null;
}

export async function conferirJogo(steam, deps) {
  const jogo = await jogoRodando(steam, deps);
  if (jogo) throw new ErroInstalador('jogo_rodando', `Tem jogo rodando, feche o jogo e rode de novo. (${jogo.texto})`);
}

const EH_STEAM = /^steam(webhelper)?\.exe$/i;
export async function steamAberta(deps) {
  const lista = await deps.processos.listar();
  return lista.some((p) => EH_STEAM.test(p.nome ?? ''));
}

async function esperarFechar(deps, limiteMs) {
  const t0 = deps.relogio.agora();
  while (deps.relogio.agora() - t0 < limiteMs) {
    await deps.relogio.dormir(PASSO_ESPERA_MS);
    if (!(await steamAberta(deps))) return true;
  }
  return false;
}

// fecha com elegância: steam.exe -shutdown e espera steam.exe + steamwebhelper.exe sumirem
export async function fecharSteam(steam, deps, { forcar = false } = {}) {
  const log = deps.log;
  log('...    fechando a Steam com elegância (steam.exe -shutdown)');
  deps.processos.executar(path.join(steam, 'steam.exe'), ['-shutdown']);
  if (await esperarFechar(deps, ESPERA_FECHAR_MS)) { log('ok     Steam fechada'); return { forcado: false }; }
  if (!forcar) {
    throw new ErroInstalador('steam_nao_fechou',
      'A Steam não fechou em 90 s. Feche pela bandeja (Steam > Sair) e rode de novo (ou rode com --forcar).');
  }
  log('aviso  a Steam não fechou em 90 s: fechando à força porque você passou --forcar');
  await deps.processos.matar('steamwebhelper.exe');
  await deps.processos.matar('steam.exe');
  if (await esperarFechar(deps, ESPERA_FORCAR_MS)) { log('ok     Steam fechada (à força)'); return { forcado: true }; }
  throw new ErroInstalador('steam_nao_fechou', 'A Steam não fechou nem à força. Feche pelo Gerenciador de Tarefas e rode de novo.');
}

// reabre sem -dev, pelo explorer.exe
export function abrirSteam(steam, deps) {
  deps.processos.abrir(path.join(steam, 'steam.exe'));
  deps.log('ok     Steam reaberta');
}
