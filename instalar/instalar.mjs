// Alfa na Steam · instalador (CONTRATO.md §7.1). A lógica fica em lib/instalar.mjs.
// uso: node instalar/instalar.mjs [--steam "<pasta>"] [--dados "<pasta>"] [--sem-millennium] [--sem-comunidade]
//                                 [--nao-fechar] [--nao-abrir] [--forcar] [--simular | --dry-run]
import { lerArgs } from './lib/args.mjs';
import { depsReais } from './lib/sistema.mjs';
import { instalar } from './lib/instalar.mjs';

const AJUDA = `Alfa na Steam · instalar
  --steam "<pasta>"    pasta da Steam (padrão: registro, depois C:\\Program Files (x86)\\Steam)
  --dados "<pasta>"    onde ficam backups e manifesto (padrão: Documents\\Steam Omega)
  --sem-millennium     não instala o Millennium
  --sem-comunidade     não instala os plugins da comunidade
  --nao-fechar         para se a Steam estiver aberta (não fecha)
  --nao-abrir          não reabre a Steam no fim
  --forcar             se a Steam não fechar em 90 s, fecha à força
  --simular, --dry-run mostra o que faria, sem mudar nada`;

let a;
try {
  a = lerArgs(process.argv.slice(2), {
    flags: ['sem-millennium', 'sem-comunidade', 'nao-fechar', 'nao-abrir', 'forcar', 'simular', 'dry-run'],
    valores: ['steam', 'dados', 'log'],
  });
} catch (e) { console.error(`FALHA  ${e.message}\n\n${AJUDA}`); process.exit(1); }
if (a.ajuda) { console.log(AJUDA); process.exit(0); }

const deps = depsReais({ nomeLog: 'instalar', pastaLog: a.log });
try {
  await instalar(a, deps);
  deps.log(`log: ${deps.log.arquivo}`);
} catch (e) {
  deps.log(`FALHA  ${e.message}`);
  if (!e.codigo) deps.log(String(e.stack ?? e));
  deps.log(`log: ${deps.log.arquivo}`);
  process.exitCode = 1;
}
