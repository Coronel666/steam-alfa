// Alfa na Steam · argumentos dos 3 scripts ("--sem-millennium" → semMillennium)
import { ErroInstalador } from './constantes.mjs';

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// flags: nomes sem valor; valores: nomes que pedem valor ("--steam <pasta>" ou "--steam=<pasta>")
export function lerArgs(argv, { flags = [], valores = [] } = {}) {
  const r = {};
  for (let i = 0; i < argv.length; i++) {
    const bruto = argv[i];
    if (bruto === '-h' || bruto === '--ajuda' || bruto === '--help') { r.ajuda = true; continue; }
    const m = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/.exec(bruto);
    if (!m) throw new ErroInstalador('argumento', `Argumento desconhecido: ${bruto}`);
    const [, nome, igual] = m;
    if (flags.includes(nome)) { r[camel(nome)] = true; continue; }
    if (valores.includes(nome)) {
      const v = igual ?? argv[++i];
      if (v == null || v === '' || (igual == null && v.startsWith('--'))) throw new ErroInstalador('argumento', `--${nome} precisa de um valor`);
      r[camel(nome)] = v;
      continue;
    }
    throw new ErroInstalador('argumento', `Opção desconhecida: --${nome}`);
  }
  if (r.dryRun) r.simular = true; // --dry-run = --simular
  return r;
}
