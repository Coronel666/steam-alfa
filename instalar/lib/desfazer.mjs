// Alfa na Steam · desfazer (CONTRATO.md §7.2). Nunca apaga coleções nem os backups em Documents\Steam Alfa.
import path from 'node:path';
import { existe, copiar, remover, removerSeVazia, gravarAtomico, lerTexto, mesmoCaminho, hashArquivo } from './disco.mjs';
import { MILLENNIUM, VERSION_DLL_RAIZ, VERSION_DLL_LEGADO, ErroInstalador } from './constantes.mjs';
import { resolverSteam, conferirJogo, steamAberta, fecharSteam, abrirSteam } from './steam.mjs';
import { lerConfig, gravarConfig, desmesclar, vazio } from './configjson.mjs';
import { hashesDoHook, versionDlls } from './millennium.mjs';
import { pastaInstalador, lerPonteiro, gravarPonteiro, apagarPonteiro, novaPastaBackup, relAbs } from './manifesto.mjs';

// o que o Millennium cria e o --tudo apaga (além dos 5 binários do manifesto)
const PASTAS_MILLENNIUM = ['millennium/lib', 'millennium/bin', 'millennium-migration-temp'];

export async function desfazer(opcoes = {}, deps) {
  const log = deps.log;
  const simular = !!(opcoes.simular || opcoes.dryRun);
  const M = opcoes.millennium ?? MILLENNIUM;
  const resumo = { ok: false, simulado: simular, nada: false, removidos: [], restaurados: [], millennium: 'mantido', avisos: [], steamFechada: false, steamReaberta: false };
  const aviso = (msg) => { resumo.avisos.push(msg); log(`aviso  ${msg}`); };

  log(`Alfa na Steam · desfazer${simular ? ' (SIMULAÇÃO: nada é alterado)' : ''}`);
  const steam = await resolverSteam(opcoes, deps);
  log(`ok     pasta da Steam: ${steam}`);
  const pastaInst = pastaInstalador(opcoes);
  const m = lerPonteiro(pastaInst);
  if (!m) {
    log(`ok     nada para desfazer (sem ultimo-install.json em ${pastaInst})`);
    resumo.ok = true; resumo.nada = true;
    return resumo;
  }
  if (!mesmoCaminho(m.steam, steam)) {
    throw new ErroInstalador('outra_steam', `A última instalação foi em "${m.steam}". Rode com --steam "${m.steam}".`);
  }
  const arqCfg = path.join(steam, 'millennium', 'config', 'config.json');
  if (m.config) lerConfig(arqCfg); // JSON inválido para aqui, sem gravar nada

  // mesmas travas do instalar
  await conferirJogo(steam, deps);
  log('ok     nenhum jogo rodando');
  const aberta = await steamAberta(deps);
  if (aberta && opcoes.naoFechar) {
    throw new ErroInstalador('steam_aberta', 'A Steam está aberta e você passou --nao-fechar. Feche a Steam e rode de novo.');
  }

  const milNosso = !!m.millennium?.instaladoPorNos;
  const tirarMil = !!opcoes.tudo && milNosso;
  if (opcoes.tudo && !milNosso) aviso('--tudo: o Millennium já existia antes do Alfa na Steam, então ele fica.');
  const itens = m.itens.filter((i) => i.grupo !== 'millennium' || tirarMil);

  if (simular) {
    log('--- simulação: faria isto ---');
    if (aberta) log('...    fecharia a Steam com steam.exe -shutdown');
    for (const i of itens) log(`...    ${i.existia ? 'voltaria o original de' : 'removeria'} ${i.rel}`);
    if (m.config) log('...    tiraria do config.json só o que o instalador pôs (tema ativo, ids em enabledPlugins, plugins.alfa-steam)');
    if (tirarMil) log('...    apagaria wsock32.dll, millennium\\lib, millennium\\bin, millennium-migration-temp e os version.dll do hook em bin\\cef\\*');
    if (aberta && !opcoes.naoAbrir) log('...    reabriria a Steam');
    resumo.ok = true;
    return resumo;
  }

  const erros = [];
  const tentar = (oque, fn) => { try { fn(); } catch (e) { erros.push(`${oque}: ${e.message}`); log(`FALHA  ${oque}: ${e.message}`); } };
  let fechada = false;
  try {
    if (aberta) {
      const r = await fecharSteam(steam, deps, { forcar: !!opcoes.forcar });
      fechada = true; resumo.steamFechada = true;
      if (r.forcado) aviso('a Steam foi fechada à força (--forcar).');
    }
    const pastaDesf = novaPastaBackup(pastaInst, 'desfazer-');

    // config.json cirúrgico (o atual vai antes para o backup do desfazer)
    if (m.config) {
      tentar('config.json', () => {
        const lido = lerConfig(arqCfg);
        if (!lido.existia) return;
        copiar(arqCfg, path.join(pastaDesf, 'config.json'));
        const cfg = desmesclar(lido.cfg, m.config, { tudo: tirarMil });
        if (m.config.existia === false && vazio(cfg)) remover(arqCfg); else gravarConfig(arqCfg, cfg);
        log('ok     config.json: tirei só o que o instalador tinha posto');
      });
    }

    // Millennium inteiro (--tudo): hash do hook ANTES de apagar millennium\lib
    if (tirarMil) {
      const hashes = hashesDoHook(steam, M, [m.millennium.hashHook]);
      for (const v of versionDlls(steam, hashes)) {
        if (!v.existe) continue;
        if (v.doHook) tentar(v.rel, () => { remover(v.abs); resumo.removidos.push(v.rel); log(`ok     apaguei ${v.rel} (hook do Millennium)`); });
        else aviso(`${v.rel} não é o hook do Millennium (hash diferente): ficou`);
      }
      for (const rel of PASTAS_MILLENNIUM) {
        const abs = relAbs(steam, rel);
        if (existe(abs)) tentar(rel, () => { remover(abs); resumo.removidos.push(rel); });
      }
      resumo.millennium = 'removido';
    }

    // itens: tira o nosso e volta o original (ordem inversa da instalação)
    for (const i of [...itens].reverse()) {
      tentar(i.rel, () => {
        const alvo = relAbs(steam, i.rel);
        if (i.guardado) {
          // original que o Millennium apaga/renomeia no 1º boot: volta só se o lugar ficou vazio (nunca pisa em outro arquivo)
          if (!existe(alvo)) {
            if (i.backup && existe(i.backup)) { copiar(i.backup, alvo); resumo.restaurados.push(i.rel); }
            else aviso(`o backup de ${i.rel} sumiu: não deu para voltar o original`);
          }
          // version.dll da raiz: o Millennium deixou a cópia renomeada; com o original de volta no lugar, ela sai
          const legado = relAbs(steam, VERSION_DLL_LEGADO);
          if (i.rel === VERSION_DLL_RAIZ && i.sha256 && existe(alvo) && hashArquivo(alvo) === i.sha256
            && existe(legado) && hashArquivo(legado) === i.sha256) {
            remover(legado); resumo.removidos.push(VERSION_DLL_LEGADO);
          }
          return;
        }
        if (existe(alvo)) { remover(alvo); resumo.removidos.push(i.rel); }
        if (i.existia) {
          if (i.backup && existe(i.backup)) { copiar(i.backup, alvo); resumo.restaurados.push(i.rel); }
          else aviso(`o backup de ${i.rel} sumiu: não deu para voltar o original`);
        }
      });
    }
    log(`ok     removidos ${resumo.removidos.length}, originais de volta ${resumo.restaurados.length}`);

    // pastas que nós criamos e ficaram vazias (com o Millennium ainda instalado, deixa as dele)
    const semMillennium = !existe(relAbs(steam, M.dll));
    if (semMillennium) {
      const fundas = [...m.pastasCriadas].sort((a, b) => b.split('/').length - a.split('/').length);
      for (const rel of fundas) tentar(rel, () => removerSeVazia(relAbs(steam, rel)));
    }

    if (erros.length) {
      throw new ErroInstalador('desfazer_incompleto', `Desfazer incompleto (${erros.length} erro(s)); o ultimo-install.json ficou para tentar de novo.`);
    }

    // ponteiro: com o Millennium nosso ainda instalado, fica só ele para um "desfazer --tudo" depois
    if (milNosso && !tirarMil) {
      const resto = {
        ...m, atualizadoEm: new Date().toISOString(), parcialEm: new Date().toISOString(),
        itens: m.itens.filter((i) => i.grupo === 'millennium'), comunidade: [], config: null,
        pastasCriadas: m.pastasCriadas.filter((p) => existe(relAbs(steam, p))),
      };
      gravarPonteiro(pastaInst, resto);
      log('ok     o Millennium ficou instalado (para tirar ele também: desfazer --tudo)');
    } else {
      apagarPonteiro(pastaInst);
    }
    try {
      const arqMan = path.join(m.pastaBackup, 'manifesto.json');
      if (existe(arqMan)) gravarAtomico(arqMan, JSON.stringify({ ...JSON.parse(lerTexto(arqMan)), desfeitoEm: new Date().toISOString() }, null, 2));
    } catch { /* só anotação */ }
  } finally {
    if (fechada && !opcoes.naoAbrir) {
      try { abrirSteam(steam, deps); resumo.steamReaberta = true; } catch (e) { log(`aviso  não consegui reabrir a Steam: ${e.message}`); }
    }
  }

  resumo.ok = true;
  log('--- pronto: Alfa na Steam desfeito ---');
  log(`Millennium: ${resumo.millennium} · backups guardados em ${pastaInst}`);
  return resumo;
}
