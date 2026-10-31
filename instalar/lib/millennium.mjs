// Alfa na Steam · Millennium v3.6.2 (CONTRATO.md §7.1 passo 5; millennium-v3.md §1.1 e §1.5)
import path from 'node:path';
import { criarPasta, existe, gravar, hashArquivo, hashBuffer, pastaTemp, remover } from './disco.mjs';
import { extrairZip } from './sistema.mjs';
import { ErroInstalador, VERSION_DLLS } from './constantes.mjs';

const naSteam = (steam, rel) => path.join(steam, ...rel.split('/'));

// o que já existe na pasta da Steam (só leitura)
export function estadoMillennium(steam, M) {
  const dll = naSteam(steam, M.dll);
  const proxy = naSteam(steam, M.proxy);
  const temDll = existe(dll);
  const temProxy = existe(proxy);
  return {
    dll: temDll,
    dllIgual: temDll && hashArquivo(dll) === M.arquivos[M.dll],
    proxy: temProxy,
    proxyIgual: temProxy && hashArquivo(proxy) === M.arquivos[M.proxy],
  };
}

// baixa, confere o SHA-256 do zip, extrai no %TEMP%, confere os 5 hashes e a assinatura. Nada na Steam ainda.
export async function prepararMillennium(deps, M) {
  const log = deps.log;
  log(`...    baixando o Millennium v${M.versao} oficial`);
  const buf = await deps.rede.baixar(M.url);
  const sha = hashBuffer(buf);
  if (sha !== M.sha256) {
    throw new ErroInstalador('millennium_hash', `O SHA-256 do zip do Millennium não bate (veio ${sha}, esperado ${M.sha256}). Não copiei nada.`);
  }
  log(`ok     zip do Millennium conferido (sha256 ${sha.slice(0, 12)}…)`);
  const tmp = pastaTemp('steam-alfa-millennium-');
  const limpar = () => { try { remover(tmp); } catch { /* temp: tanto faz */ } };
  try {
    const zip = path.join(tmp, 'millennium.zip');
    const pasta = path.join(tmp, 'x');
    gravar(zip, buf);
    criarPasta(pasta);
    extrairZip(zip, pasta);
    remover(zip); // apaga o zip assim que extraiu
    const arquivos = {};
    for (const [rel, esperado] of Object.entries(M.arquivos)) {
      const abs = naSteam(pasta, rel);
      if (!existe(abs)) throw new ErroInstalador('millennium_conteudo', `O zip do Millennium veio sem ${rel}. Não copiei nada.`);
      const h = hashArquivo(abs);
      if (h !== esperado) throw new ErroInstalador('millennium_conteudo', `${rel} do Millennium com hash diferente (${h}). Não copiei nada.`);
      arquivos[rel] = abs;
    }
    const assinaturas = await deps.assinatura(Object.values(arquivos));
    for (const abs of Object.values(arquivos)) {
      const s = assinaturas.find((a) => path.resolve(a.arquivo).toLowerCase() === path.resolve(abs).toLowerCase());
      if (!s || s.status !== 'Valid' || !String(s.signatario ?? '').includes(M.signatario)) {
        throw new ErroInstalador('millennium_assinatura', `Assinatura de ${path.basename(abs)} não é "${M.signatario}" válida (${s?.status ?? 'sem resposta'}). Não copiei nada.`);
      }
    }
    log(`ok     5 binários do Millennium conferidos (hash + assinatura ${M.signatario})`);
    return { arquivos, limpar };
  } catch (e) {
    limpar();
    throw e;
  }
}

// hashes que contam como "o hook do Millennium" para apagar os version.dll
export function hashesDoHook(steam, M, extras = []) {
  const lista = new Set([M.arquivos[M.hook], ...extras].filter(Boolean));
  const hook = naSteam(steam, M.hook);
  if (existe(hook)) lista.add(hashArquivo(hook));
  return lista;
}

// version.dll em bin\cef\*: só os que batem com o hook (o resto é de outro programa e fica)
export function versionDlls(steam, hashes) {
  return VERSION_DLLS.map((rel) => {
    const abs = naSteam(steam, rel);
    if (!existe(abs)) return { rel, abs, existe: false, doHook: false };
    return { rel, abs, existe: true, doHook: hashes.has(hashArquivo(abs)) };
  });
}
