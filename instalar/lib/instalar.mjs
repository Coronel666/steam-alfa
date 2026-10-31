// Alfa na Steam · instalar (CONTRATO.md §7.1). Toda a lógica aqui; instalar/instalar.mjs só lê os argumentos.
// deps: { processos, registro, rede, relogio, assinatura, log, aoPasso? } (aoPasso = gancho dos testes)
import path from 'node:path';
import { existe, lerTexto, copiar, criarPasta, mesmoCaminho, hashArquivo } from './disco.mjs';
import {
  RAIZ, TEMA, PLUGIN, MILLENNIUM, COMUNIDADE, STEAMBREW, CHAVE_TRANSPARENCIA, VERSION_DLLS, VERSION_DLL_RAIZ, ErroInstalador,
} from './constantes.mjs';
import { resolverSteam, conferirJogo, steamAberta, fecharSteam, abrirSteam } from './steam.mjs';
import { lerConfig, fotografar, mesclar } from './configjson.mjs';
import { estadoMillennium, prepararMillennium } from './millennium.mjs';
import { prepararComunidade } from './comunidade.mjs';
import { pastaInstalador, lerPonteiro, novaPastaBackup, novoManifesto, Transacao } from './manifesto.mjs';

export function conferirTema(pasta) {
  const skin = path.join(pasta, 'skin.json');
  if (!existe(skin)) throw new ErroInstalador('tema_invalido', `Não achei ${skin}. O tema Alfa Glass precisa estar em theme\\${TEMA}.`);
  try { JSON.parse(lerTexto(skin).replace(/^﻿/, '')); } catch (e) {
    throw new ErroInstalador('tema_invalido', `skin.json do tema com JSON inválido (${e.message}). Sem isso o Millennium volta para o tema padrão.`);
  }
}

