# Atualizacao automatica da extensao "Conferidor de Cupons" no computador de casa.
#
# O que faz (uma vez so):
#   1. baixa o projeto do GitHub para C:\cupons-afiliado-ml (se ainda nao existir);
#   2. cria a tarefa agendada "Cupons - atualizar extensao", que a cada 30 minutos
#      puxa do GitHub as versoes novas publicadas no ramo main;
#   3. a propria extensao (1.51.0 em diante) percebe a versao nova no disco e se
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

if (-not (Test-Path "$Pasta\.git")) {
  Write-Host "Baixando o projeto para $Pasta ..."
  git clone --branch main $Repo $Pasta
} else {
  Write-Host "Projeto ja existe em $Pasta. Atualizando agora..."
  git -C $Pasta pull --ff-only origin main
}

# Tarefa agendada: git pull a cada 30 minutos, sem janela, enquanto o Windows estiver ligado.
$git  = (Get-Command git).Source
$acao = New-ScheduledTaskAction -Execute $git -Argument "-C `"$Pasta`" pull --ff-only origin main"
$gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)
$config  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -Hidden
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $gatilho -Settings $config -Force | Out-Null

Write-Host ""
Write-Host "Pronto. A tarefa '$Tarefa' vai buscar atualizacoes a cada 30 minutos." -ForegroundColor Green
Write-Host ""
Write-Host "ULTIMO PASSO (so uma vez), no Chrome:"
Write-Host "  1. Abra chrome://extensions"
Write-Host "  2. Se a extensao antiga estiver instalada de outra pasta, clique em Remover."
Write-Host "  3. Clique em 'Carregar sem compactacao' e escolha a pasta:  $Pasta\extensao"
Write-Host "  4. Abra as Opcoes da extensao e cole de novo o token de sincronia."
Write-Host ""
Read-Host "Enter para fechar"
