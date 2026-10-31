# Alfa na Steam · desinstalar em 1 comando
#   irm https://raw.githubusercontent.com/Coronel666/steam-alfa/main/desinstalar.ps1 | iex
# Volta a Steam como era antes do Alfa (usa o backup que o instalador guardou). Suas coleções e os backups em
# Documentos\Steam Alfa ficam. O Millennium só sai se foi o Alfa que instalou.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
  try { $Host.UI.RawUI.WindowTitle = 'Alfa na Steam - desinstalar' } catch {}

  $Base = Join-Path $env:LOCALAPPDATA 'Alfa na Steam'
  function Passo([string]$t) { Write-Host '  [>>] ' -ForegroundColor Red -NoNewline; Write-Host $t -ForegroundColor Gray }
  function Ok([string]$t)    { Write-Host '  [OK] ' -ForegroundColor Green -NoNewline; Write-Host $t }

  Write-Host ''
  Write-Host '    ALFA na Steam · desinstalar' -ForegroundColor Red
  Write-Host ''
  try {
    $pacote = Join-Path $Base 'pacote'
    $raiz = $null
    if (Test-Path $pacote) { $raiz = Get-ChildItem -Path $pacote -Directory | Select-Object -First 1 }
    if (-not $raiz) { throw 'não achei o Alfa instalado por este PC (pasta do pacote sumiu). Rode o instalar.ps1 de novo e depois este.' }
    $node = $null
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { $node = $cmd.Source }
    if (-not $node) { $node = Get-ChildItem -Path $Base -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }
    if (-not $node) { throw 'não achei o Node que o instalador usou. Rode o instalar.ps1 de novo e depois este.' }
    Passo 'tirando o Alfa: a Steam fecha, volta como era antes e abre de novo'
    Write-Host ''
    & $node (Join-Path $raiz.FullName 'instalar\desfazer.mjs') --tudo --log (Join-Path $Base 'logs')
    $codigo = $LASTEXITCODE
    Write-Host ''
    if ($codigo -ne 0) { throw "o desinstalador parou (código $codigo). O log está em $(Join-Path $Base 'logs')." }
    Ok 'Alfa desinstalado. Suas coleções continuam do jeito que estão.'
    Write-Host ''
  } catch {
    Write-Host '  [XX] ' -ForegroundColor Red -NoNewline
    Write-Host "Não deu: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ''
  }
}
