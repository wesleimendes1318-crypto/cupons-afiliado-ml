# Diagnóstico do Lovable Cloud (somente leitura, 17/10 10:20 UTC)

Nada foi alterado: nenhum banco novo, nenhuma migração, nenhum dado, nenhum arquivo do projeto.

## 1. Estado do backend

- **Estado: PAUSADO.** O banco de dados deste projeto está pausado. Não foi apagado, não foi migrado e não está em manutenção.
- **Endereço: o mesmo de sempre** (ref rjevaqtnlldhnwsidbbn). Não existe endereço novo. Com o banco pausado, o endereço sai do DNS; por isso aparecem o HTTP 530 e o NXDOMAIN. Quando o banco voltar, o endereço volta junto.
- **Causa provável: saldo do workspace.** Crédito do plano do ciclo (21/09 a 21/10): 0 de 200, todo usado. Sobram só 4 dos 5 créditos diários. No ciclo já foram usados 348 créditos. Não há limite manual de uso configurado. O aviso laranja da tela ("serviços pausados porque este espaço de trabalho está sem créditos") bate com isso.
- Plano: Pro, assinatura ativa.

## 2. O que você precisa fazer para religar

1. **Pôr saldo** (é o que trava o resto):
   - No computador: clique no nome do projeto (canto superior esquerdo) → **Settings** → **Plans & Credits**. Escolha recarga avulsa (top-up) ou um plano maior.
   - Se o botão **Top up** do aviso laranja não abrir, libere janelas pop-up para o lovable.dev ou use o caminho acima.
2. **Religar o banco:** abra **More** → **Database** → menu **Manage** → **Settings** e clique em **Resume / Restore**.
   - O Lovable Cloud não tem uma seção própria. Database, Users e Storage voltam juntos.
3. **Aguardar de 2 a 10 minutos** até o banco subir. Depois confira se https://melhorescolha.io/api/public/saude diz que o banco responde.
4. **Extensão:** não precisa mexer. Quando o banco voltar, ela pega a fila sozinha.
   - Se a pausa remota da extensão tiver ficado ligada (extensao_pausada), me avise que eu religo depois, com a sua autorização.

## 3. Depois de religar (opcional, só com a sua aprovação)

- Confirmar que o estado é "ativo e saudável".
- Fazer uma leitura simples para ver se o último pedido e a vitrine aparecem.
- Conferir se os botões continuam entregando o seu link de afiliado (meli.la).
- Tudo isso só leitura, sem alterar dados.

## Limitação

Eu não consigo pôr saldo nem tirar o banco da pausa por aqui. A tentativa automática foi bloqueada por falta de crédito. Essas duas ações precisam ser feitas por você, como dono do workspace.
