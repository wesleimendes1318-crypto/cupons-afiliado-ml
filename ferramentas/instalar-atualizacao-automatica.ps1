# Atualizacao automatica da extensao "Conferidor de Cupons" no computador de casa.
#
# O que faz (uma vez so):
#   1. pergunta qual pasta o Chrome usa hoje para a extensao (fica a mesma, entao
#      o token de sincronia e as Opcoes continuam valendo);
#   2. baixa o projeto do GitHub para C:\cupons-afiliado-ml (copia de trabalho);
#   3. cria a tarefa agendada "Cupons - atualizar extensao", que a cada 30 minutos
#      puxa as versoes novas do ramo main e copia a pasta extensao por cima da
#      pasta que o Chrome usa;
#   4. a propria extensao (1.51.0 em diante) percebe a versao nova no disco e se
#      recarrega sozinha em ate 15 minutos. Ninguem precisa clicar em nada.
#
# Como rodar: clique com o botao direito neste arquivo > "Executar com o PowerShell".
# Precisa do Git para Windows instalado: https://git-scm.com/download/win
# Na primeira vez o Git pode abrir uma janela de login do GitHub: entre com a sua conta.

$ErrorActionPreference = "Stop"
$Pasta   = "C:\cupons-afiliado-ml"
$Repo    = "https://github.com/wesleimendes1318-crypto/cupons-afiliado-ml.git"
$Tarefa  = "Cupons - atualizar extensao"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "O Git nao esta instalado. Instale em https://git-scm.com/download/win e rode este arquivo de novo." -ForegroundColor Red
  Read-Host "Enter para sair"; exit 1
}

Write-Host "Em chrome://extensions, ligue o 'Modo do desenvolvedor' e veja em 'Detalhes' da"
Write-Host "extensao o caminho de 'Carregado de' / 'Origem'. E essa pasta que sera atualizada."
$Destino = Read-Host "Cole aqui a pasta da extensao (Enter = $Pasta\extensao)"
if ([string]::IsNullOrWhiteSpace($Destino)) { $Destino = "$Pasta\extensao" }
$Destino = $Destino.Trim('"').TrimEnd('\')
if (($Destino -ne "$Pasta\extensao") -and -not (Test-Path "$Destino\manifest.json")) {
  Write-Host "Nao achei manifest.json em $Destino. Confira o caminho e rode de novo." -ForegroundColor Red
  Read-Host "Enter para sair"; exit 1
}

if (-not (Test-Path "$Pasta\.git")) {
  Write-Host "Baixando o projeto para $Pasta ..."
  git clone --branch main $Repo $Pasta
} else {
  Write-Host "Projeto ja existe em $Pasta. Atualizando agora..."
  git -C $Pasta pull --ff-only origin main
}

# Script que a tarefa roda: puxa do GitHub e copia a extensao para a pasta do Chrome.
$Atualizar = "$Pasta\atualizar-extensao.ps1"
@"
`$ErrorActionPreference = 'Continue'
git -C "$Pasta" pull --ff-only origin main
if ("$Destino" -ne "$Pasta\extensao") {
  robocopy "$Pasta\extensao" "$Destino" /E /XD testes /NFL /NDL /NJH /NJS /NP | Out-Null
}
"@ | Set-Content -Path $Atualizar -Encoding UTF8

# Primeira copia agora.
powershell -NoProfile -ExecutionPolicy Bypass -File $Atualizar

$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Atualizar`""
$gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)
$config  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -Hidden
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $gatilho -Settings $config -Force | Out-Null

$versao = (Get-Content "$Destino\manifest.json" -Raw | ConvertFrom-Json).version
Write-Host ""
Write-Host "Pronto. A pasta $Destino esta na versao $versao." -ForegroundColor Green
Write-Host "A tarefa '$Tarefa' vai buscar atualizacoes a cada 30 minutos."
Write-Host ""
if ($Destino -eq "$Pasta\extensao") {
  Write-Host "ULTIMO PASSO (so uma vez), no Chrome:"
  Write-Host "  1. Abra chrome://extensions"
  Write-Host "  2. Se a extensao antiga estiver instalada de outra pasta, clique em Remover."
  Write-Host "  3. Clique em 'Carregar sem compactacao' e escolha a pasta:  $Pasta\extensao"
  Write-Host "  4. Abra as Opcoes da extensao e cole de novo o token de sincronia."
} else {
  Write-Host "Em chrome://extensions, clique no botao de recarregar da extensao uma vez."
  Write-Host "Depois disso ela se recarrega sozinha a cada versao nova."
}
Write-Host ""
Read-Host "Enter para fechar"
