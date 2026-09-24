@echo off
rem Atualizador da extensao "Conferidor de Cupons".
rem Dois cliques neste arquivo: acha sozinho a pasta que o Chrome usa, baixa a
rem versao nova do GitHub e deixa uma tarefa do Windows repetindo isso a cada
rem 30 minutos. Depois disso nao precisa mexer em mais nada.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%~f0'; iex (((Get-Content -LiteralPath $f -Raw) -split ('#INICIO'+'_PS#'))[-1])"
exit /b
#INICIO_PS#
$ErrorActionPreference = 'Stop'
if (-not (Get-Variable Silencioso -ErrorAction SilentlyContinue)) { $Silencioso = $false }
$Base    = Join-Path $env:LOCALAPPDATA 'CuponsML'
$Log     = Join-Path $Base 'atualizacao.log'
$Guardado = Join-Path $Base 'pasta-da-extensao.txt'
$Repo    = 'wesleimendes1318-crypto/cupons-afiliado-ml'
$Tarefa  = 'Cupons - atualizar extensao'
New-Item -ItemType Directory -Force -Path $Base | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Anotar($msg) {
  $linha = (Get-Date -Format 'yyyy-MM-dd HH:mm') + '  ' + $msg
  Add-Content -Path $Log -Value $linha
  if (-not $Silencioso) { Write-Host $msg }
}

function Fim($msg, $ok) {
  Anotar $msg
  if (-not $Silencioso) {
    Write-Host ''
    if ($ok) { Write-Host 'Tudo certo.' -ForegroundColor Green } else { Write-Host 'Nao deu certo. Tire um print desta janela.' -ForegroundColor Red }
    Read-Host 'Enter para fechar'
  }
  exit
}

# 1. A pasta que o Chrome usa para a extensao: guardada, ou achada nas
#    configuracoes do Chrome (todas as contas/perfis).
function EhAExtensao($p) {
  $m = Join-Path $p 'manifest.json'
  (Test-Path $m) -and ((Get-Content $m -Raw) -match 'cupons-afiliado-ml\.lovable\.app')
}
$Destino = $null
if (Test-Path $Guardado) {
  $g = (Get-Content $Guardado -Raw).Trim()
  if ($g -and (EhAExtensao $g)) { $Destino = $g }
}
if (-not $Destino) {
  $raiz = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
  if (Test-Path $raiz) {
    foreach ($perfil in Get-ChildItem $raiz -Directory) {
      foreach ($arq in 'Secure Preferences', 'Preferences') {
        $cam = Join-Path $perfil.FullName $arq
        if (-not (Test-Path $cam)) { continue }
        $texto = Get-Content $cam -Raw
        foreach ($m in [regex]::Matches($texto, '"path"\s*:\s*"([A-Za-z]:\\\\[^"]+)"')) {
          $p = $m.Groups[1].Value -replace '\\\\', '\'
          if (EhAExtensao $p) { $Destino = $p; break }
        }
        if ($Destino) { break }
      }
      if ($Destino) { break }
    }
  }
}
if (-not $Destino -and -not $Silencioso) {
  Add-Type -AssemblyName System.Windows.Forms
  $d = New-Object System.Windows.Forms.FolderBrowserDialog
  $d.Description = 'Nao achei sozinho. Escolha a pasta da extensao (a que tem o manifest.json).'
  if ($d.ShowDialog() -eq 'OK' -and (EhAExtensao $d.SelectedPath)) { $Destino = $d.SelectedPath }
}
if (-not $Destino) { Fim 'Nao achei a pasta da extensao no Chrome.' $false }
Set-Content -Path $Guardado -Value $Destino
Anotar "Pasta da extensao: $Destino"

# 2. Versao no GitHub x versao na pasta. So baixa se mudou.
$atual = (Get-Content (Join-Path $Destino 'manifest.json') -Raw | ConvertFrom-Json).version
try {
  $nova = ((Invoke-WebRequest "https://raw.githubusercontent.com/$Repo/main/extensao/manifest.json?t=$([DateTime]::Now.Ticks)" -UseBasicParsing).Content | ConvertFrom-Json).version
} catch { Fim "Sem internet ou GitHub fora do ar: $($_.Exception.Message)" $false }

if ($nova -ne $atual) {
  $zip = Join-Path $Base 'main.zip'
  $tmp = Join-Path $Base 'baixado'
  Invoke-WebRequest "https://codeload.github.com/$Repo/zip/refs/heads/main" -OutFile $zip -UseBasicParsing
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $origem = Get-ChildItem $tmp -Directory | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'extensao' }
  if (-not (Test-Path (Join-Path $origem 'manifest.json'))) { Fim 'O pacote baixado veio sem a extensao.' $false }
  robocopy $origem $Destino /E /XD testes /NFL /NDL /NJH /NJS /NP | Out-Null
  Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
  Anotar "Atualizada de $atual para $nova. A extensao se recarrega sozinha em ate 15 minutos."
} else {
  Anotar "Ja esta na versao mais nova ($atual)."
}

# 3. Tarefa do Windows: repete isto a cada 30 minutos e ao ligar o computador.
if (-not $Silencioso) {
  $script = Join-Path $Base 'atualizar.ps1'
  $corpo = ((Get-Content -LiteralPath $f -Raw) -split ('#INICIO' + '_PS#'))[-1]
  Set-Content -Path $script -Value ('$Silencioso = $true' + "`r`n" + '$f = ''' + $f + '''' + "`r`n" + $corpo) -Encoding UTF8
  $acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
  $cada = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 30)
  $config = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -Hidden
  try {
    $aoEntrar = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger @($cada, $aoEntrar) -Settings $config -Force | Out-Null
  } catch {
    # Sem permissao para "ao entrar no Windows": fica so a repeticao de 30 min.
    Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $cada -Settings $config -Force | Out-Null
  }
  Anotar "Atualizacao automatica ligada: a cada 30 minutos."
  Write-Host ''
  Write-Host 'Para ver a versao nova agora: em chrome://extensions clique na setinha de recarregar da extensao.'
  Write-Host 'Se nao clicar, ela se recarrega sozinha em ate 15 minutos.'
}
Fim "Versao na pasta agora: $((Get-Content (Join-Path $Destino 'manifest.json') -Raw | ConvertFrom-Json).version)" $true
