# Alfa na Steam · instalador em 1 comando
#   irm https://raw.githubusercontent.com/Coronel666/steam-alfa/main/instalar.ps1 | iex
# Baixa o pacote do Alfa (este repositório), um Node portátil conferido por SHA-256 (só se você não tiver Node) e roda o
# instalador de verdade (instalar\instalar.mjs): fecha a Steam com calma, instala Millennium + tema + plugins, guarda um
# backup de tudo e abre a Steam de novo. Nada fica pela metade: se der erro, ele volta como estava.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
  try { $Host.UI.RawUI.WindowTitle = 'Alfa na Steam - instalador' } catch {}

  $Repo    = 'Coronel666/steam-alfa'
  $NodeVer = 'v22.23.3'
  $NodeSha = '2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71'
  $Base    = Join-Path $env:LOCALAPPDATA 'Alfa na Steam'
  $Tmp     = Join-Path $Base 'baixando'

  function Passo([string]$t) { Write-Host '  [>>] ' -ForegroundColor Red -NoNewline; Write-Host $t -ForegroundColor Gray }
  function Ok([string]$t)    { Write-Host '  [OK] ' -ForegroundColor Green -NoNewline; Write-Host $t }
  function Baixar([string]$url, [string]$destino) {
    for ($i = 1; $i -le 3; $i++) {
      try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destino -TimeoutSec 120; return }
      catch { if ($i -eq 3) { throw "não consegui baixar $url ($($_.Exception.Message))" }; Start-Sleep -Seconds (2 * $i) }
    }
  }

  Write-Host ''
  @(
    '     █████╗ ██╗     ███████╗ █████╗ ',
    '    ██╔══██╗██║     ██╔════╝██╔══██╗',
    '    ███████║██║     █████╗  ███████║',
    '    ██╔══██║██║     ██╔══╝  ██╔══██║',
    '    ██║  ██║███████╗██║     ██║  ██║',
    '    ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝'
  ) | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  Write-Host '    na Steam · vidro, pastas automáticas, valor da conta e jogadores agora' -ForegroundColor DarkGray
  Write-Host ''

  try {
    Passo 'conferindo o Windows'
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'o Alfa precisa do Windows 64 bits.' }
    Ok 'Windows 64 bits'

    Passo 'procurando a Steam'
    $steam = $null
    try { $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamPath } catch {}
    if (-not $steam -or -not (Test-Path (Join-Path $steam 'steam.exe'))) { throw 'não achei a Steam neste PC. Instale a Steam, abra uma vez e rode de novo.' }
    Ok "Steam em $steam"

    Passo 'preparando a pasta do Alfa'
    New-Item -ItemType Directory -Force -Path $Base, $Tmp | Out-Null
    Ok $Base

    Passo 'procurando o Node (só para rodar o instalador)'
    $node = $null
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) {
      $v = (& $cmd.Source -v) 2>$null
      if ("$v" -match '^v(\d+)\.' -and [int]$Matches[1] -ge 18) { $node = $cmd.Source; Ok "Node $v já está no PC" }
    }
    if (-not $node) {
      $pastaNode = Join-Path $Base "node-$NodeVer-win-x64"
      $node = Join-Path $pastaNode 'node.exe'
      if (-not (Test-Path $node)) {
        Passo "baixando o Node portátil $NodeVer (35 MB, fica só na pasta do Alfa)"
        $zip = Join-Path $Tmp 'node.zip'
        Baixar "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip" $zip
        Passo 'conferindo o SHA-256 do Node com o oficial'
        $h = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLower()
        if ($h -ne $NodeSha) { Remove-Item $zip -Force -ErrorAction SilentlyContinue; throw 'o Node baixado veio diferente do oficial. Parei por segurança.' }
        Ok 'Node conferido (igualzinho ao oficial)'
        Passo 'tirando só o node.exe do pacote'
        # só o node.exe: o zip inteiro tem caminhos longos demais para o Windows (e milhares de arquivos à toa)
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        New-Item -ItemType Directory -Force -Path $pastaNode | Out-Null
        $z = [IO.Compression.ZipFile]::OpenRead($zip)
        try {
          $entrada = $z.Entries | Where-Object { $_.FullName -eq "node-$NodeVer-win-x64/node.exe" } | Select-Object -First 1
          if (-not $entrada) { throw 'o pacote do Node veio sem o node.exe.' }
          [IO.Compression.ZipFileExtensions]::ExtractToFile($entrada, $node, $true)
        } finally { $z.Dispose() }
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
      }
      if (-not (Test-Path $node)) { throw 'o Node portátil não abriu direito.' }
      Ok 'Node portátil pronto'
    }

    Passo 'baixando o pacote do Alfa (GitHub)'
    $zipRepo = Join-Path $Tmp 'alfa.zip'
    Baixar "https://codeload.github.com/$Repo/zip/refs/heads/main" $zipRepo
    $pacote = Join-Path $Base 'pacote'
    if (Test-Path $pacote) { Remove-Item $pacote -Recurse -Force }
    Passo 'abrindo o pacote'
    Expand-Archive -Path $zipRepo -DestinationPath $pacote -Force
    Remove-Item $zipRepo -Force -ErrorAction SilentlyContinue
    $raiz = Get-ChildItem -Path $pacote -Directory | Select-Object -First 1
    $instalador = Join-Path $raiz.FullName 'instalar\instalar.mjs'
    if (-not (Test-Path $instalador)) { throw 'o pacote veio sem o instalador.' }
    $versao = ''
    try { $versao = (Get-Content (Join-Path $raiz.FullName 'VERSAO.txt') -TotalCount 1).Trim() } catch {}
    Ok "pacote pronto $versao"
    $antes = ''
    try { $antes = (Get-Content (Join-Path $Base 'instalado.json') -Raw | ConvertFrom-Json).versao } catch {}
    if ($antes -and $antes -ne $versao) { Ok "você tinha a versão ${antes}: é uma ATUALIZAÇÃO" }
    elseif ($antes) { Ok 'você já está nesta versão: reinstalando por cima' }

    Passo 'instalando: a Steam fecha sozinha, recebe o Alfa e abre de novo (não abra jogo agora)'
    Write-Host ''
    & $node $instalador --log (Join-Path $Base 'logs')
    $codigo = $LASTEXITCODE
    Write-Host ''
    if ($codigo -ne 0) { throw "o instalador parou (código $codigo). Nada ficou pela metade. O log está em $(Join-Path $Base 'logs')." }
    # a versão instalada (o app do GameHub lê isto para mostrar "Atualização pendente")
    try { @{ versao = $versao; quando = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -Path (Join-Path $Base 'instalado.json') -Encoding UTF8 } catch {}

    Write-Host '  ╔══════════════════════════════════════════════════════════════╗' -ForegroundColor Red
    Write-Host '  ║                     ALFA INSTALADO!                          ║' -ForegroundColor Red
    Write-Host '  ╚══════════════════════════════════════════════════════════════╝' -ForegroundColor Red
    Write-Host ''
    Write-Host '   Na Steam, do lado do menu de cima:' -ForegroundColor Gray
    Write-Host '     • cocô dourado = temas (fundo, cor, símbolo, animações)' -ForegroundColor Gray
    Write-Host '     • coruja       = as pastas que o Alfa organizou' -ForegroundColor Gray
    Write-Host '     • moeda        = quanto a sua conta vale' -ForegroundColor Gray
    Write-Host '   Organizar automaticamente: menu do Millennium > Alfa > Organizar.' -ForegroundColor Gray
    Write-Host '   Na loja, cada jogo mostra quantos estão jogando agora e o menor preço que já teve.' -ForegroundColor Gray
    Write-Host '   Se a Steam fechar sozinha uma vez na 1ª abertura (é o Extendium se preparando), é só abrir de novo.' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '   Pra tirar tudo: irm https://raw.githubusercontent.com/Coronel666/steam-alfa/main/desinstalar.ps1 | iex' -ForegroundColor DarkGray
    Write-Host ''
  } catch {
    Write-Host ''
    Write-Host '  [XX] ' -ForegroundColor Red -NoNewline
    Write-Host "Não deu: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host '       Pode rodar o comando de novo quando quiser.' -ForegroundColor DarkGray
    Write-Host ''
  }
}
