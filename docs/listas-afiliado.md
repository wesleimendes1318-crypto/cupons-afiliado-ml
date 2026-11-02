# Listas de afiliado no Mercado Livre (02/11/2026)

## O que faz
- **Curadoria (banco, 2x por dia, 06:35 e 18:35 de Brasília):** `curar_listas_afiliado()` escolhe até a meta de cada lista (60 a 100) entre os mais vendidos/mais buscados do catálogo oficial e os recomendados do hub. Só entra anúncio com nota **4,5+ e 20+ avaliações** lidas na página, novo, sem réplica e sem peça no lugar do aparelho. Ordem: qualidade > demanda (mais vendido, posição, cliques no link do site em 30 dias) > frete grátis e loja oficial > comissão (só desempata). "Achadinhos até R$ 100" só com frete grátis confirmado. Quem já está só sai se cair abaixo de 1,25 x a meta.
- **Sincronizador (extensão 1.174.0, 1 rodada por hora, só parada):** lê as listas em `myaccount.mercadolivre.com.br/bookmarks/list`, cria as que faltam como **Públicas**, lê os produtos, inclui até 12 e tira até 8 por rodada. Só tira o que o próprio agente incluiu.

## Listas iniciais
Cozinha inteligente e eletro · Tecnologia e home office · Beleza, skincare e cabelos · Achadinhos até R$ 100 · Casa organizada · Ferramentas e oficina · Bebês e brinquedos · Acessórios para o carro · Moda e acessórios. Mudar nome, meta ou categorias: `update public.listas_afiliado ...` (o nome tem de ser igual ao da lista no Mercado Livre).

## Como ligar
1. Supabase próprio -> SQL Editor -> colar `supabase/manutencao/20261102_listas_afiliado.sql` -> Run (pode repetir).
2. Atualizar a extensão (`ferramentas/ATUALIZAR-EXTENSAO.bat`).

## Controles
- Desligar: `update sinc_config set valor='false' where chave='listas_ativo';`
- Só ler (não cria nem inclui): `update sinc_config set valor='ler' where chave='listas_modo';`
- Painel: `select * from listas_afiliado_painel;` · último relatório: `diagnosticos` tipo `listas-afiliado`.

## Limites honestos
- O Mercado Livre não publica API das listas. Na primeira vez a extensão clica como uma pessoa e anota o pedido que a página faz; depois repete esse pedido. Se a página mudar, ela volta a clicar. Se não achar o botão, grava o motivo no diagnóstico.
- Vendas e comissões por produto não entram: não há API de comissões. Cliques no link do site entram.
- Verificação/captcha, 401, 403 ou 429 = pausa de 6 h.
- Lista criada que ficar Privada aparece em `privadas` no diagnóstico: mudar para Pública no Mercado Livre.
