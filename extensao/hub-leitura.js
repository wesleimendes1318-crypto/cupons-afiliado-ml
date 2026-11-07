/* Affiliate Hub card reading for the on-page collector (1.185.0, 07/11/2026).
   Pure (no DOM, no chrome.*): content script on /afiliados/hub and tested in
   tests/extensao-hub-coletor.test.ts. Same rules as lerHubDeAfiliados in
   background.js (daily background read). The commission RATE (%) is read
   only to go to registrar_hub with the extension token: never site, bot,
   channel or diagnostics. Classic script (content scripts are not modules). */
(() => {
  'use strict';

  const LOTE = 100;

  /* MLB id of a hub link: item_id of a /p/ link wins (the listing), then
     MLB-123 listing, then the catalog id. */
  function itemDoLink(href) {
    const h = String(href || '').split('#')[0];
    const m = /\/p\/(MLB\d+)[^?]*(?:\?[^#]*item_id(?:%3A|:)(MLB\d+))?|MLB-?(\d{8,})/i.exec(h);
    if (!m) return null;
    return (m[2] || (m[3] ? 'MLB' + m[3] : null) || m[1] || '').toUpperCase() || null;
  }

  const reais = t => {
    const m = /R\$\s*([\d.]+)(?:[,\s]+(\d{2}))?/.exec(t || '');
    return m ? Number(m[1].replace(/\./g, '') + '.' + (m[2] || '00')) : null;
  };

  /* card = { href, texto (innerText), riscado (struck price text), imagem } */
  function lerCartao(card) {
    const h = String(card.href || '').split('#')[0];
    const item = itemDoLink(h);
    if (!item) return null;
    const brutas = String(card.texto || '').split('\n').map(l => l.trim()).filter(Boolean);
    let comissao = null;
    brutas.forEach((l, k) => {
      if (!/ganho/i.test(l)) return;
      const m = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%(?!\s*off)/i.exec(brutas.slice(k, k + 4).join(' '));
      const v = m ? Number(m[1].replace(',', '.')) : 0;
      if (v > 0 && v <= 60) comissao = Math.max(comissao || 0, v);
    });
    // "Ganhos" lines and the % right below them never reach the title/text.
    const linhas = brutas.filter((l, k) => !/ganho/i.test(l)
      && !(/^\d{1,2}([.,]\d{1,2})?\s*%$/.test(l) && brutas.slice(Math.max(0, k - 2), k).some(x => /ganho|extras?/i.test(x)))
      && !/^extras?$/i.test(l) && !/^selecionar$/i.test(l));
    const texto = linhas.join('\n');
    const corrido = linhas.join(' ').replace(/\s*,\s*(\d{2})\b/g, ',$1');
    const precos = [...corrido.matchAll(/R\$\s*([\d.]+)(?:,(\d{2}))?/g)]
      .map(m => Number(m[1].replace(/\./g, '') + '.' + (m[2] || '00'))).filter(v => v > 0);
    const comOff = /\d{1,2}%\s*OFF/i.test(corrido);
    const precoOriginal = (card.riscado ? reais(String(card.riscado).replace(/\s+/g, ' ').replace(/\s*,\s*(\d{2})\b/, ',$1')) : null)
      ?? (comOff && precos.length >= 2 ? precos[0] : null);
    const preco = precos.find(v => v !== precoOriginal) ?? null;
    const titulo = linhas.filter(l => !/R\$|%|vendid|mais vendido|compartilhar|^\d[.,]\d/i.test(l))
      .sort((x, y) => y.length - x.length)[0] || null;
    const off = /(\d{1,2})%\s*OFF/i.exec(texto);
    const nota = /(^|\n)\s*(\d[.,]\d)\s*(\||\n|$)/.exec(texto);
    const vend = /\+?\s*[\d.]+\s*(mil\s*)?vendidos/i.exec(texto);
    return {
      item,
      url: /^https:\/\/(www|produto)\.mercadolivre\.com\.br\//.test(h) ? h : 'https://produto.mercadolivre.com.br/' + item.replace(/^MLB/, 'MLB-'),
      titulo: titulo ? titulo.slice(0, 200) : null,
      preco,
      preco_original: precoOriginal && preco && precoOriginal > preco ? precoOriginal : null,
      desconto_pct: off ? Number(off[1]) : null,
      mais_vendido: /mais vendido/i.test(texto),
      avaliacao: nota ? Number(nota[2].replace(',', '.')) : null,
      vendidos: vend ? vend[0].replace(/\s+/g, ' ').trim() : null,
      imagem: card.imagem || null,
      comissao_pct: comissao
    };
  }

  const fatiar = (lista, tam = LOTE) => {
    const out = [];
    for (let i = 0; i < lista.length; i += tam) out.push(lista.slice(i, i + tam));
    return out;
  };

  globalThis.meHubLeitura = { LOTE, itemDoLink, lerCartao, fatiar };
})();
