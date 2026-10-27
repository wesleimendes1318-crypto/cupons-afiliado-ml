import { test } from "node:test";
import assert from "node:assert/strict";

import { ARVORE, DEPARTAMENTOS, FILTROS, NOS, ORDEM, subarvore } from "../src/content/taxonomia";
import { CATEGORIAS } from "../src/content/categorias";
import { classificar } from "../src/lib/classificar";

/* Casos reais do catálogo (27/10), com o domínio e o caminho oficiais que o
   Mercado Livre devolveu para cada um. */
const c = (nome: string, dominio?: string, caminho?: string, fonte?: string) =>
  classificar({ nome, dominio, caminho, fonte });

const SSD = [
  "MLB-HARD_DRIVES_AND_SSDS",
  "Informática > Armazenamento > Discos e Acessórios > HDs e SSDs",
] as const;

test("regras fundamentais do pedido", () => {
  // 1. SSD NVMe
  const nvme = c("SSD Kingston NV3 1TB M.2 2280 PCIe 4.0 NVMe 6000 MB/s", ...SSD);
  assert.equal(nvme.no, "ssd-nvme");
  assert.equal(nvme.confianca, "alta");
  assert.deepEqual(NOS["ssd-nvme"]!.caminho, ["informatica", "armazenamento", "ssd-nvme"]);
  assert.equal(
    c("SSD WD Green SN3000, 500GB, M.2 2280, PCIe NVMe, Leitura 5000MB/s", ...SSD).no,
    "ssd-nvme",
  );
  assert.equal(c("Ssd Kingston A400 240gb 2.5mm", ...SSD).no, "ssd-sata");
  assert.equal(
    c("SSD Externo Portátil 1TB Interface USB 3.2 SanDisk SDSSDE30-1T00", ...SSD).no,
    "ssd-externo",
  );
  assert.equal(
    c(
      "Case/gaveta Ugreen Para Ssd Mvme Sata Com Usb-c 10gbps Cm767",
      "MLB-HARD_DRIVES_AND_SSDS_ENCLOSURES",
      "Informática > Armazenamento > Discos e Acessórios > Acessórios > Gavetas para HDs",
    ).no,
    "cases-e-docks",
  );
  // 2. Placa de vídeo
  const gpu = c(
    "Placa de Vídeo ASRock Radeon RX 7600 8GB Challenger OC GDDR6",
    "MLB-GRAPHICS_CARDS",
    "Informática > Componentes para PC > Placas > Placas de Vídeo",
  );
  assert.equal(gpu.no, "placas-de-video");
  assert.equal(gpu.confianca, "alta");
  // 3. Geladeira
  const geladeira = c(
    "Geladeira Frost Free Brastemp 375 Litros Inox BRM45HK",
    "MLB-REFRIGERATORS",
    "Eletrodomésticos > Refrigeração > Geladeiras",
  );
  assert.equal(geladeira.no, "geladeiras");
  assert.deepEqual(NOS.geladeiras!.caminho, ["eletrodomesticos", "refrigeracao", "geladeiras"]);
  // Frigobar tem o mesmo domínio da geladeira, mas a categoria oficial e o título separam.
  assert.equal(
    c(
      "Frigobar Philco 68 Litros Compacto PFG85B",
      "MLB-REFRIGERATORS",
      "Eletrodomésticos > Refrigeração > Frigobares",
    ).no,
    "frigobares",
  );
  // 4. Adega não é geladeira
  assert.equal(
    c(
      "Adega De Vinhos Brastemp Para 12 Garrafas BZC12BE",
      "MLB-WINE_CELLARS",
      "Eletrodomésticos > Refrigeração > Adegas Climatizadas",
    ).no,
    "adegas",
  );
  assert.equal(c("Adega Climatizada 12 Garrafas Geladeira de Vinho").no, "adegas");
  // 5. Capa de caixa JBL não é caixa de som
  const capa = c(
    "Capa Case Bolsa Para Caixa De Som JBL Flip 6",
    "MLB-DIGITAL_PORTABLE_MEDIA_PLAYER_COVERS_AND_BAGS",
    "Eletrônicos, Áudio e Vídeo > Áudio > Áudio Portátil e Acessórios > Acessórios > Capas",
  );
  assert.equal(capa.no, "acessorios-de-audio");
  assert.notEqual(c("Estojo para JBL Charge 5 caixa de som").no, "caixas-bluetooth");
  assert.equal(
    c(
      "Caixa de Som Bluetooth JBL Flip 6 À Prova d'Água",
      "MLB-SPEAKERS",
      "Eletrônicos, Áudio e Vídeo > Áudio > Áudio Portátil e Acessórios > Acessórios > Caixas Bluetooth",
    ).no,
    "caixas-bluetooth",
  );
  // 6. Leiteira não é chaleira elétrica
  assert.equal(
    c(
      "Leiteira Tramontina Alumínio 1,9L Antiaderente",
      "MLB-MILK_POTS",
      "Casa, Móveis e Decoração > Cozinha > Cozimento > Panelas e Frigideiras > Fervedores",
    ).no,
    "leiteiras",
  );
  assert.equal(c("Leiteira Inox 1 Litro").no, "leiteiras");
  assert.equal(
    c(
      "Chaleira Elétrica Inox 1,8L 1500W",
      "MLB-ELECTRIC_JUGS",
      "Eletrodomésticos > Pequenos Eletrodomésticos > Para a Cozinha > Chaleiras Elétricas",
    ).no,
    "chaleiras-eletricas",
  );
  // 7. Receptor digital não é Smart TV
  const receptor = c(
    "Receptor Digital Vivensis Via Satelite Vx10",
    "MLB-AUDIO_AND_VIDEO_CONVERTERS",
    "Eletrônicos, Áudio e Vídeo > Acessórios para Áudio e Vídeo > Receptores para TV",
  );
  assert.equal(receptor.no, "receptores-digitais");
  assert.notEqual(c("Receptor Smart TV Box 4K Android").no, "smart-tvs");
  // 8. Acessório não é o produto principal
  assert.equal(
    c(
      "Controle Remoto Receptor Vivensis Vx10 Sathd Regional",
      "MLB-AUDIO_AND_VIDEO_CONVERTERS",
      "Eletrônicos, Áudio e Vídeo > Acessórios para Áudio e Vídeo > Receptores para TV",
    ).no,
    "controles-remotos",
  );
  assert.equal(c("Suporte De Parede Para TV 32 a 75 Polegadas Articulado").no, "suportes-de-tv");
  assert.equal(c("Capinha Case Anti Impacto Para iPhone 15 Pro").no, "capas-de-celular");
  assert.equal(c("Carregador Turbo Samsung 25W USB-C").no, "carregadores");
});

