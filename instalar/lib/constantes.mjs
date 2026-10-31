// Alfa na Steam · constantes do instalador (CONTRATO.md §1 e §7; hashes do millennium-v3.md §1.1)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// raiz do projeto steam-omega (instalar/lib → ../..)
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const TEMA = 'alfa-glass';
export const PLUGIN = 'alfa-steam';
export const PADRAO_STEAM = 'C:\\Program Files (x86)\\Steam';
export const CHAVE_STEAM = 'HKCU\\Software\\Valve\\Steam';
export const CHAVE_TRANSPARENCIA = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';

// Millennium v3.6.2 oficial (release fixo, nunca "latest")
export const MILLENNIUM = Object.freeze({
  versao: '3.6.2',
  url: 'https://github.com/SteamClientHomebrew/Millennium/releases/download/v3.6.2/millennium-v3.6.2-windows-x86_64.zip',
  sha256: 'cd78cf680563491d24f58a4fc948dcfc7cb3b38523ac80162845e52b06151cc2',
  arquivos: Object.freeze({
    'wsock32.dll': 'b844ecffa29a53c8959570ae6e6257584f19bccb87dbea604047c0a2e572f43a',
    'millennium/lib/millennium.dll': '8e631676083367622c4fcfcabf23ae02a21e65f54b4adfb60e2d92da816feecf',
    'millennium/lib/millennium.hhx64.dll': '694c55009a0eadf180f9e88d0b7575b6ff9a1a1976166450d7e9728b5ca88e04',
    'millennium/bin/millennium.luavm64.exe': '51056115b7a876aa4280cefad7dcead6f88e0df6f678be2ca26d0327a093a104',
    'millennium/bin/millennium.crashhandler64.exe': '3d6806133ab70534197f229519933c16ce320c541af7ebb993190dd8f4407cf8',
  }),
  dll: 'millennium/lib/millennium.dll',
  hook: 'millennium/lib/millennium.hhx64.dll',
  proxy: 'wsock32.dll',
  signatario: 'SignPath Foundation',
});

// hardlinks do hook que o Millennium cria no 1º boot (o desinstalador oficial esquece)
export const VERSION_DLLS = Object.freeze(['bin/cef/cef.win64/version.dll', 'bin/cef/cef.win7x64/version.dll']);
// version.dll velho da raiz: o Millennium renomeia para millennium-legacy.version.dll no 1º boot (millennium-v3.md §1.4)
export const VERSION_DLL_RAIZ = 'version.dll';
export const VERSION_DLL_LEGADO = 'millennium-legacy.version.dll';

// plugins da comunidade pelo id do steambrew (plugins-comunidade.md §1)
export const STEAMBREW = 'https://steambrew.app';
export const COMUNIDADE = Object.freeze([
  Object.freeze({ id: '788ed8554492', nome: 'extendium', exibido: 'Extendium' }),
  Object.freeze({ id: 'f685622bace6', nome: 'hltb-for-millennium', exibido: 'HLTB for Steam' }),
  Object.freeze({ id: 'a8f305c0bcdb', nome: 'steam-collections-plus', exibido: 'Collections+' }),
  Object.freeze({ id: 'b4c58634419b', nome: 'dwmx', exibido: 'Window Styler (DWMX)' }),
  Object.freeze({ id: 'e73371b61eef', nome: 'size-on-disk', exibido: 'Size on Disk' }),
]);

export const FUNDOS = Object.freeze(['omega-vidro', 'nebulosa', 'vidro-liquido', 'aurora', 'gradiente-noite']);

export const ESPERA_FECHAR_MS = 90_000;  // §7.1 passo 3
export const ESPERA_FORCAR_MS = 15_000;  // depois do --forcar
export const PASSO_ESPERA_MS = 1_000;

export class ErroInstalador extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.codigo = codigo; }
}
