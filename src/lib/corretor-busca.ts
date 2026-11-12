/* TYPO TOLERANCE (Weslei, 11/11: "air fayer mondial" must find the Mondial
   air fryer). Pure and instant (no network): a mistyped word becomes the
   known product type or brand closest to it, so every shield (type, brand,
   kids, fake, price floor) still runs on the real word.
   Only corrects when the guess is safe:
   - words of 5+ letters that are not known words (types, brands, common
     words of shopping searches) nor their plural;
   - same first letter, and one unique best guess;
   - 5-7 letters: one swapped or replaced letter (same length), or one
     missing/extra letter from 6 letters up; 11+ letters: up to 2 edits.
   Words with digits (models, sizes, voltages) are never touched. */

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Optimal string alignment distance (Damerau: a swap of 2 neighbours = 1). */
export function distanciaDeEdicao(a: string, b: string, teto = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > teto) return teto + 1;
  const m = a.length;
  const n = b.length;
  let anterior2: number[] = [];
  let anterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, anterior2[j - 2]! + 1);
      atual.push(v);
      if (v < menor) menor = v;
    }
    if (menor > teto) return teto + 1;
    anterior2 = anterior;
    anterior = atual;
  }
  return anterior[n]!;
}

/* Product words people type most (types the catalog indexes). */
const TIPOS_BASE = `air fryer airfryer fritadeira geladeira refrigerador freezer frigobar fogao cooktop forno
  microondas micro ondas liquidificador batedeira cafeteira chaleira sanduicheira torradeira panela panelas
  aspirador ventilador climatizador umidificador purificador bebedouro lavadora secadora lava seca lavalouca
  televisao smart notebook computador monitor teclado mouse impressora celular smartphone iphone tablet
  carregador capinha pelicula headphone headset caixa som soundbar relogio smartwatch camera
  camiseta camisa regata bermuda short calca conjunto legging jaqueta moletom blusa macacao vestido saia
  cueca calcinha sutia pijama meia tenis sapato sapatenis chinelo sandalia bota mochila bolsa carteira
  oculos perfume shampoo condicionador hidratante maquiagem protetor escova secador chapinha barbeador
  colchao travesseiro lencol edredom cobertor toalha cortina tapete sofa cadeira poltrona mesa escrivaninha
  guarda roupa estante prateleira luminaria lampada brinquedo boneca bicicleta patinete capacete
  furadeira parafusadeira ferramenta pneu bateria garrafa termica copo caneca marmita organizador
  projetor roteador repetidor pendrive webcam microfone tripe joystick controle volante headset
  esmalte batom rimel cilios base paleta sombra depilador lenco lencos umedecidos detergente amaciante
  desinfetante vassoura balde aspirador tabua corte frigideira assadeira chuteira raquete halter anilha
  esteira colchonete suplemento vitamina creatina chocolate biscoito fralda mamadeira chupeta berco
  carrinho cadeirinha pomada desodorante sabonete pulseira colar brinco anel alianca cinto gravata terno
  blazer cropped biquini sunga maio tamanco mocassim botina galocha pantufa scarpin rasteirinha crocs
  lanterna fechadura campainha interfone cofre escada esmerilhadeira lixadeira compressor mangueira
  regador semente adubo vaso cortador aparador sapateira cabide cabideiro estante gabinete processador
  memoria fonte placa retrovisor farol alarme rastreador espelho quadro moldura relogio despertador`;

/* Common words of shopping searches that look like a type or brand
   ("corpo" is not "copo", "cadeia" is not "cadeira"). */