test("o título corrige o Mercado Livre quando ele erra", () => {
  // Receptor de microfone sem fio que o Mercado Livre põe em "Receptores para TV".
  const shure = c(
    "Receptor Digital Shure Slxd4-g58 Sem Fio",
    "MLB-AUDIO_AND_VIDEO_CONVERTERS",
    "Eletrônicos, Áudio e Vídeo > Acessórios para Áudio e Vídeo > Receptores para TV",
  );
  assert.equal(shure.no, "microfones");
  assert.equal(shure.confianca, "media");
  // Frigideira que estava em Eletrodomésticos.
  assert.equal(
    c(
      "Frigideira Cerâmica 24cm Antiaderente",
      "MLB-FRYING_PANS_WOKS_GRIDDLES_AND_GRILL_PANS",
      "Casa, Móveis e Decoração > Cozinha > Cozimento > Panelas e Frigideiras > Frigideiras",
      "eletrodomesticos",
    ).no,
    "frigideiras",
  );
});

test("produtos reais em departamentos novos", () => {
  assert.equal(
    c(
      "Almofada Para Amamentação Travesseiro Estampas",
      "MLB-NURSING_PILLOWS",
      "Bebês > Maternidade > Almofadas para Amamentação",
      "casa",
    ).no,
    "maternidade",
  );
  assert.equal(
    c(
      "Palmilha Ortopédica Gel Fascite Plantar",
      "MLB-INSOLES",
      "Saúde > Ortopedia > Podologia > Palmilhas Ortopédicas",
      "ferramentas",
    ).no,
    "ortopedicos",
  );
  assert.equal(
    c(
      "Caixa Papel Sulfite A4 Report 10 Resmas",
      "MLB-SCHOOL_AND_OFFICE_PAPERS",
      "Arte, Papelaria e Armarinho > Materiais Escolares > Comercial e Organização > Papéis para Impressão",
      "informatica",
    ).no,
    "papeis",
  );
  assert.equal(
    c(
      "Cadeira Escritório Ergonômica Genebra B500",
      "MLB-OFFICE_CHAIRS",
      "Casa, Móveis e Decoração > Móveis para Casa > Cadeiras, Sofás e Banquetas > Cadeiras para Escritório",
      "casa",
    ).no,
    "moveis-de-escritorio",
  );
  assert.equal(
    c(
      "Playstation 5 Slim Digital 825gb Branco",
      "MLB-GAME_CONSOLES",
      "Games > Consoles",
      "eletronicos",
    ).no,
    "consoles",
  );
  assert.equal(
    c(
      "Controle Playstation Dualshock 4 Sony Cor Preto Ps4",
      "MLB-GAMEPADS_AND_JOYSTICKS",
      "Games > Acessórios para Consoles > Para PlayStation > PlayStation 4 > Gamepads e Joysticks",
    ).no,
    "controles-games",
  );
  assert.equal(
    c(
      "Cabo Hdmi 2.1 8k Compatível Com Ps5 Xbox Series 3 Metros",
      "MLB-AUDIO_AND_VIDEO_CABLES_AND_ADAPTERS",
      "Eletrônicos, Áudio e Vídeo > Cabos > Cabos de Áudio e Vídeo",
    ).no,
    "cabos-e-adaptadores-de-video",
  );
});

