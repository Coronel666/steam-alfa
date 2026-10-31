// Alfa na Steam · desfazer (CONTRATO.md §7.2). A lógica fica em lib/desfazer.mjs.
// uso: node instalar/desfazer.mjs [--steam "<pasta>"] [--dados "<pasta>"] [--tudo] [--nao-fechar] [--nao-abrir]
//                                 [--forcar] [--simular | --dry-run]
import { lerArgs } from './lib/args.mjs';
import { depsReais } from './lib/sistema.mjs';
import { desfazer } from './lib/desfazer.mjs';

const AJUDA = `Alfa na Steam · desfazer
  --steam "<pasta>"    pasta da Steam
  --dados "<pasta>"    onde ficaram backups e manifesto (padrão: Documents\\Steam Omega)
  --tudo               tira também o Millennium (só se foi o instalador que pôs), com os version.dll do hook
  --nao-fechar         para se a Steam estiver aberta
  --nao-abrir          não reabre a Steam no fim
  --forcar             se a Steam não fechar em 90 s, fecha à força
  --simular, --dry-run mostra o que faria, sem mudar nada`;

let a;
try {
  a = lerArgs(process.argv.slice(2), {
    flags: ['tudo', 'nao-fechar', 'nao-abrir', 'forcar', 'simular', 'dry-run'],
    valores: ['steam', 'dados', 'log'],
  });
} catch (e) { console.error(`FALHA  ${e.message}\n\n${AJUDA}`); process.exit(1); }
if (a.ajuda) { console.log(AJUDA); process.exit(0); }

const deps = depsReais({ nomeLog: 'desfazer', pastaLog: a.log });
try {
  await desfazer(a, deps);
  deps.log(`log: ${deps.log.arquivo}`);
} catch (e) {
  deps.log(`FALHA  ${e.message}`);
  if (!e.codigo) deps.log(String(e.stack ?? e));
  deps.log(`log: ${deps.log.arquivo}`);
  process.exitCode = 1;
}