export async function instalar(opcoes = {}, deps) {
  const log = deps.log;
  const simular = !!(opcoes.simular || opcoes.dryRun);
  const M = opcoes.millennium ?? MILLENNIUM;            // os testes trocam por um Millennium falso
  const api = opcoes.apiComunidade ?? STEAMBREW;
  const lista = opcoes.comunidade ?? COMUNIDADE;
  const origemTema = opcoes.origemTema ?? path.join(RAIZ, 'theme', TEMA);
  const origemStar = opcoes.origemStar ?? path.join(RAIZ, 'plugin', PLUGIN, 'dist', `${PLUGIN}.star`);
  const resumo = {
    ok: false, simulado: simular, steam: null, millennium: 'sem mudança', tema: false, plugin: false,
    comunidade: [], falhas: [], avisos: [], pastaBackup: null, steamFechada: false, steamReaberta: false,
  };
  const aviso = (msg) => { resumo.avisos.push(msg); log(`aviso  ${msg}`); };

  log(`Alfa na Steam · instalador${simular ? ' (SIMULAÇÃO: nada é alterado)' : ''}`);

  // 1. pasta da Steam + o que vamos copiar (tudo conferido antes de mexer em qualquer coisa)
  const steam = await resolverSteam(opcoes, deps);
  resumo.steam = steam;
  log(`ok     pasta da Steam: ${steam}`);
  if (!existe(origemStar)) {
    throw new ErroInstalador('sem_build', `Não achei ${origemStar}: rode o build do plugin antes (npm run build em plugin\\${PLUGIN}).`);
  }
  conferirTema(origemTema);
  const arqCfg = path.join(steam, 'millennium', 'config', 'config.json');
  lerConfig(arqCfg); // JSON inválido para aqui, sem gravar nada

  // 2. jogo rodando? nunca fecha jogo
  await conferirJogo(steam, deps);
  log('ok     nenhum jogo rodando');

  // Millennium: pula se já existe; outra versão fica; wsock32.dll estranho = conflito
  const mil = estadoMillennium(steam, M);
  const instalarMil = !opcoes.semMillennium && !mil.dll;
  if (mil.dll && mil.dllIgual) log(`ok     Millennium v${M.versao} já instalado`);
  else if (mil.dll) aviso('já tem um Millennium de outra versão instalado: mantive (não rebaixo).');
  else if (opcoes.semMillennium) aviso('Millennium não instalado e você passou --sem-millennium: o tema e o plugin só funcionam com ele.');
  if (instalarMil && mil.proxy && !mil.proxyIgual) {
    throw new ErroInstalador('wsock32_conflito', 'Já existe um wsock32.dll de outro programa na pasta da Steam. Parei para não quebrar nada.');
  }

  // 3. Steam aberta?
  const aberta = await steamAberta(deps);
  if (aberta && opcoes.naoFechar) {
    throw new ErroInstalador('steam_aberta', 'A Steam está aberta e você passou --nao-fechar. Feche a Steam e rode de novo.');
  }
  const pastaInst = pastaInstalador(opcoes);
  const anterior = lerPonteiro(pastaInst);
  if (anterior && !mesmoCaminho(anterior.steam, steam)) {
    throw new ErroInstalador('outra_steam', `Já tem uma instalação ativa em "${anterior.steam}". Rode o desfazer nela antes.`);
  }
  if (anterior) log(`ok     instalação anterior encontrada (${anterior.atualizadoEm}): reinstalo por cima, guardando o original dela`);

  if (simular) {
    log('--- simulação: faria isto ---');
    if (aberta) log('...    fecharia a Steam com steam.exe -shutdown (espera até 90 s, nunca mata à força sem --forcar)');
    if (instalarMil) log(`...    baixaria o Millennium v${M.versao} (${M.url}), conferiria SHA-256 + 5 hashes + assinatura e copiaria para a raiz da Steam`);
    log(`...    copiaria o tema ${origemTema} → ${path.join(steam, 'millennium', 'themes', TEMA)}`);
    log(`...    copiaria ${origemStar} → ${path.join(steam, 'millennium', 'plugins', `${PLUGIN}.star`)}`);
    if (!opcoes.semComunidade) log(`...    baixaria do steambrew: ${lista.map((p) => p.exibido ?? p.nome).join(', ')}`);
    log(`...    mesclaria o config.json: activeTheme = ${TEMA}, enabledPlugins += ${[PLUGIN, ...(opcoes.semComunidade ? [] : lista.map((p) => p.nome))].join(', ')}`);
    log(`...    backup e manifesto em ${pastaInst}`);
    if (aberta && !opcoes.naoAbrir) log('...    reabriria a Steam');
    resumo.ok = true;
    return resumo;
  }

  let prepMil = null, prepCom = null, fechada = false;
  try {
    // downloads ANTES de fechar a Steam: se a rede falhar, nada foi tocado
    if (instalarMil) prepMil = await prepararMillennium(deps, M);
    if (!opcoes.semComunidade) prepCom = await prepararComunidade(deps, lista, api);

    await conferirJogo(steam, deps); // de novo, logo antes de fechar
    // a Steam também de novo: ela pode ter aberto durante os downloads (config.json só com a Steam fechada)
    const abertaAgora = await steamAberta(deps);
    if (abertaAgora && opcoes.naoFechar) {
      throw new ErroInstalador('steam_aberta', 'A Steam abriu durante os downloads e você passou --nao-fechar. Feche a Steam e rode de novo.');
    }
    if (abertaAgora) {
      const r = await fecharSteam(steam, deps, { forcar: !!opcoes.forcar });
      fechada = true;
      resumo.steamFechada = true;
      if (r.forcado) aviso('a Steam foi fechada à força (--forcar).');
    }
    const lido = lerConfig(arqCfg); // relê: o Millennium regrava ao sair

    // 4. backup + manifesto
    criarPasta(pastaInst);
    const pastaBackup = novaPastaBackup(pastaInst);
    resumo.pastaBackup = pastaBackup;
    const m = novoManifesto(steam, pastaBackup, anterior);
    const tx = new Transacao({ steam, pastaInst, pastaBackup, manifesto: m, anterior });
    const ids = [PLUGIN];
    try {
      tx.salvar();

      // 5. Millennium
      deps.aoPasso?.('millennium');
      if (prepMil) {
        // version.dll que o Millennium apaga (bin\cef\*) ou renomeia (raiz) no 1º boot: guarda o original antes
        for (const rel of [...VERSION_DLLS, VERSION_DLL_RAIZ]) {
          const abs = path.join(steam, ...rel.split('/'));
          if (existe(abs) && hashArquivo(abs) !== M.arquivos[M.hook] && tx.guardar('millennium', rel)) {
            log(`ok     guardei o ${rel} original (o Millennium mexe nele no 1º boot)`);
          }
        }
        for (const [rel, origem] of Object.entries(prepMil.arquivos)) tx.trocar('millennium', rel, (alvo) => copiar(origem, alvo));
        m.millennium = { instaladoPorNos: true, versao: M.versao, hashHook: M.arquivos[M.hook] };
        tx.salvar();
        resumo.millennium = `instalado v${M.versao}`;
        log(`ok     Millennium v${M.versao} copiado para a raiz da Steam`);
      }

      // 6. tema
      deps.aoPasso?.('tema');
      tx.trocar('tema', `millennium/themes/${TEMA}`, (alvo) => copiar(origemTema, alvo));
      resumo.tema = true;
      log(`ok     tema Alfa Glass → millennium\\themes\\${TEMA}`);

      // 7. plugin (nunca deixa a pasta omega-steam\ junto do .star)
      deps.aoPasso?.('plugin');
      tx.trocar('plugin', `millennium/plugins/${PLUGIN}`);
      tx.trocar('plugin', `millennium/plugins/${PLUGIN}.star`, (alvo) => copiar(origemStar, alvo));
      resumo.plugin = true;
      log(`ok     plugin Alfa na Steam → millennium\\plugins\\${PLUGIN}.star`);

      // 8. comunidade (pasta OU .star, nunca os dois com o mesmo nome)
      deps.aoPasso?.('comunidade');
      for (const p of prepCom?.prontos ?? []) {
        const pasta = `millennium/plugins/${p.nome}`, star = `${pasta}.star`;
        tx.trocar('comunidade', p.tipo === 'star' ? pasta : star);
        tx.trocar('comunidade', p.tipo === 'star' ? star : pasta, (alvo) => copiar(p.origem, alvo));
        const info = { nome: p.nome, id: p.id, versao: p.versao, commit: p.commit, sha256: p.sha256, tipo: p.tipo };
        const i = m.comunidade.findIndex((c) => c.nome === p.nome);
        if (i >= 0) m.comunidade[i] = info; else m.comunidade.push(info);
        ids.push(p.nome);
        resumo.comunidade.push(`${p.exibido ?? p.nome} ${p.versao}`);
        log(`ok     ${p.exibido ?? p.nome} → millennium\\plugins\\${p.nome}${p.tipo === 'star' ? '.star' : ''}`);
      }
      resumo.falhas = (prepCom?.falhas ?? []).map((f) => `${f.exibido ?? f.nome}: ${f.erro}`);

      // 9. config.json (Steam fechada)
      deps.aoPasso?.('config');
      const cfg = lido.cfg;
      const antes = fotografar(cfg);
      const idsAdicionados = mesclar(cfg, ids);
      tx.configurar(arqCfg, cfg, { existia: lido.existia, antes, idsAdicionados });
      tx.salvar();
      log(`ok     config.json: tema ${TEMA} ativo; enabledPlugins com ${ids.join(', ')}`);
    } catch (e) {
      log(`FALHA  ${e.message}`);
      log('...    voltando tudo que esta rodada mudou');
      tx.reverter(log);
      throw e;
    }
  } finally {
    prepMil?.limpar();
    prepCom?.limpar();
    // 10. reabre só se ela estava aberta (e mesmo se deu erro: a Steam volta como estava)
    if (fechada && !opcoes.naoAbrir) {
      try { abrirSteam(steam, deps); resumo.steamReaberta = true; } catch (e) { log(`aviso  não consegui reabrir a Steam: ${e.message}`); }
    }
  }

  // avisos finais
  if (resumo.comunidade.some((c) => c.startsWith('Extendium'))) {
    aviso('na 1ª abertura o Extendium fecha a Steam uma vez; é só abrir de novo.');
  }
  if (resumo.comunidade.some((c) => c.startsWith('Window Styler'))) {
    const t = await deps.registro.ler(CHAVE_TRANSPARENCIA, 'EnableTransparency');
    if (t != null && /^0x0$|^0$/.test(String(t).trim())) {
      aviso('os efeitos de transparência do Windows estão DESLIGADOS: o Window Styler (DWMX) não funciona assim (Configurações > Personalização > Cores).');
    } else if (t != null) log('ok     transparência do Windows ligada (DWMX ok)');
  }
  for (const f of resumo.falhas) aviso(`ficou de fora: ${f}`);

  resumo.ok = true;
  log('--- pronto ---');
  log(`Millennium: ${resumo.millennium} · tema: ${resumo.tema ? 'Alfa Glass' : '—'} · plugin: ${resumo.plugin ? PLUGIN : '—'}`);
  log(`comunidade: ${resumo.comunidade.length ? resumo.comunidade.join(', ') : 'nenhum'}`);
  log(`backup: ${resumo.pastaBackup}`);
  if (!fechada || opcoes.naoAbrir) log('abra a Steam quando quiser: o Alfa Glass entra sozinho.');
  return resumo;
}