const COMUNS = `corpo porta carro casa banho cabelo roupa cozinha quarto sala jardim praia festa presente
  cadeia carta pasta massa bolso bolas preto preta branco branca verde cinza prata dourado azul rosa
  grande pequeno pequena medio media mini maior menor alto alta baixo baixa longo longa curto curta
  masculino masculina feminino feminina infantil adulto adulta menino menina bebe crianca homem mulher
  para pela pelo como entre sobre contra desde junto ideal kit jogo conjunto unidade unidades pares
  original novo nova usado usada barato barata promocao oferta melhor melhores qualidade marca modelo
  inox vidro madeira metal plastico silicone couro algodao tecido digital eletrico eletrica bivolt
  portatil gamer profissional automatico automatica manual sem fio bluetooth wireless potente forte
  academia fitness corrida esporte esportivo esportiva escolar trabalho viagem natal pascoa dia mae pai
  amigo secreto noite verao inverno frio calor agua cafe cha leite pao bolo arroz feijao carne fruta
  litros litro watts polegadas tamanho cores estampa estampado listrado oversize basica basico slim
  gola manga social casual tradicional moderno moderna simples luxo premium importado nacional
  frigideira assadeira forma cortador aparador lixeira escorredor tabua faqueiro talheres pressao
  carregadores tomada extensao cabos adaptador suporte parafuso martelo chave alicate serra trena
  lanterna luminosa espelho quadro relogios vaso planta racao coleira caminha arranhador aquario
  corta vento caneta lapis borracha regua tesoura cola fita papel caderno agenda estojo`;

export type Corretor = (q: string) => string;

/** Builds the corrector from the target words (types and brands) and the
    words that are already right (targets are always right too). */
export function criarCorretor(alvos: Iterable<string>, conhecidas: Iterable<string> = []): Corretor {
  const lista = new Set<string>();
  for (const a of alvos)
    for (const p of sem(a).split(/\s+/)) if (p.length >= 4 && /^[a-z]+$/.test(p)) lista.add(p);
  for (const p of sem(TIPOS_BASE).split(/\s+/)) if (p.length >= 4) lista.add(p);
  const certas = new Set<string>(lista);
  for (const c of [...sem(COMUNS).split(/\s+/), ...[...conhecidas].flatMap((c) => sem(c).split(/[^a-z0-9]+/))])
    if (c) certas.add(c);
  const porInicial = new Map<string, string[]>();
  for (const p of lista) {
    const k = p[0]!;
    porInicial.set(k, [...(porInicial.get(k) ?? []), p]);
  }
  const memo = new Map<string, string | null>();

  const certa = (p: string) =>
    certas.has(p) ||
    certas.has(p.replace(/s$/, "")) ||
    certas.has(p.replace(/es$/, "")) ||
    certas.has(p.replace(/oes$/, "ao")) ||
    certas.has(p.replace(/is$/, "l")) ||
    /* gender and plural of a known word: "organizadora", "lencos" */
    certas.has(p.replace(/as?$/, "")) ||
    certas.has(p.replace(/as?$/, "o")) ||
    certas.has(p.replace(/os?$/, "a"));

  const palpite = (p: string): string | null => {
    if (memo.has(p)) return memo.get(p)!;
    let melhor: string | null = null;
    let menor = Infinity;
    let empate = false;
    if (p.length >= 5 && /^[a-z]+$/.test(p) && !certa(p)) {
      const teto = p.length >= 11 ? 2 : 1;
      for (const c of porInicial.get(p[0]!) ?? []) {
        if (p.length < 8 && (c.length !== p.length && (p.length < 6 || c.length < 7))) continue;
        /* Only the ending differs ("condicionado" x "condicionador", "esmalte" x
           "esmaltec"): another real word, never a typo. */
        if (c.length !== p.length && (c.startsWith(p) || p.startsWith(c))) continue;
        const d = distanciaDeEdicao(p, c, teto);
        if (d > teto) continue;
        if (d < menor) {
          melhor = c;
          menor = d;
          empate = false;
        } else if (d === menor && c !== melhor) empate = true;
      }
    }
    const r = empate ? null : melhor;
    if (memo.size > 2000) memo.clear();
    memo.set(p, r);
    return r;
  };

  return (q: string) => {
    if (!q) return q;
    let mudou = false;
    const saida = q.split(/(\s+)/).map((pedaco) => {
      if (!pedaco.trim()) return pedaco;
      const p = sem(pedaco).replace(/[^a-z0-9]/g, "");
      if (p !== sem(pedaco)) return pedaco; // punctuation, digits or symbols: as typed
      const c = palpite(p);
      if (!c) return pedaco;
      mudou = true;
      return c;
    });
    return mudou ? saida.join("") : q;
  };
}
