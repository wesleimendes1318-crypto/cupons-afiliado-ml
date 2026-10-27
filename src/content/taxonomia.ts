/* TAXONOMIA DO SITE (Weslei, 27/10: "reestruturação inteligente de
   categorias e subcategorias"). Departamento → Categoria → Subcategoria →
   Tipo, só com os níveis que fazem sentido. Feita a partir do catálogo real
   (4.378 mais vendidos com o caminho oficial do Mercado Livre).

   Cada nó pode ter:
   - ml: casa com o domínio e o caminho OFICIAIS do Mercado Livre, em
     minúsculas e sem acento ("mlb-hard_drives_and_ssds | informatica >
     armazenamento > ..."). É a evidência mais confiável.
   - titulo: casa com o nome do anúncio (minúsculas, sem acento). Serve para
     separar o que o Mercado Livre junta (SSD NVMe x SATA, frigobar x
     geladeira) e para o acessório não virar o produto principal.
   - nao: o título que impede o nó (capa de caixa de som não é caixa).
   - legado: a categoria antiga (categoria_site) equivalente, para as cotas
     do agente e as abas que ainda usam as 10 categorias.
   - filtros: filtros próprios do nó (herdados pelos filhos).

   Slugs são únicos na árvore e estáveis (a URL é /categorias/<slug>). Os 10
   slugs antigos continuam valendo: eletronicos, celulares, informatica,
   casa, moda, beleza, automotivo, brinquedos, eletrodomesticos e
   ferramentas. Nó sem produto não aparece na navegação. */

export type CategoriaLegado =
  | "eletronicos"
  | "celulares"
  | "informatica"
  | "casa"
  | "moda"
  | "beleza"
  | "automotivo"
  | "brinquedos"
  | "eletrodomesticos"
  | "ferramentas";

export type FiltroId =
  | "armazenamento"
  | "interface_ssd"
  | "voltagem"
  | "tecnologia_refrigeracao"
  | "litros"
  | "conexao_fone"
  | "cancelamento"
  | "formato_fone"
  | "polegadas"
  | "memoria_ram"
  | "genero"
  | "portas_rede";

type Def = {
  slug: string;
  nome: string;
  ml?: RegExp;
  titulo?: RegExp;
  nao?: RegExp;
  legado?: CategoriaLegado;
  filtros?: FiltroId[];
  filhos?: Def[] | undefined;
};

export type NoTaxonomia = {
  slug: string;
  nome: string;
  nivel: number;
  pai: string | null;
  /** Do departamento até o próprio nó. */
  caminho: string[];
  filhos: string[];
  ml?: RegExp | undefined;
  titulo?: RegExp | undefined;
  nao?: RegExp | undefined;
  legado: CategoriaLegado | null;
  filtros: FiltroId[];
};

const n = (
  slug: string,
  nome: string,
  regras: Omit<Def, "slug" | "nome" | "filhos"> = {},
  filhos?: Def[],
): Def => ({ slug, nome, ...regras, filhos });

/* Acessório no começo do nome: o anúncio é do acessório, não do produto. */
export const ACESSORIO =
  /^(?:kit\s+(?:de\s+)?\d*\s*)?(?:capas?|cases?|capinhas?|estojos?|bolsas? para|suportes?|peliculas?|cabos?|carregador(?:es)?|controles? remotos?|pecas?|refis?|refil|tampas?|protetor(?:es)?|adesivos?|skins?|alca|pulseiras?|base para|fonte para|bateria para|filtro para|borracha para|mangueira para|placa para|resistencia para)\b/;