test("baixa confiança e fora do site", () => {
  const sem = c("Produto genérico qualquer", undefined, undefined, "casa");
  assert.equal(sem.no, "casa");
  assert.equal(sem.confianca, "baixa");
  assert.equal(
    c(
      "Letreiro Luminoso Sex Shop Open - Decoração",
      "MLB-SEX_TOYS_AND_SUPPLIES",
      "Mais Categorias > Adultos > Outros",
      "brinquedos",
    ).no,
    "fora",
  );
  assert.equal(c("Gift Card Playstation R$ 100 (Digital)").no, "fora");
  assert.equal(c("Tela Display Frontal Compatível Moto G54 Incell").no, "fora");
});

test("hierarquia: sem ciclos, sem slug repetido, até 4 níveis e caminhos coerentes", () => {
  assert.equal(new Set(ORDEM).size, ORDEM.length);
  for (const slug of ORDEM) {
    const no = NOS[slug]!;
    assert.ok(no.nivel >= 1 && no.nivel <= 4, slug);
    assert.equal(no.caminho.at(-1), slug);
    assert.equal(no.caminho.length, no.nivel);
    assert.equal(new Set(no.caminho).size, no.caminho.length, `ciclo em ${slug}`);
    if (no.pai) assert.ok(NOS[no.pai]!.filhos.includes(slug));
    for (const f of no.filtros) assert.ok(FILTROS[f], `${slug}: filtro ${f}`);
  }
  assert.equal(DEPARTAMENTOS.length, ARVORE.length);
  // Subárvores dos departamentos não se sobrepõem (sem contagem dupla entre irmãs).
  const vistos = new Set<string>();
  for (const d of DEPARTAMENTOS)
    for (const s of subarvore(d.slug)) {
      assert.ok(!vistos.has(s), s);
      vistos.add(s);
    }
  assert.equal(vistos.size, ORDEM.length);
});

test("as URLs antigas de categoria continuam existindo", () => {
  for (const cat of CATEGORIAS) assert.ok(NOS[cat.slug], cat.slug);
  assert.equal(NOS.celulares!.pai, "eletronicos");
  assert.equal(NOS.celulares!.legado, "celulares");
});

test("filtros por título", () => {
  const t = (id: keyof typeof FILTROS, nome: string) =>
    FILTROS[id].opcoes.filter((o) => o.re.test(nome.toLowerCase())).map((o) => o.id);
  assert.deepEqual(t("armazenamento", "ssd kingston nv3 1tb m.2"), ["1tb"]);
  assert.deepEqual(t("armazenamento", "ssd wd green 500gb"), ["480-512"]);
  assert.deepEqual(t("voltagem", "geladeira frost free 375 litros 220v"), ["220"]);
  assert.deepEqual(t("litros", "geladeira frost free 375 litros 220v"), ["301-450"]);
  assert.deepEqual(t("litros", "frigobar philco 68 litros"), ["ate-100"]);
  assert.deepEqual(t("polegadas", 'smart tv 55" 4k'), ["50-55"]);
  assert.deepEqual(t("conexao_fone", "fone bluetooth tws"), ["bluetooth"]);
});
