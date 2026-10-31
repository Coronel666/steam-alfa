// Alfa na Steam · millennium\config\config.json (CONTRATO.md §7.1 passo 9 e §7.2)
// Só com a Steam FECHADA: o Millennium regrava o arquivo inteiro ao sair.
import { existe, lerTexto, gravarAtomico } from './disco.mjs';
import { ErroInstalador, TEMA, PLUGIN } from './constantes.mjs';

const ehObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const objeto = (x) => (ehObjeto(x) ? x : {});

// lê tolerando BOM; JSON inválido → erro (quem chamou não grava nada)
export function lerConfig(arquivo) {
  if (!existe(arquivo)) return { existia: false, cfg: {} };
  const texto = lerTexto(arquivo).replace(/^﻿/, '');
  if (!texto.trim()) return { existia: true, cfg: {} };
  let cfg;
  try { cfg = JSON.parse(texto); } catch (e) {
    // sem o trecho do arquivo na mensagem (o config pode ter senha de proxy)
    const pos = /position (\d+)/.exec(e.message)?.[1];
    throw new ErroInstalador('config_invalida', `O config.json do Millennium está com JSON inválido${pos ? ` perto do caractere ${pos}` : ''}. Não gravei nada. Arquivo: ${arquivo}`);
  }
  if (!ehObjeto(cfg)) throw new ErroInstalador('config_invalida', `O config.json do Millennium não é um objeto JSON. Não gravei nada. Arquivo: ${arquivo}`);
  return { existia: true, cfg };
}

// UTF-8 sem BOM, atômico
export function gravarConfig(arquivo, cfg) { gravarAtomico(arquivo, JSON.stringify(cfg, null, 4) + '\n'); }

const guardar = (obj, chave) => (ehObjeto(obj) && Object.hasOwn(obj, chave) ? { tem: true, valor: obj[chave] } : { tem: false });
const listaAtiva = (cfg) => (Array.isArray(cfg?.plugins?.enabledPlugins) ? cfg.plugins.enabledPlugins.filter((s) => typeof s === 'string') : []);

// valores antigos que o desfazer volta
export function fotografar(cfg) {
  return {
    activeTheme: guardar(cfg.themes, 'activeTheme'),
    onMillenniumUpdate: guardar(cfg.general, 'onMillenniumUpdate'),
    hasShownWelcomeModal: guardar(cfg.misc, 'hasShownWelcomeModal'),
    enabledPlugins: listaAtiva(cfg),
  };
}

// mescla sem apagar chave nenhuma; devolve os ids que entraram agora
export function mesclar(cfg, ids) {
  cfg.themes = objeto(cfg.themes);
  cfg.themes.activeTheme = TEMA;
  cfg.plugins = objeto(cfg.plugins);
  const lista = listaAtiva(cfg);
  const adicionados = [];
  for (const id of ids) if (!lista.includes(id)) { lista.push(id); adicionados.push(id); }
  cfg.plugins.enabledPlugins = lista; // só strings, sem duplicar (senão o Millennium zera a lista)
  cfg.general = objeto(cfg.general);
  cfg.general.onMillenniumUpdate = 1;
  cfg.misc = objeto(cfg.misc);
  cfg.misc.hasShownWelcomeModal = true;
  return adicionados;
}

const voltar = (obj, chave, antes) => { if (antes?.tem) obj[chave] = antes.valor; else delete obj[chave]; };

// desfaz cirúrgico: tira só o que nós pusemos; o que o Pedro mudou depois fica
export function desmesclar(cfg, info, { tudo = false } = {}) {
  const antes = info.antes ?? {};
  if (ehObjeto(cfg.plugins)) {
    if (Array.isArray(cfg.plugins.enabledPlugins)) {
      const nossos = new Set(info.idsAdicionados ?? []);
      cfg.plugins.enabledPlugins = cfg.plugins.enabledPlugins.filter((s) => typeof s === 'string' && !nossos.has(s));
    }
    delete cfg.plugins[PLUGIN];
  }
  if (ehObjeto(cfg.themes) && cfg.themes.activeTheme === TEMA) voltar(cfg.themes, 'activeTheme', antes.activeTheme);
  if (ehObjeto(cfg.general) && cfg.general.onMillenniumUpdate === 1) voltar(cfg.general, 'onMillenniumUpdate', antes.onMillenniumUpdate);
  // o aviso de boas-vindas só volta se o Millennium inteiro sair (ou se o arquivo foi criado por nós)
  if ((tudo || info.existia === false) && ehObjeto(cfg.misc) && cfg.misc.hasShownWelcomeModal === true) voltar(cfg.misc, 'hasShownWelcomeModal', antes.hasShownWelcomeModal);
  return cfg;
}

// sobrou só objeto/lista vazios?
export function vazio(x) {
  if (Array.isArray(x)) return x.length === 0;
  if (ehObjeto(x)) return Object.values(x).every(vazio);
  return false;
}