export const ARVORE: Def[] = [
  /* ───────────────────────── 1. ELETRÔNICOS ───────────────────────── */
  n(
    "eletronicos",
    "Eletrônicos",
    { ml: /^[^|]*\| eletronicos, audio e video\b/, legado: "eletronicos" },
    [
      n("audio-e-som", "Áudio e som", { ml: /\| eletronicos, audio e video > audio\b/ }, [
        n("fones-gamer", "Fones gamer", {
          ml: /acessorios para pc gaming > fones|playstation \d > audio e video para gaming/,
          titulo: /^(?:fones?|headsets?|headphones?)\b.*\bgamer\b|^headset gamer/,
          nao: ACESSORIO,
          filtros: ["conexao_fone", "cancelamento"],
        }),
        n("fones-tws", "Fones TWS (sem fio, intra)", {
          titulo:
            /^(?:fones?(?: de ouvido)?|earbuds?)\b.*\b(?:tws|true wireless|earbuds?|intra-?auricular)\b|^(?:fones?|earbuds?)\b.*\b(?:buds|airpods|freebuds|liberty)\b/,
          nao: ACESSORIO,
          filtros: ["cancelamento"],
        }),
        n("fones-bluetooth", "Fones Bluetooth", {
          ml: /mlb-headphones\b.*> audio > fones de ouvido/,
          titulo: /^(?:fones?|headphones?|head ?set)\b.*\b(?:bluetooth|sem fio|wireless)\b/,
          nao: ACESSORIO,
          filtros: ["conexao_fone", "cancelamento", "formato_fone"],
        }),
        n("fones-com-fio", "Fones com fio", {
          titulo: /^(?:fones?|headphones?)\b.*\b(?:com fio|p2|3[.,]5 ?mm|usb-?c)\b/,
          nao: /bluetooth|sem fio|wireless|tws|^(?:cabo|adaptador)/,
          filtros: ["formato_fone"],
        }),
        n("headsets", "Headsets", {
          ml: /mlb-headset_telephones|telefones headset/,
          titulo: /^headsets?\b/,
          nao: ACESSORIO,
          filtros: ["conexao_fone"],
        }),
        n("caixas-bluetooth", "Caixas de som Bluetooth", {
          ml: /audio portatil e acessorios > acessorios > caixas bluetooth|> audio > boomboxes/,
          titulo:
            /^(?:caixa|caixinha)s? (?:de )?som\b.*\b(?:bluetooth|portatil|sem fio)\b|^(?:jbl|soundcore)\b.*\bcaixa\b/,
          nao: ACESSORIO,
        }),
        n("caixas-de-som", "Caixas de som", {
          ml: /> audio > caixas acusticas|perifericos para pc > caixas de som/,
          titulo: /^(?:caixa|caixinha)s? (?:de )?som\b|^(?:caixas? acusticas?|subwoofer)\b/,
          nao: ACESSORIO,
        }),
        n("soundbars-e-home-theaters", "Soundbars e home theaters", {
          ml: /mlb-soundbars|mlb-home_theaters/,
          titulo: /^(?:soundbar|home theater)\b/,
        }),
        n("assistentes-virtuais", "Assistentes virtuais", {
          ml: /mlb-smart_speakers|assistentes pessoais/,
          titulo: /^(?:echo (?:dot|pop|show)|alexa|google (?:home|nest))\b/,
        }),
        n("microfones", "Microfones", {
          ml: /mlb-microphones|microfones e pre amps|microfones e amplificadores > microfones|acessorios para cameras > microfones/,
          titulo:
            /^microfones?\b|^receptor digital (?:sem fio )?\d* ?(?:canais )?shure|\bshure\b.*\breceptor\b/,
          nao: /^(?:pe|pes|suporte|pedestal|espuma|cabo)\b/,
        }),
        n("amplificadores", "Amplificadores e receivers", {
          ml: /amplificadores e receivers|mlb-audio_crossovers/,
          titulo: /^(?:amplificador|receiver)\b/,
          nao: /automotiv|\bcarro\b/,
        }),
        n("equipamentos-dj", "Equipamentos para DJ e palco", {
          ml: /equipamento para djs/,
        }),
        n("acessorios-de-audio", "Acessórios de áudio", {
          ml: /pes de microfone|suportes para fones|mlb-headphone_stands|mlb-pop_filters/,
          titulo:
            /^(?:capas?|cases?|estojos?|bolsas?|suportes?|almofadas?|espumas?)\b.*\b(?:caixa (?:de )?som|jbl|fones?|headset|microfone)\b|^(?:pes?|pedestal) (?:de|para) microfone/,
        }),
        n("radios", "Rádios", { ml: /radios am\/fm/, titulo: /^radio\b(?! comunicador)/ }),
      ]),
      n(
        "tv-e-video",
        "TV e vídeo",
        {
          ml: /\| eletronicos, audio e video > (?:televisores|acessorios para tv|acessorios para audio e video|controles remotos|pecas para tv|projetores|media streaming|cabos > cabos de audio e video)/,
        },
        [
          n("smart-tvs", "Smart TVs", {
            ml: /mlb-televisions/,
            titulo: /^(?:smart ?tv|tv|televis(?:ao|or))\b/,
            nao: /^(?:suporte|controle|capa|antena|cabo|receptor|conversor|tv box|barra|placa|kit barra)/,
            filtros: ["polegadas"],
          }),
          n("projetores", "Projetores", {
            ml: /mlb-projectors|projetores e telas/,
            titulo: /^(?:mini )?projetor\b/,
            nao: ACESSORIO,
          }),
          n("tv-box", "TV Box e streaming", {
            ml: /mlb-streaming_media_devices|media streaming/,
            titulo: /^(?:tv box|fire tv|chromecast|roku|mi tv stick|tv stick)\b|\btv box\b/,
            nao: /^controle/,
          }),
          n("receptores-digitais", "Receptores digitais e via satélite", {
            ml: /receptores para tv|kits de antenas parabolicas/,
            titulo: /^(?:kit (?:com )?\d* ?)?receptor(?:es)?\b|^conversor digital\b/,
            nao: /shure|microfone|bluetooth|^controle/,
          }),
          n("antenas", "Antenas", {
            titulo: /^(?:kit )?antenas?\b.*\b(?:digital|tv|hdtv|uhf|parabolica)\b/,
            nao: /automotiv|veicular|wi-?fi/,
          }),
          n("controles-remotos", "Controles remotos", {
            ml: /> controles remotos > (?:para tv|para media streaming|para reprodutores)/,
            titulo: /^controles? remotos?\b/,
            nao: /\b(?:ar condicionado|carro|portao|brinquedo)\b/,
          }),
          n("suportes-de-tv", "Suportes para TV", {
            ml: /mlb-tv_and_monitor_stands_and_wall_hangers/,
            titulo: /^suportes?\b.*\b(?:tv|televis|monitor)\b/,
          }),
          n("cabos-e-adaptadores-de-video", "Cabos e adaptadores de vídeo", {
            ml: /mlb-audio_and_video_cables_and_adapters|mlb-audio_and_video_converters(?!.*receptores)|switches e splitters/,
            titulo:
              /^(?:cabo|adaptador|conversor|splitter|switch)\b.*\b(?:hdmi|vga|rca|displayport|av)\b/,
          }),
          n("pecas-de-tv", "Peças de TV", {
            ml: /pecas para tv/,
            titulo: /^(?:kit )?barras? (?:de )?led\b.*\btv\b/,
          }),
        ],
      ),
      n(
        "celulares",
        "Celulares e acessórios",
        {
          ml: /\| celulares e telefones > (?:celulares e smartphones|acessorios para celulares|pecas para celular)/,
          legado: "celulares",
        },
        [
          n("smartphones", "Smartphones", {
            ml: /mlb-cellphones\b/,
            titulo:
              /^(?:smartphone|celular|iphone|galaxy|xiaomi|redmi|poco|motorola|moto [geg]\d)\b/,
            nao: ACESSORIO,
            filtros: ["armazenamento"],
          }),
          n("capas-de-celular", "Capas", {
            ml: /mlb-cellphone_cases_and_covers/,
            titulo:
              /^(?:capas?|capinhas?|cases?)\b.*\b(?:celular|iphone|galaxy|samsung|motorola|xiaomi|redmi|moto ?(?:g|e|edge) ?\d+)\b/,
            // capa para moto (veículo) e de GPS não é capa de celular
            nao: /\b(?:para|pra|de) moto\b|\bgps\b/,
          }),
          n("peliculas", "Películas", {
            ml: /mlb-cellphone_tablet_and_gps_screen_protectors|protetores de cameras/,
            titulo: /^(?:peliculas?|protetor(?:es)? de (?:tela|camera))\b/,
          }),
          n("carregadores", "Carregadores", {
            ml: /mlb-mobile_device_chargers|receptores sem fios qi/,
            titulo:
              /^(?:carregador|fonte)\b.*\b(?:celular|iphone|turbo|usb-?c|tipo-?c|samsung|motorola|xiaomi|w\b)/,
            nao: /notebook|bateria (?:automotiva|de carro)|pilhas?/,
          }),
          n("cabos-usb", "Cabos USB", {
            ml: /acessorios para celulares > cabos\b/,
            titulo: /^cabos?\b.*\b(?:usb|lightning|tipo-?c|type-?c|micro ?usb)\b/,
            nao: /hdmi|rede|rj45/,
          }),
          n("power-banks", "Power banks", {
            ml: /mlb-portable_batteries|mlb-power_banks/,
            titulo: /^(?:power ?bank|carregador portatil|bateria (?:externa|portatil))\b/,
          }),
          n("suportes-de-celular", "Suportes", {
            ml: /mlb-vehicle_cellphone_and_gps_mounts|colgantes e suportes/,
            titulo: /^suportes?\b.*\b(?:celular|smartphone|magsafe)\b/,
          }),
          n("pecas-de-celular", "Peças e componentes", {
            ml: /pecas para celular|mlb-cellphone_batteries/,
            titulo:
              /^(?:alto[- ]?falante|campainha|conector de carga|placa de carga|flex|camera traseira|bateria)\b.*\b(?:celular|iphone|galaxy|moto|redmi|samsung|motorola|xiaomi|[a-z]\d{2})\b/,
          }),
          n("acessorios-de-celular", "Outros acessórios", { ml: /acessorios para celulares/ }),
        ],
      ),
      n(
        "fotografia-e-video",
        "Fotografia, vídeo e drones",
        { ml: /\| cameras e acessorios|\| eletronicos, audio e video > drones e acessorios/ },
        [
          n("cameras-digitais", "Câmeras digitais", {
            ml: /mlb-digital_cameras/,
            titulo: /^camera (?:digital|fotografica)\b/,
          }),
          n("cameras-de-acao", "Câmeras de ação", {
            ml: /mlb-action_cameras/,
            titulo: /^(?:camera de acao|gopro)\b/,
          }),
          n("drones", "Drones", { ml: /mlb-drones\b/, titulo: /^drones?\b/, nao: ACESSORIO }),
          n("tripes", "Tripés e estabilizadores", {
            ml: /mlb-camera_tripods|suportes e estabilizadores/,
            titulo: /^(?:tripe|estabilizador|gimbal|pau de selfie)\b/,
          }),
          n("iluminacao-foto", "Iluminação e estúdio", {
            ml: /estudio e iluminacao/,
            titulo: /^(?:ring ?light|iluminador|softbox|fundo fotografico)\b/,
          }),
          n("acessorios-de-camera", "Acessórios", {
            ml: /acessorios para cameras|drones e acessorios > acessorios e pecas/,
          }),
        ],
      ),
      n(
        "dispositivos-inteligentes",
        "Dispositivos inteligentes",
        { ml: /\| celulares e telefones > (?:smartwatches e acessorios|oculos)/ },
        [
          n("smartwatches", "Smartwatches", {
            ml: /mlb-smartwatches\b/,
            titulo:
              /^(?:smartwatch|relogio inteligente|apple watch|galaxy watch|redmi watch|amazfit)\b/,
            nao: ACESSORIO,
          }),
          n("smartbands", "Smartbands", {
            ml: /smartbands/,
            titulo: /^(?:smartband|mi band|pulseira inteligente)\b/,
          }),
          n("acessorios-smartwatch", "Pulseiras e carregadores de smartwatch", {
            ml: /mlb-smartwatch_chargers|mlb-smartwatch_and_watch_bands|smartwatch_and_wristwatch_screen_protectors/,
            titulo: /^(?:pulseira|carregador|cabo|pelicula)\b.*\b(?:smartwatch|watch|relogio)\b/,
          }),
          n("oculos-vr", "Óculos de realidade virtual", {
            ml: /mlb-vr_headsets/,
            titulo: /^(?:oculos (?:de )?(?:realidade virtual|vr|3d)|meta quest)\b/,
          }),
          n("rastreadores", "Rastreadores inteligentes", {
            ml: /mlb-gps_trackers|mlb-smart_trackers/,
            titulo: /^(?:rastreador|airtag|smarttag|localizador)\b/,
          }),
          n("automacao-residencial", "Automação residencial", {
            ml: /mlb-smart_plugs|mlb-smart_switches|automacao/,
            titulo: /^(?:tomada|interruptor|lampada|sensor)\b.*\b(?:inteligente|smart|wi-?fi)\b/,
          }),
        ],
      ),
      n(
        "telefonia-e-radio",
        "Telefonia e rádio comunicação",
        { ml: /\| celulares e telefones > (?:telefonia fixa e sem fio|voip|radio comunicadores)/ },
        [
          n("telefones", "Telefones fixos e sem fio", {
            ml: /telefonia fixa e sem fio > telefones|mlb-telephones/,
            titulo: /^telefone\b(?! ip)/,
          }),
          n("telefones-ip", "Telefones IP e VoIP", {
            ml: /\| celulares e telefones > voip/,
            titulo: /^telefone ip\b/,
          }),
          n("radios-comunicadores", "Rádios comunicadores", {
            ml: /radio comunicadores/,
            titulo: /^(?:radio comunicador|walkie[- ]?talkie)\b/,
          }),
        ],
      ),
      n("pilhas-e-baterias", "Pilhas e carregadores", {
        ml: /pilhas e carregadores/,
        titulo: /^(?:pilhas?|baterias? (?:recarregaveis|aa|aaa|9v)|carregador de pilhas?)\b/,
      }),
      n("componentes-eletronicos", "Componentes eletrônicos", {
        ml: /componentes eletronicos/,
        titulo: /^(?:arduino|esp32|esp8266|raspberry|modulo rele|capacitor|resistor|transistor)\b/,
      }),
    ],
  ),

  /* ───────────────────────── 2. INFORMÁTICA ───────────────────────── */
  n("informatica", "Informática", { ml: /^[^|]*\| informatica\b/, legado: "informatica" }, [
    n(
      "computadores",
      "Computadores",
      { ml: /portateis e acessorios > notebooks|pc de mesa|mlb-notebooks|mlb-desktop_computer/ },
      [
        n("notebooks-gamer", "Notebooks gamer", {
          ml: /mlb-notebooks/,
          titulo:
            /^notebook\b.*\bgamer\b|^notebook\b.*\b(?:rtx|nitro|tuf|legion|omen|loq|predator)\b/,
          filtros: ["memoria_ram", "armazenamento"],
        }),
        n("ultrabooks", "Ultrabooks e MacBooks", {
          ml: /mlb-notebooks/,
          titulo:
            /^(?:ultrabook|macbook|notebook\b.*\b(?:ultrafino|zenbook|swift|yoga|xps|galaxy book\d? pro))\b/,
          filtros: ["memoria_ram", "armazenamento"],
        }),
        n("notebooks", "Notebooks", {
          ml: /mlb-notebooks/,
          titulo: /^(?:notebook|laptop|chromebook)\b/,
          nao: ACESSORIO,
          filtros: ["memoria_ram", "armazenamento"],
        }),
        n("pcs-gamer", "PCs gamer", { titulo: /^(?:pc|computador|cpu)\b.*\bgamer\b/ }),
        n("mini-pcs", "Mini PCs", { ml: /mlb-mini_pcs/, titulo: /^mini (?:pc|computador)\b/ }),
        n("all-in-one", "All-in-one", {
          ml: /mlb-all_in_one/,
          titulo: /^(?:computador |pc )?all[- ]in[- ]one\b/,
        }),
        n("desktops", "Desktops", {
          ml: /pc de mesa|mlb-desktop_computer_kits/,
          titulo: /^(?:computador|pc|cpu)\b(?!.*\bgamer\b)/,
          nao: /^(?:pc|computador)\b.*\b(?:mesa digitalizadora|gabinete vazio)\b/,
        }),
      ],
    ),
    n("tablets-e-ereaders", "Tablets e leitores digitais", { ml: /tablets e acessorios/ }, [
      n("tablets", "Tablets", {
        ml: /mlb-tablets\b/,
        titulo: /^(?:tablet|ipad|galaxy tab|redmi pad|xiaomi pad)\b/,
        nao: ACESSORIO,
      }),
      n("e-readers", "Leitores digitais (Kindle)", {
        ml: /mlb-e_readers/,
        titulo: /^(?:kindle|e-?reader|leitor digital)\b/,
        nao: ACESSORIO,
      }),
      n("acessorios-tablet", "Acessórios para tablet", {
        ml: /tablets e acessorios > (?:acessorios|pecas)/,
      }),
    ]),
    n("componentes-pc", "Componentes", { ml: /informatica > componentes para pc/ }, [
      n("processadores", "Processadores", {
        ml: /mlb-computer_processors/,
        titulo: /^processador(?:es)?\b.*\b(?:intel|amd|ryzen|core i\d|xeon)\b/,
      }),
      n("placas-de-video", "Placas de vídeo", {
        ml: /mlb-graphics_cards/,
        titulo: /^placas? de video\b|^(?:gpu|geforce|radeon|rtx|gtx)\b/,
        nao: /^(?:suporte|cabo|riser|adaptador)\b/,
      }),
      n("placas-mae", "Placas-mãe", {
        ml: /mlb-computer_motherboards/,
        titulo: /^placas?[- ]mae\b/,
      }),
      n("memoria-ram", "Memória RAM", {
        ml: /mlb-ram_memory_modules/,
        titulo: /^(?:memoria|memorias)(?: ram)?\b.*\bddr\d\b/,
        filtros: ["memoria_ram"],
      }),
      n("fontes-pc", "Fontes", {
        ml: /mlb-desktop_computer_power_supplies/,
        titulo: /^fonte\b.*\b(?:atx|\d{3,4} ?w|80 plus|pc|gamer)\b/,
        nao: /notebook|celular|chaveada|nobreak/,
      }),
      n("gabinetes", "Gabinetes", { ml: /mlb-desktop_computer_cases/, titulo: /^gabinete\b/ }),
      n("coolers-e-refrigeracao", "Coolers, ventoinhas e refrigeração", {
        ml: /componentes para pc > refrigeracao|mlb-pc_thermal_compound_pastes/,
        titulo: /^(?:cooler|water ?cooler|ventoinha|fan|kit fans?|pasta termica)\b/,
        nao: /notebook|celular/,
      }),
      n("placas-de-expansao", "Placas de som e captura", {
        ml: /placas de captura|placas de som|placas usb e firewire/,
      }),
    ]),
    n(
      "armazenamento",
      "Armazenamento",
      {
        ml: /informatica > armazenamento|mlb-memory_cards/,
        filtros: ["armazenamento", "interface_ssd"],
      },
      [
        n("ssd-nvme", "SSD NVMe M.2", {
          ml: /mlb-hard_drives_and_ssds|mlb-solid_state_drives/,
          titulo:
            /^(?:hd )?(?:ssd|disco solido)\b.*\b(?:nvme|m\.?2|pcie)\b|^(?:ssd )?(?:nvme|m\.2)\b/,
          nao: /\b(?:externo|portatil|case|gaveta|adaptador|dock|leitor)\b/,
        }),
        n("ssd-externo", "SSD externo", {
          ml: /mlb-hard_drives_and_ssds|mlb-external_solid_state_drives/,
          titulo: /^(?:ssd|disco solido)\b.*\b(?:externo|portatil)\b/,
          nao: /\b(?:case|gaveta|adaptador|dock)\b/,
        }),
        n("ssd-sata", "SSD SATA", {
          ml: /mlb-hard_drives_and_ssds|mlb-solid_state_drives/,
          titulo: /^(?:hd )?(?:ssd|disco solido)\b/,
          nao: /\b(?:nvme|m\.2|pcie|externo|portatil|case|gaveta|adaptador|dock)\b/,
        }),
        n("hd-externo", "HD externo", {
          ml: /mlb-hard_drives_and_ssds|mlb-external_hard_drives/,
          titulo: /^(?:hd|disco rigido)\b.*\b(?:externo|portatil)\b/,
          nao: /\b(?:case|gaveta|adaptador|ssd)\b/,
        }),
        n("hd-interno", "HD interno", {
          ml: /mlb-hard_drives_and_ssds/,
          titulo: /^(?:hd|disco rigido)\b/,
          nao: /\b(?:externo|portatil|ssd|case|gaveta|adaptador|camera|tv|hdmi)\b/,
        }),
        n("pen-drives", "Pen drives", { ml: /mlb-pendrives/, titulo: /^pen ?drives?\b/ }),
        n("cartoes-de-memoria", "Cartões de memória", {
          ml: /mlb-memory_cards/,
          titulo: /^(?:cartao|cartoes) (?:de )?memoria\b|^micro ?sd\b/,
        }),
        n("cases-e-docks", "Cases, gavetas e docks", {
          ml: /mlb-hard_drives_and_ssds_enclosures|mlb-hard_drive_and_ssd_docking_stations|discos e acessorios > acessorios/,
          titulo: /^(?:case|gaveta|dock(?:ing)?|adaptador)\b.*\b(?:hd|ssd|nvme|sata|m\.2)\b/,
        }),
        n("leitores-de-cartao", "Leitores de cartão", { ml: /mlb-memory_readers/ }),
      ],
    ),
    n(
      "perifericos",
      "Periféricos",
      {
        ml: /informatica > (?:perifericos para pc|acessorios para pc gaming|cabos e hubs usb|monitores e acessorios)/,
      },
      [
        n("mouses-gamer", "Mouses gamer", {
          ml: /mlb-computer_mice/,
          titulo: /^mouses?\b.*\bgamer\b/,
        }),
        n("mouses", "Mouses", {
          ml: /mlb-computer_mice/,
          titulo: /^mouses?\b/,
          nao: /\bpad\b|gamer/,
        }),
        n("teclados-mecanicos", "Teclados mecânicos", {
          ml: /mlb-pc_keyboards/,
          titulo: /^teclados?\b.*\bmecanico\b/,
        }),
        n("teclados", "Teclados e kits", {
          ml: /mlb-pc_keyboards|mlb-keyboard_and_mouse_kits/,
          titulo: /^(?:teclados?|kit teclado)\b/,
          nao: /mecanico|notebook|tablet|piano|musical/,
        }),
        n("monitores", "Monitores", {
          ml: /mlb-monitors/,
          titulo: /^monitor(?:es)?\b(?! de (?:pressao|bebe|glicose))/,
          nao: ACESSORIO,
          filtros: ["polegadas"],
        }),
        n("webcams", "Webcams", { ml: /mlb-webcams/, titulo: /^webcams?\b/ }),
        n("mousepads", "Mousepads", {
          ml: /mlb-mouse_pads/,
          titulo: /^(?:mouse ?pads?|deskpads?)\b/,
        }),
        n("hubs-usb", "Hubs USB e docking stations", {
          ml: /mlb-usb_hubs|cabos e hubs usb > hubs/,
          titulo: /^(?:hub|docking station|adaptador multiportas)\b/,
        }),
        n("cadeiras-gamer", "Cadeiras gamer", {
          ml: /cadeiras gamer/,
          titulo: /^cadeira\b.*\bgamer\b/,
        }),
        n("controles-pc", "Controles, volantes e simuladores", {
          ml: /acessorios para pc gaming > controles e joysticks/,
        }),
        n("cabos-e-energia", "Cabos e organização", { ml: /cabos e hubs usb > cabos/ }),
      ],
    ),
    n(
      "redes",
      "Redes e conectividade",
      { ml: /informatica > conectividade e redes/, filtros: ["portas_rede"] },
      [
        n("sistemas-mesh", "Sistemas Mesh", {
          ml: /mlb-routers_and_wireless_systems/,
          titulo: /\bmesh\b/,
        }),
        n("repetidores-wifi", "Repetidores Wi-Fi", {
          ml: /mlb-routers_and_wireless_systems|mlb-wifi_range_extenders/,
          titulo: /^(?:repetidor|extensor|amplificador)\b.*\b(?:wi-?fi|sinal)\b/,
        }),
        n("roteadores", "Roteadores", {
          ml: /mlb-routers_and_wireless_systems/,
          titulo: /^roteador(?:es)?\b/,
        }),
        n("adaptadores-de-rede", "Adaptadores de rede", {
          ml: /mlb-network_cards|mlb-wireless_antennas_and_adapters|placas de rede/,
          titulo:
            /^(?:adaptador|placa de rede|antena)\b.*\b(?:wi-?fi|wireless|usb|rede|bluetooth)\b/,
        }),
        n("switches", "Switches", {
          ml: /mlb-network_switches/,
          titulo: /^switch\b/,
          nao: /nintendo|hdmi/,
        }),
        n("cabos-de-rede", "Cabos de rede", {
          ml: /mlb-network_cables|cabos de rede e acessorios/,
          titulo: /^cabos? (?:de )?rede\b|^cabo\b.*\b(?:cat ?\d|rj45|ethernet)\b/,
        }),
        n("racks-e-ferramentas-rede", "Racks e ferramentas de rede", {
          ml: /racks de servidores|conectividade e redes > ferramentas/,
        }),
      ],
    ),
    n("impressao", "Impressão", { ml: /informatica > impressao/ }, [
      n("multifuncionais", "Multifuncionais", {
        ml: /mlb-printers/,
        titulo: /^(?:impressora )?multifuncional\b|^impressora\b.*\bmultifuncional\b/,
      }),
      n("impressoras", "Impressoras", {
        ml: /mlb-printers|mlb-label_printers/,
        titulo: /^impressora\b/,
        nao: /\b3d\b/,
      }),
      n("impressao-3d", "Impressão 3D", {
        ml: /impressao 3d/,
        titulo: /\b(?:impressora|filamento|caneta) 3d\b|^filamento\b/,
      }),
      n("cartuchos-e-toners", "Cartuchos, tintas e toners", {
        ml: /suprimentos de impressao|mlb-toner_drums|mlb-ink_cartridges|mlb-printer_inks|mlb-toners/,
        titulo: /^(?:cartucho|toner|refil de tinta|tinta|kit tintas?|pack \d tintas?|cilindro)\b/,
      }),
      n("scanners", "Scanners", { ml: /mlb-scanners/, titulo: /^scanner\b/ }),
      n("pecas-impressora", "Peças e acessórios", {
        ml: /informatica > impressao > (?:pecas|acessorios)/,
      }),
    ]),
    n("acessorios-notebook", "Acessórios para notebook", {
      ml: /portateis e acessorios > (?:acessorios para notebook|pecas e partes)/,
      titulo: /^(?:suporte|base|cooler|carregador|fonte|bateria|mochila|capa)\b.*\bnotebook\b/,
    }),
    n("softwares", "Softwares", { ml: /informatica > softwares/ }),
    n("limpeza-pc", "Limpeza e manutenção de PC", { ml: /limpeza de pcs/ }),
  ]),

  /* ───────────────────────── 3. ELETRODOMÉSTICOS ───────────────────────── */
  n(
    "eletrodomesticos",
    "Eletrodomésticos",
    { ml: /^[^|]*\| eletrodomesticos\b/, legado: "eletrodomesticos", filtros: ["voltagem"] },
    [
      n(
        "refrigeracao",
        "Refrigeração",
        { ml: /eletrodomesticos > refrigeracao/, filtros: ["litros", "tecnologia_refrigeracao"] },
        [
          n("adegas", "Adegas climatizadas", {
            ml: /mlb-wine_cellars|adegas climatizadas/,
            titulo: /^adega\b/,
          }),
          n("cervejeiras", "Cervejeiras", { ml: /> cervejeiras/, titulo: /^cervejeira\b/ }),
          n("frigobares", "Frigobares", { ml: /> frigobares/, titulo: /^frigobar\b/ }),
          n("freezers", "Freezers", { ml: /mlb-freezers|> freezers/, titulo: /^freezer\b/ }),
          n("geladeiras", "Geladeiras", {
            ml: /refrigeracao > geladeiras/,
            titulo: /^(?:geladeira|refrigerador)\b/,
            nao: /\b(?:brinquedo|infantil|termica|portatil de praia|porta latas?)\b|^(?:borracha|filtro|termostato|placa|sensor|rele|motor|compressor)/,
          }),
          n("pecas-refrigeracao", "Peças para geladeira", {
            ml: /refrigeracao > pecas e acessorios/,
          }),
        ],
      ),
      n(
        "lavanderia",
        "Lavanderia",
        {
          ml: /eletrodomesticos > lavadores > (?:maquinas de|pecas)|mlb-sewing_machines|mlb-irons/,
        },
        [
          n("lava-e-seca", "Lava e seca", {
            ml: /mlb-washing_machines/,
            titulo: /^(?:maquina |lavadora )?lava e seca\b|^lava e seca\b/,
          }),
          n("tanquinhos", "Tanquinhos", {
            ml: /mlb-washing_machines|mlb-twin_tub/,
            titulo: /^tanquinho\b/,
          }),
          n("centrifugas", "Centrífugas", { titulo: /^centrifuga\b/ }),
          n("maquinas-de-lavar", "Máquinas de lavar", {
            ml: /mlb-washing_machines/,
            titulo: /^(?:maquina de lavar|lavadora)\b/,
            nao: /louca|alta pressao|jato/,
          }),
          n("secadoras", "Secadoras", {
            ml: /mlb-dryer_machines/,
            titulo: /^secadora\b/,
            nao: /cabelo/,
          }),
          n("ferros-de-passar", "Ferros de passar e vaporizadores", {
            ml: /mlb-irons|mlb-garment_steamers/,
            titulo: /^(?:ferro de passar|vaporizador de roupas|passadeira a vapor)\b/,
          }),
          n("maquinas-de-costura", "Máquinas de costura", { ml: /mlb-sewing_machines/ }),
          n("pecas-lavanderia", "Peças para máquina de lavar", {
            ml: /lavadores > pecas e acessorios/,
          }),
        ],
      ),
      n("cozinha-eletro", "Cozinha", { ml: /eletrodomesticos > fornos e fogoes|mlb-dishwashers/ }, [
        n("fogoes", "Fogões", { ml: /mlb-ranges\b/, titulo: /^fogao\b/ }),
        n("cooktops", "Cooktops", { ml: /mlb-cooktops/, titulo: /^cooktop\b/ }),
        n("micro-ondas", "Micro-ondas", {
          ml: /mlb-microwaves/,
          titulo: /^micro-?ondas\b/,
          nao: ACESSORIO,
        }),
        n("fornos", "Fornos", { ml: /mlb-ovens/, titulo: /^forno\b/ }),
        n("coifas-e-depuradores", "Coifas e depuradores", {
          ml: /mlb-kitchen_range_hoods/,
          titulo: /^(?:coifa|depurador)\b/,
        }),
        n("lava-loucas", "Lava-louças", { ml: /mlb-dishwashers/, titulo: /^lava[- ]?loucas?\b/ }),
        n("pecas-fogao", "Peças para fogão e micro-ondas", {
          ml: /fornos e fogoes > pecas e acessorios/,
        }),
      ]),
      n(
        "pequenos-eletrodomesticos",
        "Pequenos eletrodomésticos",
        { ml: /pequenos eletrodomesticos > para a cozinha/ },
        [
          n("airfryers", "Airfryers", {
            ml: /mlb-air_fryers/,
            titulo: /^(?:air ?fryer|fritadeira (?:eletrica )?(?:sem oleo|air))\b/,
          }),
          n("liquidificadores", "Liquidificadores", {
            ml: /mlb-blenders/,
            titulo: /^liquidificador\b/,
          }),
          n("batedeiras", "Batedeiras", { ml: /mlb-mixers\b/, titulo: /^batedeira\b/ }),
          n("cafeteiras", "Cafeteiras", {
            ml: /mlb-electric_coffee_makers|mlb-espresso_machines|mlb-capsule_coffee/,
            titulo: /^cafeteira\b/,
            nao: /^(?:filtro|capsula|refil)/,
          }),
          n("sanduicheiras", "Sanduicheiras e grills", {
            ml: /mlb-electric_sandwich_makers|mlb-electric_grills/,
            titulo: /^(?:sanduicheira|grill)\b/,
          }),
          n("torradeiras", "Torradeiras", { ml: /mlb-toasters/, titulo: /^torradeira\b/ }),
          n("mixers", "Mixers", { ml: /mlb-hand_blenders/, titulo: /^mixer\b/ }),
          n("processadores-de-alimentos", "Processadores de alimentos", {
            ml: /mlb-food_processors/,
            titulo: /^(?:processador|multiprocessador) de alimentos\b|^multiprocessador\b/,
          }),
          n("panelas-eletricas", "Panelas elétricas", {
            ml: /mlb-electric_pressure_cookers|mlb-rice_cookers|mlb-electric_food_steamers|mlb-slow_cookers/,
            titulo: /^panela\b.*\beletrica\b|^panela de arroz\b/,
          }),
          n("chaleiras-eletricas", "Chaleiras elétricas", {
            ml: /mlb-electric_jugs|mlb-electric_kettles|chaleiras eletricas/,
            titulo: /^(?:chaleira|jarra)\b.*\beletrica\b/,
          }),
          n("pipoqueiras", "Pipoqueiras e máquinas de sobremesa", {
            ml: /maquinas para sobremesas|mlb-popcorn_machines/,
            titulo: /^pipoqueira\b/,
          }),
          n("outros-cozinha-eletro", "Outros para a cozinha", {
            ml: /pequenos eletrodomesticos > para a cozinha/,
          }),
        ],
      ),
      n("climatizacao", "Climatização", { ml: /eletrodomesticos > ar e ventilacao/ }, [
        n("ar-condicionado", "Ar-condicionado", {
          ml: /mlb-air_conditioners/,
          titulo: /^ar[- ]condicionado\b/,
          nao: ACESSORIO,
        }),
        n("ventiladores", "Ventiladores", {
          ml: /mlb-fans\b|mlb-portable_fans|mlb-ceiling_fans/,
          titulo: /^ventilador(?:es)?\b/,
          nao: ACESSORIO,
        }),
        n("climatizadores", "Climatizadores", {
          ml: /mlb-portable_evaporative_air_coolers/,
          titulo: /^climatizador\b/,
        }),
        n("aquecedores", "Aquecedores de ar", {
          ml: /mlb-electric_home_heaters|aquecedores de ar/,
          titulo: /^aquecedor\b(?!.*\bagua\b)/,
        }),
        n("aquecedores-de-agua", "Aquecedores de água", {
          ml: /mlb-water_heaters/,
          titulo: /^aquecedor\b.*\bagua\b/,
        }),
        n("umidificadores", "Umidificadores", { ml: /mlb-humidifiers/, titulo: /^umidificador\b/ }),
        n("desumidificadores", "Desumidificadores", {
          ml: /mlb-dehumidifiers/,
          titulo: /^desumidificador\b/,
        }),
        n("pecas-climatizacao", "Peças e acessórios de ar-condicionado", {
          ml: /ar e ventilacao > pecas e acessorios/,
        }),
      ]),
      n(
        "limpeza-eletrica",
        "Limpeza elétrica",
        {
          ml: /pequenos eletrodomesticos > para a casa > (?:aspiradores|robos)|limpeza > lavadoras de jato/,
        },
        [
          n("robos-aspiradores", "Robôs aspiradores", {
            ml: /mlb-robot_vacuums/,
            titulo: /^(?:robo aspirador|aspirador robo)\b/,
          }),
          n("aspiradores", "Aspiradores", {
            ml: /mlb-vacuum_and_steam_cleaners/,
            titulo: /^aspirador\b/,
            nao: ACESSORIO,
          }),
          n("extratoras", "Extratoras", { titulo: /^extratora\b/ }),
          n("vaporizadores", "Vaporizadores", { titulo: /^vaporizador\b(?!.*roupa)/ }),
          n("lavadoras-alta-pressao", "Lavadoras de alta pressão", {
            ml: /lavadoras de jato|mlb-pressure_washers/,
            titulo: /^lavadora\b.*\b(?:alta pressao|jato)\b|^lavajato\b/,
          }),
        ],
      ),
      n("bebedouros-e-purificadores", "Bebedouros e purificadores", {
        ml: /bebedouros e purificadores/,
        titulo: /^(?:bebedouro|purificador de agua|filtro de agua)\b/,
      }),
    ],
  ),

  /* ───────────────────────── 4. CASA E UTILIDADES ───────────────────────── */
  n("casa", "Casa e utilidades", { ml: /^[^|]*\| casa, moveis e decoracao\b/, legado: "casa" }, [
    n("cozinha-e-mesa", "Cozinha e mesa", { ml: /casa, moveis e decoracao > cozinha\b/ }, [
      n("panelas", "Panelas e jogos de panelas", {
        ml: /mlb-kitchen_pots|mlb-kitchen_cookware_kits|mlb-pressure_cookers/,
        titulo: /^(?:jogo de panelas|panelas?|caldeirao|cacarola)\b/,
        nao: /eletrica|\bbrinquedo\b/,
      }),
      n("frigideiras", "Frigideiras", {
        ml: /mlb-frying_pans/,
        titulo: /^(?:frigideira|wok|chapa|bistequeira)\b/,
        nao: /cabelo|prancha/,
      }),
      n("leiteiras", "Leiteiras e fervedores", {
        ml: /mlb-milk_pots|> fervedores/,
        titulo: /^(?:leiteira|fervedor)\b/,
        nao: /eletric/,
      }),
      n("canecas-e-copos", "Canecas, copos e taças", {
        ml: /mlb-mugs|mlb-drinking_glasses|mlb-drink_jugs|taças e copos/,
        titulo: /^(?:canecas?|copos?|tacas?|jarras?)\b/,
        nao: /termic|medidor|eletric|^copo menstrual/,
      }),
      n("pratos-e-talheres", "Pratos, louças e talheres", {
        ml: /louca e artigos para servir|mlb-tableware_kits|mlb-flatware_kits|mlb-kitchen_knives/,
        titulo:
          /^(?:aparelho de jantar|jogo de pratos|pratos?|faqueiro|talheres|jogo de facas|facas?)\b/,
      }),
      n("utensilios-de-cozinha", "Utensílios", {
        ml: /cozinha > (?:utensilios de preparacao|utensilios para confeitaria|cozimento > (?:travessas|papel|aquecedores))/,
      }),
      n("organizadores-de-cozinha", "Potes e organizadores", {
        ml: /cozinha > armazenamento e organizacao/,
        titulo:
          /^(?:potes?|kit potes|porta (?:condimentos|temperos)|escorredor de loucas?|organizador)\b/,
        nao: /maquiagem|esmaltes?\b|cosmetic/,
      }),
      n("bar-e-vinho", "Bar e vinho", { ml: /artigos de vinho e bar/ }),
    ]),
    n(
      "cama-mesa-e-banho",
      "Cama, mesa e banho",
      { ml: /texteis de casa e decoracao|> toalhas e roupoes/ },
      [
        n("jogos-de-cama", "Jogos de cama e lençóis", {
          ml: /> roupa de cama\b(?! > (?:edredons|cobre leito))|mlb-bed_sheets|mlb-mattress_covers/,
          titulo: /^(?:jogo de cama|lencol|lencois|protetor de colchao|fronhas?)\b/,
        }),
        n("travesseiros", "Travesseiros", { ml: /mlb-pillows/, titulo: /^travesseiros?\b/ }),
        n("cobertores-e-edredons", "Cobertores e edredons", {
          ml: /mlb-comforters|mlb-quilts_and_coverlets|mlb-blankets/,
          titulo: /^(?:cobertor|edredom|manta|colcha|cobre leito)\b/,
          nao: /liquida|impermeabiliz|asfaltica/,
        }),
        n("toalhas", "Toalhas", {
          ml: /mlb-bath_towels|mlb-facial_towels|mlb-tablecloths|mlb-kitchen_towels|mlb-placemats/,
          titulo: /^(?:toalhas?|jogo de toalhas|panos? de prato|toalha de mesa|jogo americano)\b/,
          nao: /papel|umedecid/,
        }),
        n("tapetes", "Tapetes", {
          ml: /mlb-decorative_carpets|mlb-toilet_rugs/,
          titulo: /^tapetes?\b/,
          nao: /\b(?:yoga|carro|automotiv|mouse)\b/,
        }),
        n("almofadas-e-capas", "Almofadas e capas", {
          ml: /mlb-cushions|capas de sofa|capas para cadeira/,
          titulo: /^(?:almofadas?|capa (?:de|para) (?:sofa|almofada|cadeira))\b/,
        }),
      ],
    ),
    n(
      "banheiro",
      "Banheiro",
      { ml: /casa, moveis e decoracao > banheiros|construcao > mobiliario para banheiros/ },
      [
        n("chuveiros", "Chuveiros e duchas", {
          ml: /mlb-electric_shower_heads|mlb-shower_heads/,
          titulo: /^(?:chuveiro|ducha)\b/,
          nao: /^(?:resistencia|refil)/,
        }),
        n("torneiras", "Torneiras e misturadores", {
          ml: /mlb-bathroom_faucets|mlb-kitchen_faucets|mlb-electric_faucets/,
          titulo: /^torneira\b/,
        }),
        n("acessorios-de-banheiro", "Acessórios de banheiro", {
          ml: /banheiros > acessorios para banhos|banheiros > (?:varoes|espelhos|sifoes|geradores)|acessorios para banheiros|sets de sanitarios/,
        }),
      ],
    ),
    n(
      "organizacao",
      "Organização",
      { ml: /organizacao para casa|mlb-storage_boxes|mlb-laundry_baskets/ },
      [
        n("caixas-organizadoras", "Caixas e cestos organizadores", {
          ml: /mlb-storage_boxes|mlb-laundry_baskets|mlb-decorative_baskets/,
          titulo: /^(?:caixas? organizadoras?|cesto|cesta organizadora)\b/,
        }),
        n("organizadores-de-armario", "Organizadores de armário e roupas", {
          ml: /organizadores de roupa|mlb-clothes_wardrobe|mlb-hanging_closet|mlb-hangers/,
          titulo: /^(?:organizador(?:es)? de (?:armario|gaveta|roupas?)|cabides?|colmeia)\b/,
        }),
        n("sapateiras", "Sapateiras e araras", {
          ml: /mlb-shoe_racks|mlb-clothes_racks/,
          titulo: /^(?:sapateira|arara)\b/,
        }),
      ],
    ),
    n("decoracao", "Decoração", { ml: /enfeites e decoracao da casa/ }, [
      n("quadros", "Quadros e painéis", {
        ml: /mlb-decorative_paintings|mlb-decorative_panels|quadros, letreiros/,
        titulo: /^(?:quadros?|kit quadros|painel decorativo)\b/,
        nao: /espelho/,
      }),
      n("espelhos", "Espelhos", {
        ml: /mlb-mirrors/,
        titulo: /^espelhos?\b/,
        nao: /maquiagem|retrovisor|carro/,
      }),
      n("cortinas", "Cortinas e persianas", {
        ml: /cortinas e acessorios|mlb-shower_curtains|mlb-curtain_rods|mlb-curtain_hooks/,
        titulo: /^(?:cortinas?|persianas?|varao)\b/,
      }),
      n("vasos-e-plantas", "Vasos e plantas artificiais", {
        ml: /mlb-decorative_and_flower_vases|plantas e flores artificiais/,
        titulo: /^(?:vasos?|plantas? artificia|flores? artificia|cachepot)\b/,
      }),
      n("natal", "Natal", {
        ml: /arvores e enfeites de natal/,
        titulo: /\bnatal(?:ina|ino)?\b|^pisca[- ]pisca\b/,
      }),
      n("objetos-decorativos", "Objetos decorativos", { ml: /enfeites e decoracao da casa/ }),
    ]),
    n("iluminacao", "Iluminação", { ml: /iluminacao residencial/ }, [
      n("lampadas", "Lâmpadas", {
        ml: /mlb-light_bulbs/,
        titulo: /^(?:kit \d+ )?lampadas?\b/,
        nao: /inteligente|smart|wi-?fi/,
      }),
      n("luminarias", "Luminárias e lustres", {
        ml: /iluminacao residencial > luminarias|mlb-table_and_desk_lamps|mlb-floor_ceiling_and_wall_lights/,
        titulo: /^(?:luminaria|lustre|abajur|arandela|plafon|pendente)\b/,
      }),
      n("fitas-de-led", "Fitas de LED", { ml: /mlb-led_strips/, titulo: /^fitas? (?:de )?led\b/ }),
      n("refletores", "Refletores", { ml: /mlb-flood_lights/, titulo: /^refletor(?:es)?\b/ }),
      n("luzes-decorativas", "Luzes decorativas", {
        ml: /guirlandas e luzes decorativas|mlb-christmas_and_decorative_strings_lights/,
      }),
    ]),
    n("limpeza-domestica", "Limpeza e lavanderia", { ml: /cuidado da casa e lavanderia/ }, [
      n("produtos-de-limpeza", "Produtos de limpeza", {
        ml: /cuidado da casa e lavanderia > produtos de limpeza/,
        titulo: /^(?:detergente|desinfetante|agua sanitaria|limpador|multiuso|alvejante|limpa)\b/,
        nao: /lava roupas|roupas|facial|rosto|pele\b/,
      }),
      n("lavanderia-produtos", "Sabão, amaciante e tira-manchas", {
        ml: /produtos de lavanderia/,
        titulo:
          /^(?:sabao|lava roupas|amaciante|tira manchas|alvejante|percarbonato)\b|\blava roupas\b/,
      }),
      n("panos-e-esponjas", "Panos, esponjas e escovas", {
        ml: /mlb-cleaning_cloths|mlb-cleaning_sponges|mlb-home_cleaning_brushes/,
        titulo: /^(?:panos?|esponjas?|escovas? de limpeza|flanelas?)\b/,
        nao: /prato|cozinha/,
      }),
      n("vassouras-e-rodos", "Vassouras, rodos e mops", {
        ml: /mlb-brooms|mlb-mops|mlb-squeegees|mlb-broom_holders|mlb-plungers/,
        titulo: /^(?:vassoura|rodo|mop|esfregao|desentupidor)\b/,
      }),
      n("lixeiras", "Lixeiras", { ml: /mlb-waste_baskets/, titulo: /^lixeiras?\b/ }),
      n("descartaveis", "Papel higiênico e descartáveis", {
        ml: /cuidado da casa e lavanderia > descartaveis/,
        titulo: /^papel (?:higienico|toalha)\b/,
      }),
    ]),
    n(
      "jardim-e-piscina",
      "Jardim, piscina e churrasco",
      { ml: /casa, moveis e decoracao > jardim e ar livre/ },
      [
        n("piscinas", "Piscinas e acessórios", {
          ml: /piscinas e acessorios/,
          titulo: /^piscina\b/,
        }),
        n("churrasqueiras", "Churrasqueiras e acessórios", {
          ml: /churrasqueiras e acessorios/,
          titulo: /^churrasqueira\b/,
        }),
        n("mangueiras-e-irrigacao", "Mangueiras e irrigação", {
          ml: /> irrigacao/,
          titulo: /^mangueira\b.*\bjardim\b/,
        }),
        n("jardinagem", "Jardinagem e controle de pragas", {
          ml: /jardinagem e accesorios|controle de pragas|estufas e barracas|\| agro\b/,
        }),
        n("moveis-de-area-externa", "Redes, cadeiras de praia e gazebos", {
          ml: /moveis para jardim/,
        }),
        n("decoracao-externa", "Decoração externa", {
          ml: /decoracao de exterior|toldos e recintos|ralos e grelhas/,
        }),
      ],
    ),
    n("seguranca-residencial", "Segurança residencial", {
      ml: /seguranca para casa|mlb-surveillance_cameras/,
      titulo:
        /^(?:camera|cameras?) (?:de )?seguranca\b|^(?:camera ip|fechadura (?:digital|eletronica)|olho magico|porteiro)\b/,
    }),
    n("festas", "Festas e lembrancinhas", { ml: /\| festas e lembrancinhas/ }),
  ]),

  /* ───────────────────────── 5. MÓVEIS ───────────────────────── */
  n(
    "moveis",
    "Móveis",
    { ml: /casa, moveis e decoracao > moveis para casa|mlb-office_chairs/, legado: "casa" },
    [
      n("sofas-e-poltronas", "Sofás e poltronas", {
        ml: /mlb-sofas_futons_and_armchairs/,
        titulo: /^(?:sofa|poltrona|puff|recamier)\b/,
      }),
      n("camas-e-colchoes", "Camas, colchões e cabeceiras", {
        ml: /camas, bases e cabeceiras|mlb-mattresses|mlb-beds\b|mlb-headboards/,
        titulo: /^(?:cama|colchao|cabeceira|box)\b(?! elastica)/,
        nao: /pet|cachorro|gato|bebe|boneca/,
      }),
      n("guarda-roupas", "Guarda-roupas e cômodas", {
        ml: /mlb-wardrobes|mlb-drawers_and_storage_drawers|moveis de armazenamento > (?:guarda roupas|comodas)/,
        titulo: /^(?:guarda[- ]roupas?|comoda|roupeiro)\b/,
      }),
      n("mesas", "Mesas e conjuntos de jantar", {
        ml: /mlb-dining_and_kitchen_tables|mlb-dining_kits|salas de jantar/,
        titulo:
          /^(?:mesa|conjunto de jantar)\b(?! (?:digitalizadora|de som|para notebook|de bilhar))/,
        nao: /manicure|digitalizadora|notebook|ping|bilhar/,
      }),
      n("cadeiras", "Cadeiras e banquetas", {
        ml: /mlb-dining_chairs|mlb-stools_and_benches/,
        titulo: /^(?:cadeiras?|banquetas?|banco)\b/,
        nao: /gamer|escritorio|praia|bebe|carro|alimentacao|cabeleireiro/,
      }),
      n("escrivaninhas", "Escrivaninhas", {
        ml: /mlb-desks/,
        titulo: /^(?:escrivaninha|mesa (?:de |para )?(?:escritorio|computador|estudo))\b/,
      }),
      n("estantes", "Estantes e prateleiras", {
        ml: /estantes e prateleiras|mlb-shelves|mlb-wall_brackets/,
        titulo: /^(?:estante|prateleira|nicho)\b/,
      }),
      n("racks-e-paineis", "Racks e painéis", {
        ml: /mlb-tv_racks|mlb-tv_panels/,
        titulo: /^(?:rack|painel)\b.*\btv\b/,
      }),
      n("moveis-de-escritorio", "Móveis de escritório", {
        ml: /mlb-office_chairs|armarios para escritorio|mlb-home_and_office_footrests/,
        titulo:
          /^cadeira\b.*\b(?:escritorio|ergonomica|presidente|diretor)\b|^apoio (?:de|para) pes\b/,
        nao: /gamer/,
      }),
      n("moveis-de-cozinha", "Móveis de cozinha", {
        ml: /mobiliario de cozinha > moveis|mlb-kitchen_cabinets|mlb-sideboards/,
      }),
      n("moveis-de-jardim", "Móveis de jardim", { ml: /mlb-garden_chairs|mlb-garden_furniture/ }),
      n("pecas-de-moveis", "Peças e rodízios para móveis", {
        ml: /moveis para casa > acessorios e pecas/,
      }),
    ],
  ),

  /* ───────────────────────── 6. MODA ───────────────────────── */
  n(
    "moda",
    "Moda e acessórios",
    {
      ml: /^[^|]*\| (?:calcados, roupas e bolsas|joias e relogios)\b/,
      legado: "moda",
      filtros: ["genero"],
    },
    [
      n("moda-feminina", "Moda feminina", {}, [
        n("blusas-femininas", "Blusas e camisetas femininas", {
          titulo: /^(?:blusas?|camisetas?|regatas?|cropped|body)\b.*\bfeminin/,
        }),
        n("vestidos", "Vestidos", { ml: /mlb-dresses/, titulo: /^vestidos?\b/ }),
        n("calcas-femininas", "Calças e saias", {
          titulo: /^(?:calcas?|saias?|shorts?|leggings?)\b.*\bfeminin|^(?:saia|legging)\b/,
        }),
        n("jaquetas-femininas", "Jaquetas e casacos femininos", {
          titulo: /^(?:jaqueta|casaco|blazer|moletom|cardigan)\b.*\bfeminin/,
        }),
        n("moda-intima-feminina", "Moda íntima e pijamas", {
          ml: /moda intima e lingerie/,
          titulo: /^(?:calcinha|sutia|lingerie|pijama|camisola|kit calcinhas?)\b/,
        }),
        n("moda-praia-feminina", "Moda praia feminina", {
          titulo: /^(?:biquini|maio|saida de praia)\b/,
        }),
      ]),
      n("moda-masculina", "Moda masculina", {}, [
        n("camisetas-masculinas", "Camisetas e polos", {
          titulo: /^(?:camisetas?|polo|regata)\b.*\bmasculin/,
        }),
        n("camisas-masculinas", "Camisas", { titulo: /^camisas?\b.*\bmasculin|^camisa social\b/ }),
        n("calcas-masculinas", "Calças e bermudas", {
          titulo: /^(?:calcas?|bermudas?|shorts?)\b.*\bmasculin|^bermuda\b/,
        }),
        n("jaquetas-masculinas", "Jaquetas e moletons", {
          titulo: /^(?:jaqueta|casaco|moletom|blusa de frio)\b.*\bmasculin/,
        }),
        n("moda-intima-masculina", "Cuecas e meias", {
          titulo: /^(?:cuecas?|kit cuecas?|meias?|kit meias?)\b/,
        }),
        n("moda-praia-masculina", "Moda praia masculina", {
          titulo: /^(?:sunga|short de praia|bermuda (?:de )?praia)\b/,
        }),
      ]),
      n("moda-infantil", "Moda infantil", {
        ml: /uniformes escolares/,
        titulo:
          /^(?:conjunto|camiseta|vestido|pijama|body|macacao|roupa)\b.*\b(?:infantil|menino|menina|bebe|juvenil)\b/,
      }),
      n("roupas-geral", "Roupas e agasalhos", {
        ml: /calcados, roupas e bolsas > (?:agasalhos|moda fitness|moda praia|kits de conjuntos)/,
      }),
      n("calcados", "Calçados", { ml: /calcados, roupas e bolsas > calcados/ }, [
        n("tenis", "Tênis", {
          ml: /> calcados > tenis/,
          titulo: /^tenis\b/,
          nao: /mesa|ping|^(?:meia|palmilha|cadarco)/,
        }),
        n("sapatos", "Sapatos", {
          ml: /sapatos sociais/,
          titulo: /^(?:sapatos?|mocassim|sapatenis|scarpin|oxford)\b/,
        }),
        n("sandalias", "Sandálias", { titulo: /^(?:sandalias?|rasteirinha|papete|tamanco)\b/ }),
        n("chinelos", "Chinelos", { titulo: /^(?:chinelos?|havaianas|slide|crocs|babuche)\b/ }),
        n("botas", "Botas", {
          ml: /> calcados > botas/,
          titulo: /^(?:botas?|coturno|botina)\b/,
          nao: /seguranca|epi|bico de aco/,
        }),
      ]),
      n(
        "acessorios-de-moda",
        "Acessórios",
        {
          ml: /calcados, roupas e bolsas > (?:acessorios de moda|malas e bolsas|indumentaria laboral)|\| joias e relogios/,
        },
        [
          n("bolsas", "Bolsas e necessaires", {
            ml: /malas e bolsas > (?:bolsas|necessaires|pochetes)/,
            titulo: /^(?:bolsas?|necessaire|pochete|clutch)\b/,
            nao: /termica|ferramenta|notebook|bebe|maternidade|agua quente/,
          }),
          n("mochilas", "Mochilas", {
            ml: /malas e bolsas > (?:mochilas|kits de mochilas)|mochilas porta notebooks/,
            titulo: /^(?:kit )?mochilas?\b/,
          }),
          n("malas", "Malas de viagem", {
            ml: /bagagem e acessorios de viagem/,
            titulo: /^(?:kit )?malas?\b/,
          }),
          n("carteiras", "Carteiras", {
            ml: /carteiras e porta-moedas/,
            titulo: /^(?:carteiras?|porta[- ]cartoes)\b/,
            nao: /escolar|mesa/,
          }),
          n("relogios", "Relógios", {
            ml: /joias e relogios > relogios/,
            titulo: /^relogios?\b/,
            nao: /inteligente|smart|parede|despertador|ponto/,
          }),
          n("oculos", "Óculos", {
            ml: /acessorios de moda > oculos/,
            titulo: /^oculos\b/,
            nao: /protecao|seguranca|natacao|vr|realidade|3d|grau/,
          }),
          n("bones-e-chapeus", "Bonés e chapéus", {
            ml: /bones, chapeus|moda fitness > bones/,
            titulo: /^(?:bones?|chapeus?|boinas?|viseira)\b/,
          }),
          n("cintos", "Cintos", {
            ml: /acessorios de moda > cintos/,
            titulo: /^cintos?\b/,
            nao: /seguranca|carro|pet/,
          }),
          n("bijuterias", "Joias e bijuterias", {
            ml: /joias e bijuterias|mlb-necklaces|mlb-earrings|mlb-rings/,
            titulo: /^(?:colar|brincos?|aneis?|anel|pulseira|corrente|pingente)\b/,
          }),
          n("outros-acessorios-moda", "Outros acessórios", { ml: /acessorios de moda/ }),
        ],
      ),
    ],
  ),

  /* ───────────────────────── 7. BELEZA ───────────────────────── */
  n(
    "beleza",
    "Beleza e cuidados pessoais",
    { ml: /^[^|]*\| beleza e cuidado pessoal\b/, legado: "beleza" },
    [
      n("perfumes", "Perfumes", {
        ml: /beleza e cuidado pessoal > perfumes/,
        titulo: /^(?:kit )?(?:perfumes?|colonias?|body splash|eau de)\b/,
        nao: /ambiente|carro|pet|cachorro/,
      }),
      n("maquiagem", "Maquiagem", {
        ml: /beleza e cuidado pessoal > maquiagem/,
        titulo:
          /^(?:batom|base|corretivo|rimel|mascara para cilios|mascara de cilios|delineador|po compacto|blush|paleta|gloss|primer|iluminador)\b/,
      }),
      n("cuidados-faciais", "Cuidados faciais", {
        ml: /cuidados com a pele > (?:cuidado facial|limpeza facial|mascaras faciais|kits de cuidado|protetores labiais)|tratamentos de beleza/,
        titulo:
          /^(?:serum|hidratante facial|sabonete facial|tonico|agua micelar|demaquilante|creme (?:facial|anti))\b/,
      }),
      n("cuidados-corporais", "Cuidados corporais", {
        ml: /cuidados com a pele > (?:cuidado do corpo|repelentes)|tratamentos para maos e pes/,
        titulo: /^(?:hidratante|creme|oleo|locao)\b.*\b(?:corporal|corpo|maos|pes)\b/,
      }),
      n("protetores-solares", "Protetores solares", {
        ml: /protecao solar/,
        titulo: /^(?:protetor|bloqueador) solar\b/,
      }),
      n("cabelos", "Cabelos", { ml: /cuidados com o cabelo|artigos para cabeleireiros/ }, [
        n("shampoos", "Shampoos e condicionadores", {
          ml: /shampoos e condicionadores/,
          titulo: /^(?:kit )?(?:shampoo|condicionador)\b/,
          nao: /carro|automotiv|pet|cachorro|gato|bebe/,
        }),
        n("mascaras-capilares", "Máscaras e tratamentos capilares", {
          ml: /tratamentos com o cabelo|cremes de pentear|fixadores para o cabelo/,
          titulo:
            /^(?:mascara|creme|oleo|ampola|leave[- ]in|finalizador|reparador)\b.*\b(?:capilar|cabelos?|cachos|hidratacao)\b/,
        }),
        n("coloracao", "Coloração", {
          ml: /cuidados com o cabelo > coloracao/,
          titulo: /^(?:coloracao|tintura|descolorante|po descolorante)\b/,
        }),
        n("apliques-e-acessorios-cabeleireiro", "Apliques e itens de cabeleireiro", {
          ml: /artigos para cabeleireiros/,
        }),
      ]),
      n("secadores", "Secadores de cabelo", {
        ml: /secadores de cabelo|mlb-hair_dryers/,
        titulo: /^secador (?:de |para )?cabelo\b|^secador\b/,
        nao: /unha|roupa/,
      }),
      n("chapinhas-e-escovas", "Chapinhas e escovas elétricas", {
        ml: /pranchas de cabelo|escovas eletricas|modeladores de cachos/,
        titulo:
          /^(?:chapinha|prancha|escova (?:rotativa|secadora|alisadora|eletrica)|modelador|babyliss)\b/,
        nao: /dente|dental/,
      }),
      n("maquinas-de-cortar-cabelo", "Máquinas de cortar cabelo", {
        ml: /maquinas de cortar cabelo|> trimmers/,
        titulo:
          /^(?:maquina (?:de )?(?:cortar cabelo|acabamento|corte)|aparador de pelos|trimmer)\b/,
      }),
      n("barbeadores", "Barbeadores e barbearia", {
        ml: /> barbearia|laminas de barbear/,
        titulo:
          /^(?:barbeador|aparelho de barbear|laminas? de barbear|pos[- ]barba|balm|oleo para barba)\b/,
      }),
      n("unhas", "Unhas e manicure", {
        ml: /manicure e pedicure/,
        titulo:
          /^(?:esmaltes?|kit esmaltes|alicate de unha|unhas postica|gel para unha|cabine led)\b/,
      }),
      n("higiene-pessoal", "Higiene pessoal", {
        ml: /beleza e cuidado pessoal > higiene pessoal/,
        titulo:
          /^(?:desodorante|antitranspirante|sabonete|creme dental|escova (?:de )?dentes|fio dental|enxaguante|absorvente)\b/,
      }),
    ],
  ),

  /* ───────────────────────── 8. SAÚDE ───────────────────────── */
  n("saude", "Saúde e bem-estar", { ml: /^[^|]*\| saude\b/ }, [
    n("medidores-de-pressao", "Medidores de pressão", {
      ml: /mlb-blood_pressure_monitors/,
      titulo: /^(?:medidor|aparelho|monitor) de pressao\b/,
    }),
    n("termometros", "Termômetros", {
      ml: /mlb-medical_thermometers/,
      titulo: /^termometro\b.*\b(?:digital|clinico|infravermelho|testa|corporal)\b/,
      nao: /ambiente|cozinha|culinario/,
    }),
    n("oximetros", "Oxímetros", { ml: /mlb-pulse_oximeters|> oximetros/, titulo: /^oximetro\b/ }),
    n("ortopedicos", "Produtos ortopédicos", {
      ml: /saude > ortopedia/,
      titulo:
        /^(?:palmilha|joelheira|tornozeleira|munhequeira|colar cervical|cinta)\b.*\b(?:ortopedic|postural)\b/,
    }),
    n("massageadores", "Massageadores", {
      ml: /mlb-massagers/,
      titulo: /^(?:massageador|pistola de massagem)\b/,
    }),
    n("cuidados-de-saude", "Higiene e cuidados", {
      ml: /saude > cuidado da saude|equipamento medico|terapias alternativas/,
    }),
    n("suplementos", "Suplementos", {
      ml: /suplementos alimentares/,
      titulo: /^(?:whey|creatina|suplemento|colageno|vitamina)\b/,
    }),
    n("primeiros-socorros", "Primeiros socorros", {
      ml: /kits de primeiros socorros|> curativos/,
      titulo: /^(?:kit )?primeiros socorros\b/,
    }),
  ]),

  /* ───────────────────────── 9. PET ───────────────────────── */
  n("pet", "Pet shop", { ml: /^[^|]*\| pet shop\b/ }, [
    n("caes", "Cães", { ml: /pet shop > caes/, titulo: /\b(?:caes|cachorros?|dog)\b/ }),
    n("gatos", "Gatos", { ml: /pet shop > gatos/, titulo: /\b(?:gatos?|felinos?|cat)\b/ }),
    n("outros-animais", "Outros animais", { ml: /pet shop > (?:aves|peixes|roedores|repteis)/ }),
  ]),

  /* ───────────────────────── 10. ESPORTES ───────────────────────── */
  n("esportes", "Esportes e lazer", { ml: /^[^|]*\| esportes e fitness\b/ }, [
    n("musculacao-e-fitness", "Musculação e fitness", {
      ml: /esportes e fitness > (?:fitness|musculacao|monitores esportivos)/,
      titulo:
        /^(?:halter|anilha|kettlebell|caneleira|elastico|faixa elastica|tapete de yoga|corda de pular)\b/,
    }),
    n("bicicletas-e-ciclismo", "Bicicletas e ciclismo", {
      ml: /esportes e fitness > ciclismo/,
      titulo: /^bicicleta\b(?!.*\b(?:infantil|aro 1[0-6])\b)/,
    }),
    n("camping-e-trilhas", "Camping e trilhas", {
      ml: /camping, caca e pesca|rapel, montanhismo/,
      titulo: /^(?:barraca|saco de dormir|lanterna|fogareiro|garrafa termica|cooler termico)\b/,
    }),
    n("futebol", "Futebol", {
      ml: /esportes e fitness > futebol/,
      titulo: /^(?:bola de futebol|chuteira|camisa de time)\b/,
    }),
    n("natacao", "Natação e praia", {
      ml: /natacao|canoas, caiaques/,
      titulo: /^(?:oculos de natacao|touca de natacao|boia)\b/,
    }),
    n("acessorios-esportivos", "Outros esportes", { ml: /\| esportes e fitness/ }),
  ]),

  /* ───────────────────────── 11. FERRAMENTAS ───────────────────────── */
  n(
    "ferramentas",
    "Ferramentas e construção",
    {
      ml: /^[^|]*\| (?:ferramentas|construcao|industria e comercio)\b/,
      legado: "ferramentas",
      filtros: ["voltagem"],
    },
    [
      n("furadeiras-e-parafusadeiras", "Furadeiras e parafusadeiras", {
        ml: /ferramentas eletricas > perfuracao|mlb-drills|mlb-screwdrivers/,
        titulo: /^(?:kit )?(?:furadeira|parafusadeira|martelete)\b/,
        nao: /^(?:broca|bateria|carregador|mandril|ponta)/,
      }),
      n("serras", "Serras", {
        ml: /ferramentas eletricas > corte > serras|mlb-chainsaws|motosserra/,
        titulo: /^(?:serra|serrote|motosserra|tico[- ]tico)\b/,
        nao: /^(?:disco|lamina|corrente|sabre)/,
      }),
      n("esmerilhadeiras", "Esmerilhadeiras, lixadeiras e politrizes", {
        ml: /esmerilhadeiras|lixado, desbaste e polimento/,
        titulo: /^(?:esmerilhadeira|lixadeira|politriz|micro retifica|retifica)\b/,
        nao: /unha/,
      }),
      n("ferramentas-manuais", "Ferramentas manuais e kits", {
        ml: /ferramentas > (?:ferramentas manuais|caixas e organizadores)|ferramentas para veiculos > (?:chaves|soquetes)/,
        titulo:
          /^(?:kit|jogo|maleta) (?:de )?(?:ferramentas|chaves|soquetes)\b|^(?:alicate|martelo|chave (?:de fenda|philips|inglesa|combinada|allen))\b/,
      }),
      n("medicao", "Equipamentos de medição", {
        ml: /medicoes e instrumentacao/,
        titulo:
          /^(?:trena|nivel (?:a )?laser|multimetro|paquimetro|alicate amperimetro|medidor|manometro|higrometro|termometro infravermelho)\b/,
      }),
      n("solda", "Solda", {
        ml: /> soldagem|> soldado/,
        titulo: /^(?:maquina de solda|inversora de solda|mascara de solda|ferro de solda)\b/,
      }),
      n("ferramentas-de-jardim", "Ferramentas de jardim", {
        ml: /ferramentas > ferramentas para jardim/,
        titulo:
          /^(?:rocadeira|aparador de grama|cortador de grama|soprador|pulverizador|tesoura de poda|perfurador de solo)\b/,
      }),
      n("acessorios-de-ferramentas", "Brocas, discos e acessórios", {
        ml: /acessorios para ferramentas|ferramentas pneumaticas/,
      }),
      n("ferramentas-eletricas", "Outras ferramentas elétricas", {
        ml: /ferramentas > ferramentas eletricas|ferramentas industriais/,
      }),
      n("materiais-eletricos", "Materiais elétricos", {
        ml: /construcao > energia|mlb-electronic_switches/,
        titulo:
          /^(?:tomada|interruptor|disjuntor|fio flexivel|cabo flexivel|conector wago|fita isolante|extensao eletrica|filtro de linha)\b/,
        nao: /inteligente|smart|wi-?fi/,
      }),
      n("materiais-hidraulicos", "Materiais hidráulicos", {
        ml: /construcao > encanamento/,
        titulo: /^(?:registro|sifao|valvula|bomba (?:d'?agua|pressurizadora))\b/,
      }),
      n("pintura", "Pintura", {
        ml: /loja das tintas|pistolas de pintura/,
        titulo: /^(?:tinta|rolo de pintura|pincel|pistola de pintura|massa corrida)\b/,
        nao: /cabelo|impressora|tecido/,
      }),
      n("materiais-de-obra", "Materiais de obra e acabamento", {
        ml: /construcao > (?:materiais de obra|pisos e rejuntes)/,
      }),
      n("epi", "Equipamentos de proteção", {
        ml: /seguranca laboral > protecao pessoal|mlb-safety_gloves|mlb-safety_glasses/,
        titulo:
          /^(?:luvas?|oculos|protetor auricular|abafador|mascara pff\d?|capacete|botina|bota)\b.*\b(?:seguranca|protecao|epi|pff|nitrilica|vaqueta|bico)\b/,
        nao: /\bde sol\b/,
      }),
      n("sinalizacao-e-seguranca", "Sinalização e segurança do trabalho", {
        ml: /industria e comercio > seguranca laboral/,
      }),
      n("ferragens", "Ferragens e fixação", {
        ml: /mlb-hardware_nuts|mlb-screws|mlb-wall_plugs|fixacoes/,
      }),
      n("comercio-e-industria", "Equipamentos para comércio", {
        ml: /industria e comercio > (?:equipamento para comercios|embalagem|gastronomia|publicidade)/,
      }),
    ],
  ),

  /* ───────────────────────── 12. AUTOMOTIVO ───────────────────────── */
  n(
    "automotivo",
    "Automotivo",
    { ml: /^[^|]*\| acessorios para veiculos\b/, legado: "automotivo" },
    [
      n("pneus", "Pneus", {
        ml: /pneus e acessorios|mlb-tires/,
        titulo: /^pneus?\b/,
        nao: /bicicleta|bike|carrinho de mao/,
      }),
      n("rodas", "Rodas", {
        ml: /acessorios para veiculos > rodas/,
        titulo: /^(?:jogo de )?rodas?\b(?!.*\b(?:carrinho|movel|cadeira)\b)/,
      }),
      n("baterias-automotivas", "Baterias", {
        ml: /mlb-automotive_batteries|pecas de motos e quadriciclos > baterias/,
        titulo: /^bateria\b.*\b(?:carro|moto|automotiva|ah)\b/,
      }),
      n("oleos-e-lubrificantes", "Óleos e lubrificantes", {
        ml: /lubrificantes e fluidos/,
        titulo: /^(?:oleo|aditivo|fluido de freio)\b.*\b(?:motor|5w|10w|15w|20w|carro|moto)\b/,
      }),
      n("pecas-mecanicas", "Peças mecânicas", {
        ml: /pecas de carros|pecas de linha pesada/,
        titulo:
          /^(?:pastilha de freio|disco de freio|amortecedor|filtro de (?:ar|oleo|combustivel)|vela de ignicao|correia)\b/,
      }),
      n("acessorios-internos", "Acessórios internos", {
        ml: /aces\. de carros e caminhonetes > interior/,
        titulo: /^(?:capa de banco|tapete automotivo|organizador de carro|suporte veicular)\b/,
      }),
      n("acessorios-externos", "Acessórios externos", {
        ml: /aces\. de carros e caminhonetes > exterior|> tuning|acessorios de linha pesada/,
        titulo: /^(?:capa (?:para|de) carro|camera de re|insulfilm|envelopamento)\b/,
      }),
      n("som-automotivo", "Som automotivo", {
        ml: /som automotivo/,
        titulo:
          /^(?:som automotivo|radio automotivo|central multimidia|modulo amplificador|alto[- ]falante|subwoofer|transmissor fm|auto[- ]radio)\b/,
      }),
      n("ferramentas-automotivas", "Ferramentas automotivas", {
        ml: /ferramentas para veiculos/,
        titulo:
          /^(?:macaco|chave de roda|compressor de ar|calibrador|scanner automotivo|carregador de bateria)\b/,
      }),
      n("limpeza-automotiva", "Limpeza automotiva", {
        ml: /limpeza automotiva/,
        titulo:
          /^(?:cera|shampoo|limpa|revitalizador|aspirador)\b.*\b(?:automotiv|carro|veicular|pneu)\b/,
      }),
      n("seguranca-veicular", "Segurança veicular", { ml: /seguranca veicular/ }),
      n("motos", "Acessórios para motos", {
        ml: /aces\. de motos e quadriciclos|pecas de motos/,
        titulo:
          /^(?:capacete|bau|intercomunicador|capa de moto|luva de moto|jaqueta motociclista)\b/,
      }),
      n("gps", "GPS e navegação", { ml: /navegadores gps/ }),
    ],
  ),

  /* ───────────────────────── 13. BEBÊS ───────────────────────── */
  n("bebes", "Bebês e maternidade", { ml: /^[^|]*\| bebes\b/, legado: "brinquedos" }, [
    n("fraldas", "Fraldas", {
      ml: /mlb-baby_diapers/,
      titulo: /^(?:fraldas?|kit fraldas)\b/,
      nao: /adulto|geriatric/,
    }),
    n("lencos-umedecidos", "Lenços umedecidos", {
      ml: /toalhas umedecidas/,
      titulo: /^(?:lencos?|toalhas?) umedecid/,
    }),
    n("mamadeiras-e-alimentacao", "Mamadeiras e alimentação", {
      ml: /alimentacao e amamentacao/,
      titulo: /^(?:mamadeira|copo de transicao|prato infantil|babador)\b/,
    }),
    n("chupetas", "Chupetas e mordedores", {
      ml: /chupetas e mordedores/,
      titulo: /^(?:chupeta|mordedor)\b/,
    }),
    n("carrinhos-e-cadeirinhas", "Carrinhos e cadeirinhas", {
      ml: /passeio do bebe|mlb-baby_strollers|mlb-car_seats/,
      titulo:
        /^(?:carrinho de bebe|bebe conforto|cadeirinha (?:para )?(?:auto|carro)|assento de elevacao)\b/,
    }),
    n("quarto-do-bebe", "Berços e quarto do bebê", {
      ml: /quarto do bebe/,
      titulo: /^(?:berco|mini berco|moises|ninho)\b/,
    }),
    n("higiene-infantil", "Higiene infantil", { ml: /higiene e cuidados com o bebe/ }),
    n("roupas-de-bebe", "Roupas para bebês", {
      ml: /roupas de bebe/,
      titulo: /^(?:body|macacao|kit body)\b.*\bbebe\b/,
    }),
    n("maternidade", "Maternidade", {
      ml: /bebes > maternidade/,
      titulo: /^almofada (?:de|para) amamentacao\b/,
    }),
    n("brinquedos-para-bebes", "Brinquedos para bebês", { ml: /bebes > brinquedos para bebes/ }),
  ]),

  /* ───────────────────────── 14. BRINQUEDOS E GAMES ───────────────────────── */
  n(
    "brinquedos",
    "Brinquedos e games",
    { ml: /^[^|]*\| (?:brinquedos e hobbies|games)\b/, legado: "brinquedos" },
    [
      n("games", "Games", { ml: /\| games\b/, legado: "eletronicos" }, [
        n("consoles", "Consoles", {
          ml: /mlb-game_consoles|\| games > consoles/,
          titulo:
            /^(?:console|playstation \d|ps[45]\b|xbox series|nintendo switch|video ?game portatil)\b/,
          nao: ACESSORIO,
        }),
        n("jogos", "Jogos", {
          ml: /mlb-video_games|\| games > video games/,
          titulo: /^jogo\b.*\b(?:ps[345]|playstation|xbox|switch|nintendo)\b/,
        }),
        n("controles-games", "Controles", {
          ml: /mlb-gamepads_and_joysticks|mlb-video_game_steering_wheels/,
          titulo:
            /^(?:controles?|joysticks?|gamepads?|volante)\b.*\b(?:ps[1-5]|playstation|xbox|dualsense|dualshock|nintendo|switch|pc|gamer|bluetooth)\b/,
          nao: /remoto|^capa|^suporte/,
        }),
        n("acessorios-gamer", "Acessórios gamer", {
          ml: /\| games > (?:acessorios para consoles|fliperamas)/,
        }),
      ]),
      n("bonecas-e-bonecos", "Bonecas e bonecos", {
        ml: /bonecos e bonecas/,
        titulo: /^(?:bonecas?|bonecos?|bebe reborn|figura de acao|action figure|barbie|labubu)\b/,
      }),
      n("carrinhos-e-veiculos", "Carrinhos e veículos de brinquedo", {
        ml: /veiculos de brinquedo|mini veiculos e bicicletas/,
        titulo:
          /^(?:carrinhos?|hot wheels|pista|caminhao de brinquedo|carro de controle remoto|moto eletrica infantil|patinete|velotrol|triciclo)\b/,
        nao: /bebe|mercado|feira|de mao|carga/,
      }),
      n("blocos-de-montar", "Blocos de montar", {
        ml: /brinquedos de montar/,
        titulo: /^(?:lego|blocos? de montar)\b/,
      }),
      n("jogos-de-tabuleiro", "Jogos de tabuleiro e cartas", {
        ml: /jogos de tabuleiro e cartas/,
        titulo:
          /^(?:jogo de tabuleiro|quebra[- ]cabecas?|uno|baralho|xadrez|cartas pokemon|box pokemon)\b/,
      }),
      n("jogos-educativos", "Jogos educativos e atividades", {
        ml: /artes e atividades|anti-stress e engenho|cartas educativas/,
        titulo: /^(?:massinha|slime|cubo magico|pop it|squishy|lousa magica|kit (?:de )?pintura)\b/,
      }),
      n("pelucias", "Pelúcias", { ml: /brinquedos e hobbies > pelucias/, titulo: /^pelucias?\b/ }),
      n("hobbies-e-modelismo", "Hobbies, drones e modelismo", {
        ml: /brinquedos e hobbies > (?:hobbies|brinquedos eletronicos)/,
      }),
      n("brinquedos-faz-de-conta", "Faz de conta e ar livre", {
        ml: /brinquedos e hobbies > (?:brinquedos de faz de conta|ar livre e playground|brinquedos de praia|piscinas de bolas|lancadores|brinquedos de pegadinhas|instrumentos musicais|albuns)/,
      }),
    ],
  ),

  /* ───────────────────────── 15. MERCADO ───────────────────────── */
  n("mercado", "Mercado e alimentos", { ml: /^[^|]*\| alimentos e bebidas\b/ }, [
    n("cafe", "Café", {
      ml: /mlb-coffee/,
      titulo: /^(?:cafe|capsulas? de cafe)\b/,
      nao: /cafeteira|maquina/,
    }),
    n("chocolates-e-doces", "Chocolates e doces", {
      ml: /doces e chocolates/,
      titulo: /^(?:chocolate|bombom|caixa de bombons)\b/,
    }),
    n("bebidas", "Bebidas", { ml: /alimentos e bebidas > bebidas/ }),
    n("mercearia", "Mercearia", { ml: /alimentos e bebidas > (?:mercearia|comida preparada)/ }),
  ]),

  /* ───────────────────────── 16. PAPELARIA (catálogo real: 40+) ───────────────────────── */
  n("papelaria", "Papelaria e escritório", { ml: /^[^|]*\| arte, papelaria e armarinho\b/ }, [
    n("papeis", "Papéis para impressão", {
      ml: /papeis para impressao|mlb-school_and_office_papers/,
      titulo: /^(?:papel sulfite|resma|caixa papel)\b/,
    }),
    n("material-escolar", "Material escolar", {
      ml: /materiais escolares > escolar|pintura artistica/,
      titulo: /^(?:caderno|kit escolar|estojo escolar|lapis de cor|canetinha)\b/,
    }),
    n("escritorio", "Escritório e organização", { ml: /comercial e organizacao/ }),
    n("artesanato", "Artesanato e armarinho", {
      ml: /arte e trabalhos manuais|artigos de armarinho/,
    }),
  ]),
];

/* ─────────── Índice ─────────── */

export const NOS: Record<string, NoTaxonomia> = {};
/** Ordem de declaração (desempate na classificação). */
export const ORDEM: string[] = [];

(function indexar(defs: Def[], pai: NoTaxonomia | null) {
  for (const d of defs) {
    if (NOS[d.slug]) throw new Error(`taxonomia: slug repetido ${d.slug}`);
    const no: NoTaxonomia = {
      slug: d.slug,
      nome: d.nome,
      nivel: (pai?.nivel ?? 0) + 1,
      pai: pai?.slug ?? null,
      caminho: [...(pai?.caminho ?? []), d.slug],
      filhos: (d.filhos ?? []).map((f) => f.slug),
      ml: d.ml,
      titulo: d.titulo,
      nao: d.nao,
      legado: d.legado ?? pai?.legado ?? null,
      filtros: [...new Set([...(pai?.filtros ?? []), ...(d.filtros ?? [])])],
    };
    NOS[d.slug] = no;
    ORDEM.push(d.slug);
    if (no.nivel > 4) throw new Error(`taxonomia: ${d.slug} passa de 4 níveis`);
    indexar(d.filhos ?? [], no);
  }
})(ARVORE, null);

export const DEPARTAMENTOS = ARVORE.map((d) => NOS[d.slug]!);

/** O nó e todos os descendentes. */
export function subarvore(slug: string): string[] {
  const no = NOS[slug];
  if (!no) return [];
  return [slug, ...no.filhos.flatMap(subarvore)];
}

export const buscarNo = (slug: string): NoTaxonomia | null => NOS[slug] ?? null;

/* ─────────── Filtros por título ─────────── */

export type Filtro = {
  id: FiltroId;
  nome: string;
  opcoes: Array<{ id: string; rotulo: string; re: RegExp }>;
};

export const FILTROS: Record<FiltroId, Filtro> = {
  armazenamento: {
    id: "armazenamento",
    nome: "Capacidade",
    opcoes: [
      { id: "ate-128", rotulo: "Até 128 GB", re: /\b(?:16|32|64|120|128) ?gb\b/ },
      { id: "240-256", rotulo: "240 a 256 GB", re: /\b(?:240|250|256) ?gb\b/ },
      { id: "480-512", rotulo: "480 a 512 GB", re: /\b(?:480|500|512) ?gb\b/ },
      { id: "1tb", rotulo: "1 TB", re: /\b1 ?tb\b/ },
      { id: "2tb-mais", rotulo: "2 TB ou mais", re: /\b(?:[2-9]|1\d) ?tb\b/ },
    ],
  },
  interface_ssd: {
    id: "interface_ssd",
    nome: "Interface",
    opcoes: [
      { id: "nvme", rotulo: "NVMe M.2", re: /\bnvme\b|\bm\.2\b/ },
      { id: "sata", rotulo: "SATA", re: /\bsata\b/ },
      { id: "usb", rotulo: "USB (externo)", re: /\busb\b|\bexterno\b/ },
    ],
  },
  voltagem: {
    id: "voltagem",
    nome: "Voltagem",
    opcoes: [
      { id: "110", rotulo: "110/127 V", re: /\b(?:110|127) ?v\b/ },
      { id: "220", rotulo: "220 V", re: /\b220 ?v\b/ },
      { id: "bivolt", rotulo: "Bivolt", re: /\bbivolt\b/ },
    ],
  },
  tecnologia_refrigeracao: {
    id: "tecnologia_refrigeracao",
    nome: "Tecnologia",
    opcoes: [
      { id: "frost-free", rotulo: "Frost Free", re: /\bfrost ?free\b/ },
      {
        id: "cycle-defrost",
        rotulo: "Cycle defrost / degelo",
        re: /\bcycle ?defrost\b|\bdegelo\b/,
      },
      { id: "inverter", rotulo: "Inverter", re: /\binverter\b/ },
    ],
  },
  litros: {
    id: "litros",
    nome: "Capacidade",
    opcoes: [
      { id: "ate-100", rotulo: "Até 100 L", re: /\b(?:[1-9]\d?|100) ?(?:l|litros)\b/ },
      { id: "101-300", rotulo: "101 a 300 L", re: /\b(?:1\d\d|2\d\d|300) ?(?:l|litros)\b/ },
      { id: "301-450", rotulo: "301 a 450 L", re: /\b(?:3\d\d|4[0-4]\d|450) ?(?:l|litros)\b/ },
      { id: "451-mais", rotulo: "Mais de 450 L", re: /\b(?:4[5-9]\d|[5-9]\d\d) ?(?:l|litros)\b/ },
    ],
  },
  conexao_fone: {
    id: "conexao_fone",
    nome: "Conexão",
    opcoes: [
      {
        id: "bluetooth",
        rotulo: "Bluetooth / sem fio",
        re: /\bbluetooth\b|\bsem fio\b|\bwireless\b|\btws\b/,
      },
      {
        id: "com-fio",
        rotulo: "Com fio",
        re: /\bcom fio\b|\bp2\b|\b3[.,]5 ?mm\b|\busb\b(?!.*bluetooth)/,
      },
    ],
  },
  cancelamento: {
    id: "cancelamento",
    nome: "Cancelamento de ruído",
    opcoes: [
      {
        id: "anc",
        rotulo: "Com cancelamento de ruído",
        re: /\bcancelamento (?:ativo )?de ruido\b|\banc\b|\bnoise cancel/,
      },
    ],
  },
  formato_fone: {
    id: "formato_fone",
    nome: "Formato",
    opcoes: [
      { id: "intra", rotulo: "Intra-auricular", re: /\bintra|\bin-?ear\b|\bearbuds?\b|\btws\b/ },
      {
        id: "headphone",
        rotulo: "Headphone (sobre a orelha)",
        re: /\bheadphone\b|\bover-?ear\b|\bon-?ear\b|\bsupra\b|\bheadset\b/,
      },
    ],
  },
  polegadas: {
    id: "polegadas",
    nome: "Tamanho da tela",
    opcoes: [
      { id: "ate-32", rotulo: 'Até 32"', re: /\b(?:2[0-9]|3[0-2]) ?(?:"|”|pol|polegadas|'')/ },
      { id: "40-43", rotulo: '40 a 43"', re: /\b(?:4[0-3]) ?(?:"|”|pol|polegadas|'')/ },
      { id: "50-55", rotulo: '50 a 55"', re: /\b(?:5[0-5]) ?(?:"|”|pol|polegadas|'')/ },
      { id: "58-mais", rotulo: '58" ou mais', re: /\b(?:5[89]|[6-9]\d) ?(?:"|”|pol|polegadas|'')/ },
    ],
  },
  memoria_ram: {
    id: "memoria_ram",
    nome: "Memória RAM",
    opcoes: [
      { id: "4gb", rotulo: "4 GB", re: /\b4 ?gb(?: de)? ?(?:ram|ddr)|\b(?:ram|memoria) 4 ?gb\b/ },
      { id: "8gb", rotulo: "8 GB", re: /\b8 ?gb(?: de)? ?(?:ram|ddr)|\b(?:ram|memoria) 8 ?gb\b/ },
      {
        id: "16gb",
        rotulo: "16 GB",
        re: /\b16 ?gb(?: de)? ?(?:ram|ddr)|\b(?:ram|memoria) 16 ?gb\b/,
      },
      {
        id: "32gb",
        rotulo: "32 GB ou mais",
        re: /\b(?:32|64) ?gb(?: de)? ?(?:ram|ddr)|\b(?:ram|memoria) (?:32|64) ?gb\b/,
      },
    ],
  },
  genero: {
    id: "genero",
    nome: "Para quem",
    opcoes: [
      { id: "feminino", rotulo: "Feminino", re: /\bfeminin[oa]s?\b|\bmulher(?:es)?\b/ },
      { id: "masculino", rotulo: "Masculino", re: /\bmasculin[oa]s?\b|\bhomem\b|\bhomens\b/ },
      {
        id: "infantil",
        rotulo: "Infantil",
        re: /\binfantil\b|\bmenin[oa]s?\b|\bkids?\b|\bjuvenil\b/,
      },
      { id: "unissex", rotulo: "Unissex", re: /\bunissex\b/ },
    ],
  },
  portas_rede: {
    id: "portas_rede",
    nome: "Velocidade",
    opcoes: [
      { id: "gigabit", rotulo: "Gigabit", re: /\bgigabit\b|\b1000 ?mbps\b|\b1 ?gbps\b/ },
      {
        id: "wifi6",
        rotulo: "Wi-Fi 6 ou superior",
        re: /\bwi-?fi ?[67]\b|\bax\d{3,4}\b|\bbe\d{3,4}\b/,
      },
      { id: "dual-band", rotulo: "Dual band", re: /\bdual ?band\b|\b5 ?ghz\b/ },
    ],
  },
};
