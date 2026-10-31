# Alfa na Steam

A Steam com cara nova, do jeito do Império: tema de vidro, fundos bonitos, animações por pasta, pastas organizadas
sozinhas, quanto a sua conta vale e quantas pessoas estão jogando agora. Tudo em português.

## Instalar (1 comando)

Abra o **PowerShell** (tecla Windows → digite `PowerShell` → Enter), cole isto e aperte Enter:

```powershell
irm https://raw.githubusercontent.com/Coronel666/steam-alfa/main/instalar.ps1 | iex
```

Quem usa o app do **GameHub** pode instalar com 1 clique na aba **IA na Steam**.

Não precisa ser administrador. Feche os jogos antes: a Steam fecha sozinha, recebe o Alfa e abre de novo.

## O que vem

- **Tema Alfa Glass**: vidro escuro, vermelho de fábrica (dá para trocar a cor), capas com brilho e o botão Jogar pulsando.
- **Símbolo**: cocô dourado no lugar do logo da Steam. Pode trocar por caveira, α, coroa, raio ou Ω no painel de temas.
- **Fundos**: 5 fundos prontos, fundos animados e os seus próprios (enviar imagem).
- **Animação de cada pasta**: a pasta muda o clima (terror com névoa, Life is Strange com borboletas e por aí vai).
- **Organizar automaticamente**: o Alfa separa a biblioteca em pastas (jogando agora, nunca abri, instalados, séries
  na ordem da história e gêneros). Suas coleções nunca são apagadas, e sempre tem backup antes.
- **Pastas da Athena** (coruja lá em cima): as pastas em cards com as capas em leque.
- **Quanto a minha conta vale** (moeda lá em cima): preço da loja de cada jogo, horas, custo por hora e os nunca jogados.
- **Na loja**: em cada jogo, quantos estão jogando agora, o pico do dia, o recorde e o **menor preço que o jogo já teve**.
- Plugins da comunidade que já vêm juntos: Extendium (SteamDB, Augmented Steam, ProtonDB), HLTB, Collections+,
  Window Styler e Size on Disk.

## Onde fica cada coisa

- Na barra de cima da Steam, do lado do menu: **cocô dourado** = temas · **coruja** = pastas · **moeda** = valor da conta.
- Menu do Millennium → **Alfa**: abas Organizar, Visual e Pastas.
- Com jogo aberto, as animações param sozinhas (FPS primeiro).

## Tirar

```powershell
irm https://raw.githubusercontent.com/Coronel666/steam-alfa/main/desinstalar.ps1 | iex
```

A Steam volta como era antes (o instalador guardou backup). Suas coleções ficam.

## Segurança

- O instalador baixa só de lugares oficiais: este repositório, o Millennium v3.6.2 (versão fixa, conferida por SHA-256
  e pela assinatura digital) e os plugins da comunidade do steambrew.app.
- Se você não tiver Node, ele baixa o Node portátil oficial (nodejs.org), confere o SHA-256 e guarda só em
  `%LOCALAPPDATA%\Alfa na Steam`.
- Backup de tudo que muda em `Documentos\Steam Alfa\instalador`. Se algo der errado no meio, ele volta como estava.

Feito com o [Millennium](https://steambrew.app) (homebrew da Steam). Não é da Valve.
