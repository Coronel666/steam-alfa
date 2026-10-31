// Alfa na Steam · manifesto, ponteiro ultimo-install.json e a transação de cada rodada (CONTRATO.md §7.1 passo 4 e §7.2)
// "itens" guarda o estado ORIGINAL (de antes do Alfa na Steam) de cada caminho que tocamos. Reinstalar herda o original
// da rodada anterior; assim o desfazer sempre volta para antes da 1ª instalação.
import os from 'node:os';
import path from 'node:path';
import { existe, lerTexto, gravarAtomico, copiar, remover, removerSeVazia, criarPasta, carimbo, hashArquivo } from './disco.mjs';
import { gravarConfig } from './configjson.mjs';

export const FORMATO = 'steam-alfa-instalador-v1';
const PONTEIRO = 'ultimo-install.json';

export function pastaInstalador(opcoes = {}) {
  const base = opcoes.dados || process.env.STEAM_OMEGA_DADOS
    || path.join(process.env.USERPROFILE || os.homedir(), 'Documents', 'Steam Alfa');
  return path.join(base, 'instalador');
}

export function lerPonteiro(pastaInst) {
  const arq = path.join(pastaInst, PONTEIRO);
  if (!existe(arq)) return null;
  try {
    const m = JSON.parse(lerTexto(arq).replace(/^﻿/, ''));
    return m?.formato === FORMATO ? m : null;
  } catch { return null; }
}
export const gravarPonteiro = (pastaInst, m) => gravarAtomico(path.join(pastaInst, PONTEIRO), JSON.stringify(m, null, 2));
export function apagarPonteiro(pastaInst) { const arq = path.join(pastaInst, PONTEIRO); if (existe(arq)) remover(arq); }

// pasta nova desta rodada (nunca reaproveita)
export function novaPastaBackup(pastaInst, prefixo = '') {
  let p = path.join(pastaInst, prefixo + carimbo());
  for (let i = 2; existe(p); i++) p = path.join(pastaInst, `${prefixo}${carimbo()}-${i}`);
  criarPasta(p);
  return p;
}

export const relAbs = (steam, rel) => path.join(steam, ...rel.split('/'));
const mesmoRel = (a, b) => a.toLowerCase() === b.toLowerCase();

export function novoManifesto(steam, pastaBackup, anterior) {
  const agora = new Date().toISOString();
  return {
    formato: FORMATO,
    versaoInstalador: '0.1.0',
    criadoEm: anterior?.criadoEm ?? agora,
    atualizadoEm: agora,
    steam,
    pastaBackup,
    backups: [...(anterior?.backups ?? []), pastaBackup],
    millennium: anterior?.millennium?.instaladoPorNos ? { ...anterior.millennium } : { instaladoPorNos: false, versao: null },
    itens: (anterior?.itens ?? []).map((i) => ({ ...i })),
    comunidade: (anterior?.comunidade ?? []).map((c) => ({ ...c })),
    config: anterior?.config ? { ...anterior.config, idsAdicionados: [...(anterior.config.idsAdicionados ?? [])] } : null,
    pastasCriadas: [...(anterior?.pastasCriadas ?? [])],
  };
}

export class Transacao {
  constructor({ steam, pastaInst, pastaBackup, manifesto, anterior, simular = false }) {
    Object.assign(this, { steam, pastaInst, pastaBackup, m: manifesto, anterior, simular });
    this.ops = [];
  }

  item(rel) { return this.m.itens.find((i) => mesmoRel(i.rel, rel)); }

  salvar() {
    this.m.atualizadoEm = new Date().toISOString();
    const texto = JSON.stringify(this.m, null, 2);
    gravarAtomico(path.join(this.pastaBackup, 'manifesto.json'), texto);
    gravarPonteiro(this.pastaInst, this.m);
  }

  // cria as pastas que faltam e lembra quais fomos nós que criamos
  garantirPasta(relDir) {
    const partes = relDir.split('/').filter((p) => p && p !== '.');
    for (let i = 1; i <= partes.length; i++) {
      const rel = partes.slice(0, i).join('/');
      const abs = relAbs(this.steam, rel);
      if (existe(abs)) continue;
      criarPasta(abs);
      this.ops.push({ pasta: abs });
      if (!this.m.pastasCriadas.some((p) => mesmoRel(p, rel))) this.m.pastasCriadas.push(rel);
    }
  }

  // tira o que existe em rel (com backup) e, se mandou, escreve o novo
  trocar(grupo, rel, escrever) {
    const alvo = relAbs(this.steam, rel);
    const existia = existe(alvo);
    if (!existia && !escrever) return;
    let bk = null;
    if (existia) {
      bk = path.join(this.pastaBackup, 'steam', ...rel.split('/'));
      copiar(alvo, bk);
    }
    // pastas antes do arquivo: no reverter (ordem inversa) o arquivo sai primeiro e a pasta vazia depois
    if (escrever) this.garantirPasta(path.posix.dirname(rel));
    this.ops.push({ alvo, bk });
    if (!this.item(rel)) this.m.itens.push({ grupo, rel, existia, backup: bk });
    this.salvar();
    if (existia) remover(alvo);
    if (escrever) escrever(alvo);
    this.salvar();
  }

  // só guarda o original (backup + item), sem tirar do lugar: para o que o Millennium apaga ou renomeia no 1º boot.
  // Nada muda na Steam nesta hora, então não entra em this.ops (o reverter não tem o que voltar).
  guardar(grupo, rel) {
    const alvo = relAbs(this.steam, rel);
    if (this.item(rel) || !existe(alvo)) return false;
    const bk = path.join(this.pastaBackup, 'steam', ...rel.split('/'));
    copiar(alvo, bk);
    this.m.itens.push({ grupo, rel, existia: true, backup: bk, guardado: true, sha256: hashArquivo(alvo) });
    this.salvar();
    return true;
  }

  // grava o config.json (o original fica em <backup>\config.json)
  configurar(arqCfg, cfg, info) {
    const existia = existe(arqCfg);
    const bk = existia ? path.join(this.pastaBackup, 'config.json') : null;
    if (bk) copiar(arqCfg, bk);
    this.garantirPasta('millennium/config');
    this.ops.push({ alvo: arqCfg, bk });
    if (this.m.config) {
      const ids = new Set([...(this.m.config.idsAdicionados ?? []), ...info.idsAdicionados]);
      this.m.config.idsAdicionados = [...ids];
    } else {
      this.m.config = { existia: info.existia, backup: bk, antes: info.antes, idsAdicionados: info.idsAdicionados };
    }
    this.salvar();
    gravarConfig(arqCfg, cfg);
  }

  // deu erro no meio: volta tudo que ESTA rodada fez, na ordem inversa
  reverter(log = () => {}) {
    for (const op of [...this.ops].reverse()) {
      try {
        if (op.pasta) { removerSeVazia(op.pasta); continue; }
        remover(op.alvo);
        if (op.bk) copiar(op.bk, op.alvo);
      } catch (e) { log(`aviso  não consegui voltar ${op.alvo ?? op.pasta}: ${e.message}`); }
    }
    try {
      if (this.anterior) gravarPonteiro(this.pastaInst, this.anterior); else apagarPonteiro(this.pastaInst);
      gravarAtomico(path.join(this.pastaBackup, 'manifesto.json'), JSON.stringify({ ...this.m, revertidoEm: new Date().toISOString() }, null, 2));
    } catch (e) { log(`aviso  não consegui regravar o manifesto: ${e.message}`); }
  }
}
