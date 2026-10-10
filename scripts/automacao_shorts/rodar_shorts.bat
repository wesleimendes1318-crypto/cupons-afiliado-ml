@echo off
rem Shorts do Melhor Escolha: 1 video por execucao (agende 3 a 4 vezes por dia).
cd /d "%~dp0..\.."
python -m scripts.automacao_shorts.pipeline_principal --max 1
