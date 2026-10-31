// Alfa na Steam · plugins da comunidade pelo id do steambrew (CONTRATO.md §7.1 passo 8; plugins-comunidade.md §2 e §5)
import path from 'node:path';
import { criarPasta, existe, gravar, hashBuffer, lerTexto, listar, ehPasta, pastaTemp, remover } from './disco.mjs';
import { extrairZip } from './sistema.mjs';
import { STEAMBREW } from './constantes.mjs';

// só aceita download do próprio steambrew
export function urlDeDownload(api, downloadUrl) {
  if (typeof downloadUrl !== 'string' || !downloadUrl) throw new Error('ficha sem downloadUrl');
  if (downloadUrl.startsWith('/api/')) return api + downloadUrl;
  const u = new URL(downloadUrl);
  if (u.protocol === 'https:' && u.origin === new URL(api).origin) return u.href;
  throw new Error(`downloadUrl fora do steambrew (${u.origin})`);
}

// zip = "PK"; senão é .star (recusa HTML/JSON de página de erro)
export function tipoDoArquivo(buf) {
  if (!buf?.length) return null;
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'pasta';
  const c = String.fromCharCode(buf[0]);
  if (c === '<' || c === '{' || c === '[') return null;
  return 'star';
}

async function prepararUm(deps, api, p, tmpRaiz) {
  const info = await deps.rede.json(`${api}/api/v1/plugin/${p.id}`);
  if (!info?.hasValidBuild) throw new Error('build inválido no steambrew');
  if (info.pluginJson?.name !== p.nome) throw new Error(`o id ${p.id} agora aponta para "${info.pluginJson?.name}"`);
  const buf = await deps.rede.baixar(urlDeDownload(api, info.downloadUrl));
  const tipo = tipoDoArquivo(buf);
  if (!tipo) throw new Error('download não é zip nem .star');
  const base = {
    ...p, tipo, sha256: hashBuffer(buf),
    versao: info.pluginJson?.version ?? String(info.commitId ?? '').slice(0, 7),
    commit: info.commitId ?? null,
  };
  const tmp = path.join(tmpRaiz, p.nome);
  criarPasta(tmp);
  if (tipo === 'star') {
    const origem = path.join(tmp, `${p.nome}.star`);
    gravar(origem, buf);
    return { ...base, origem };
  }
  // zip: extrai TUDO no temp antes de mexer na Steam
  const zip = path.join(tmp, 'p.zip'), x = path.join(tmp, 'x');
  gravar(zip, buf);
  criarPasta(x);
  extrairZip(zip, x);
  remover(zip);
  const pastas = listar(x).filter((n) => ehPasta(path.join(x, n)));
  const raiz = pastas.length === 1 && !existe(path.join(x, 'plugin.json')) ? path.join(x, pastas[0]) : x;
  const pj = path.join(raiz, 'plugin.json');
  if (!existe(pj)) throw new Error('zip sem plugin.json');
  let nome;
  try { nome = JSON.parse(lerTexto(pj).replace(/^﻿/, '')).name; } catch { throw new Error('plugin.json inválido'); }
  if (nome !== p.nome) throw new Error(`plugin.json diz "${nome}"`);
  return { ...base, origem: raiz };
}

// baixa e confere todos no %TEMP%; quem falhar fica de fora (avisado), os outros seguem
export async function prepararComunidade(deps, lista, api = STEAMBREW) {
  const log = deps.log;
  const tmpRaiz = pastaTemp('steam-alfa-comunidade-');
  const prontos = [], falhas = [];
  for (const p of lista) {
    try {
      const r = await prepararUm(deps, api, p, tmpRaiz);
      prontos.push(r);
      log(`ok     ${p.exibido ?? p.nome} ${r.versao} baixado (${r.tipo === 'star' ? '.star' : 'zip'}, sha256 ${r.sha256.slice(0, 12)}…)`);
    } catch (e) {
      falhas.push({ ...p, erro: e.message });
      log(`aviso  ${p.exibido ?? p.nome} (${p.id}) ficou de fora: ${e.message}`);
    }
  }
  return { prontos, falhas, limpar: () => { try { remover(tmpRaiz); } catch { /* temp */ } } };
}
