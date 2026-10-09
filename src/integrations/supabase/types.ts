export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ajuda_escolha: {
        Row: {
          criado_em: string
          pedido_id: number
          resposta: Json
          versao: number
        }
        Insert: {
          criado_em?: string
          pedido_id: number
          resposta: Json
          versao: number
        }
        Update: {
          criado_em?: string
          pedido_id?: number
          resposta?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajuda_escolha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos_link"
            referencedColumns: ["id"]
          },
        ]
      }
      apelidos_ml: {
        Row: {
          apelido: string | null
          seller_id: number
          visto_em: string
        }
        Insert: {
          apelido?: string | null
          seller_id: number
          visto_em?: string
        }
        Update: {
          apelido?: string | null
          seller_id?: number
          visto_em?: string
        }
        Relationships: []
      }
      avaliacoes_indicacao: {
        Row: {
          aplicado: boolean
          chave_original: string | null
          criado_em: string
          id: number
          item: string
          motivo: string | null
          pedido_id: number
          util: boolean
        }
        Insert: {
          aplicado?: boolean
          chave_original?: string | null
          criado_em?: string
          id?: number
          item: string
          motivo?: string | null
          pedido_id: number
          util: boolean
        }
        Update: {
          aplicado?: boolean
          chave_original?: string | null
          criado_em?: string
          id?: number
          item?: string
          motivo?: string | null
          pedido_id?: number
          util?: boolean
        }
        Relationships: []
      }
      busca_guiada: {
        Row: {
          chave: string
          contexto: string | null
          criado_em: string
          enfileirados: number
          id: number
          resposta: Json
        }
        Insert: {
          chave: string
          contexto?: string | null
          criado_em?: string
          enfileirados?: number
          id?: number
          resposta: Json
        }
        Update: {
          chave?: string
          contexto?: string | null
          criado_em?: string
          enfileirados?: number
          id?: number
          resposta?: Json
        }
        Relationships: []
      }
      campanha_artes: {
        Row: {
          bytes: number | null
          gerada_em: string
          modelo: string | null
          tema: string
          url: string
          versao: number
        }
        Insert: {
          bytes?: number | null
          gerada_em?: string
          modelo?: string | null
          tema: string
          url: string
          versao?: number
        }
        Update: {
          bytes?: number | null
          gerada_em?: string
          modelo?: string | null
          tema?: string
          url?: string
          versao?: number
        }
        Relationships: []
      }
      campanha_metricas: {
        Row: {
          atualizado_em: string
          campanha_id: number
          cliques: number
          conversoes: number | null
          dia: string
          impressoes: number
        }
        Insert: {
          atualizado_em?: string
          campanha_id: number
          cliques?: number
          conversoes?: number | null
          dia: string
          impressoes?: number
        }
        Update: {
          atualizado_em?: string
          campanha_id?: number
          cliques?: number
          conversoes?: number | null
          dia?: string
          impressoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "campanha_metricas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanha_produtos: {
        Row: {
          adicionado_em: string
          campanha_id: number
          chave: string
          conferido_em: string
          cupom: string | null
          economia: number
          link: string
          loja: string | null
          loja_oficial: boolean
          lojas: number | null
          mercado_lider: string | null
          ordem: number
          preco: number
          preco_antes: number
          preco_promocional: number | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          adicionado_em?: string
          campanha_id: number
          chave: string
          conferido_em: string
          cupom?: string | null
          economia: number
          link: string
          loja?: string | null
          loja_oficial?: boolean
          lojas?: number | null
          mercado_lider?: string | null
          ordem?: number
          preco: number
          preco_antes: number
          preco_promocional?: number | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          adicionado_em?: string
          campanha_id?: number
          chave?: string
          conferido_em?: string
          cupom?: string | null
          economia?: number
          link?: string
          loja?: string | null
          loja_oficial?: boolean
          lojas?: number | null
          mercado_lider?: string | null
          ordem?: number
          preco?: number
          preco_antes?: number
          preco_promocional?: number | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanha_produtos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          atualizado_em: string
          beneficio_texto: string | null
          categoria_site: string | null
          coletado_em: string
          criado_em: string
          demanda_tipo: string | null
          fonte: string
          id: number
          inicia_em: string
          link_afiliado_campanha: string | null
          nome: string
          regras_resumo: string | null
          revalidar_ate: string | null
          slug: string
          status: string
          tema_visual: string | null
          temporada: string | null
          termina_em: string
          ufs: string[] | null
        }
        Insert: {
          atualizado_em?: string
          beneficio_texto?: string | null
          categoria_site?: string | null
          coletado_em?: string
          criado_em?: string
          demanda_tipo?: string | null
          fonte: string
          id?: number
          inicia_em: string
          link_afiliado_campanha?: string | null
          nome: string
          regras_resumo?: string | null
          revalidar_ate?: string | null
          slug: string
          status?: string
          tema_visual?: string | null
          temporada?: string | null
          termina_em: string
          ufs?: string[] | null
        }
        Update: {
          atualizado_em?: string
          beneficio_texto?: string | null
          categoria_site?: string | null
          coletado_em?: string
          criado_em?: string
          demanda_tipo?: string | null
          fonte?: string
          id?: number
          inicia_em?: string
          link_afiliado_campanha?: string | null
          nome?: string
          regras_resumo?: string | null
          revalidar_ate?: string | null
          slug?: string
          status?: string
          tema_visual?: string | null
          temporada?: string | null
          termina_em?: string
          ufs?: string[] | null
        }
        Relationships: []
      }
      canal_metricas: {
        Row: {
          dia: string
          medido_em: string
          membros: number | null
        }
        Insert: {
          dia: string
          medido_em?: string
          membros?: number | null
        }
        Update: {
          dia?: string
          medido_em?: string
          membros?: number | null
        }
        Relationships: []
      }
      canal_publicacoes: {
        Row: {
          chave: string
          criterios: string | null
          economia_produto: number | null
          facebook_em: string | null
          facebook_erro: string | null
          facebook_post_id: string | null
          id: number
          link: string | null
          message_id: number | null
          pedido_id: number | null
          preco: number | null
          publicado_em: string
          removida_em: string | null
          removida_motivo: string | null
          tipo: string | null
          titulo: string | null
        }
        Insert: {
          chave: string
          criterios?: string | null
          economia_produto?: number | null
          facebook_em?: string | null
          facebook_erro?: string | null
          facebook_post_id?: string | null
          id?: number
          link?: string | null
          message_id?: number | null
          pedido_id?: number | null
          preco?: number | null
          publicado_em?: string
          removida_em?: string | null
          removida_motivo?: string | null
          tipo?: string | null
          titulo?: string | null
        }
        Update: {
          chave?: string
          criterios?: string | null
          economia_produto?: number | null
          facebook_em?: string | null
          facebook_erro?: string | null
          facebook_post_id?: string | null
          id?: number
          link?: string | null
          message_id?: number | null
          pedido_id?: number | null
          preco?: number | null
          publicado_em?: string
          removida_em?: string | null
          removida_motivo?: string | null
          tipo?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      comparacoes: {
        Row: {
          chave: string
          criado_em: string
          resposta: Json
        }
        Insert: {
          chave: string
          criado_em?: string
          resposta: Json
        }
        Update: {
          chave?: string
          criado_em?: string
          resposta?: Json
        }
        Relationships: []
      }
      contatos: {
        Row: {
          ativo: boolean
          canal: string
          valor: string
        }
        Insert: {
          ativo?: boolean
          canal: string
          valor: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          valor?: string
        }
        Relationships: []
      }
      cupons: {
        Row: {
          busca: string | null
          categoria: string | null
          codigo_cupom: string | null
          codigo_em: string | null
          codigo_pedido_em: string | null
          codigo_tentativas: number
          compra_min: number | null
          conferido_em: string | null
          created_at: string
          desconto: string | null
          estoque: number | null
          id: number
          link_afiliado: string | null
          link_conferido_em: string | null
          link_em: string | null
          link_loja: string | null
          link_origem: string | null
          link_tentativas: number
          loja_pedida_em: string | null
          nivel: string | null
          orcamento: number | null
          qualidade: string | null
          sem_teto: boolean
          tentativas: number
          teto: number | null
          tipo: string | null
          updated_at: string
          valor: number | null
          vence: string | null
          vendas: number | null
          vendedor: string
          vitrine_conferida_em: string | null
          vitrine_motivo: string | null
          vitrine_ok: boolean | null
          vitrine_resolvida_em: string | null
        }
        Insert: {
          busca?: string | null
          categoria?: string | null
          codigo_cupom?: string | null
          codigo_em?: string | null
          codigo_pedido_em?: string | null
          codigo_tentativas?: number
          compra_min?: number | null
          conferido_em?: string | null
          created_at?: string
          desconto?: string | null
          estoque?: number | null
          id: number
          link_afiliado?: string | null
          link_conferido_em?: string | null
          link_em?: string | null
          link_loja?: string | null
          link_origem?: string | null
          link_tentativas?: number
          loja_pedida_em?: string | null
          nivel?: string | null
          orcamento?: number | null
          qualidade?: string | null
          sem_teto?: boolean
          tentativas?: number
          teto?: number | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          vence?: string | null
          vendas?: number | null
          vendedor: string
          vitrine_conferida_em?: string | null
          vitrine_motivo?: string | null
          vitrine_ok?: boolean | null
          vitrine_resolvida_em?: string | null
        }
        Update: {
          busca?: string | null
          categoria?: string | null
          codigo_cupom?: string | null
          codigo_em?: string | null
          codigo_pedido_em?: string | null
          codigo_tentativas?: number
          compra_min?: number | null
          conferido_em?: string | null
          created_at?: string
          desconto?: string | null
          estoque?: number | null
          id?: number
          link_afiliado?: string | null
          link_conferido_em?: string | null
          link_em?: string | null
          link_loja?: string | null
          link_origem?: string | null
          link_tentativas?: number
          loja_pedida_em?: string | null
          nivel?: string | null
          orcamento?: number | null
          qualidade?: string | null
          sem_teto?: boolean
          tentativas?: number
          teto?: number | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          vence?: string | null
          vendas?: number | null
          vendedor?: string
          vitrine_conferida_em?: string | null
          vitrine_motivo?: string | null
          vitrine_ok?: boolean | null
          vitrine_resolvida_em?: string | null
        }
        Relationships: []
      }
      curadoria_brinquedos_itens: {
        Row: {
          atualizado_em: string
          busca: string | null
          em_alta: boolean
          enfileirado_em: string | null
          faixa: string | null
          frete_gratis_ref: boolean | null
          idade_texto: string | null
          imagem: string | null
          item: string
          nome: string
          ofertas: number | null
          pedido_id: number | null
          posicao: number | null
          preco_ref: number | null
          produto: string
          url: string
        }
        Insert: {
          atualizado_em?: string
          busca?: string | null
          em_alta?: boolean
          enfileirado_em?: string | null
          faixa?: string | null
          frete_gratis_ref?: boolean | null
          idade_texto?: string | null
          imagem?: string | null
          item: string
          nome: string
          ofertas?: number | null
          pedido_id?: number | null
          posicao?: number | null
          preco_ref?: number | null
          produto: string
          url: string
        }
        Update: {
          atualizado_em?: string
          busca?: string | null
          em_alta?: boolean
          enfileirado_em?: string | null
          faixa?: string | null
          frete_gratis_ref?: boolean | null
          idade_texto?: string | null
          imagem?: string | null
          item?: string
          nome?: string
          ofertas?: number | null
          pedido_id?: number | null
          posicao?: number | null
          preco_ref?: number | null
          produto?: string
          url?: string
        }
        Relationships: []
      }
      diagnosticos: {
        Row: {
          criado_em: string
          dados: Json | null
          id: number
          tipo: string
        }
        Insert: {
          criado_em?: string
          dados?: Json | null
          id?: number
          tipo: string
        }
        Update: {
          criado_em?: string
          dados?: Json | null
          id?: number
          tipo?: string
        }
        Relationships: []
      }
      eventos_site: {
        Row: {
          criado_em: string
          destino: string | null
          id: number
          origem: string | null
          pagina: string | null
          pedido_id: number | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          destino?: string | null
          id?: number
          origem?: string | null
          pagina?: string | null
          pedido_id?: number | null
          tipo: string
        }
        Update: {
          criado_em?: string
          destino?: string | null
          id?: number
          origem?: string | null
          pagina?: string | null
          pedido_id?: number | null
          tipo?: string
        }
        Relationships: []
      }
      geracoes: {
        Row: {
          atualizado_em: string
          chave: string
          criado_em: string
          erro: string | null
          meta: Json | null
          resultado: string | null
          status: string
          tentativas: number
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          criado_em?: string
          erro?: string | null
          meta?: Json | null
          resultado?: string | null
          status: string
          tentativas?: number
          tipo: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          criado_em?: string
          erro?: string | null
          meta?: Json | null
          resultado?: string | null
          status?: string
          tentativas?: number
          tipo?: string
        }
        Relationships: []
      }
      hub_recomendados: {
        Row: {
          avaliacao: number | null
          desconto_pct: number | null
          enfileirado_em: string | null
          imagem: string | null
          item: string
          lido_em: string
          mais_vendido: boolean
          pedido_id: number | null
          posicao: number | null
          preco: number | null
          preco_original: number | null
          titulo: string | null
          url: string
          vendidos: string | null
        }
        Insert: {
          avaliacao?: number | null
          desconto_pct?: number | null
          enfileirado_em?: string | null
          imagem?: string | null
          item: string
          lido_em?: string
          mais_vendido?: boolean
          pedido_id?: number | null
          posicao?: number | null
          preco?: number | null
          preco_original?: number | null
          titulo?: string | null
          url: string
          vendidos?: string | null
        }
        Update: {
          avaliacao?: number | null
          desconto_pct?: number | null
          enfileirado_em?: string | null
          imagem?: string | null
          item?: string
          lido_em?: string
          mais_vendido?: boolean
          pedido_id?: number | null
          posicao?: number | null
          preco?: number | null
          preco_original?: number | null
          titulo?: string | null
          url?: string
          vendidos?: string | null
        }
        Relationships: []
      }
      ia_cotas: {
        Row: {
          ate: string
          modelo: string
        }
        Insert: {
          ate: string
          modelo: string
        }
        Update: {
          ate?: string
          modelo?: string
        }
        Relationships: []
      }
      ia_vereditos: {
        Row: {
          chave_candidato: string
          chave_original: string
          confianca: number
          criado_em: string
          desvantagens: Json | null
          igual: boolean
          mesma_foto: boolean
          modelo: string | null
          motivo: string | null
          parecido: boolean | null
          qualidade: string | null
          qualidade_motivo: string | null
          semelhanca: number | null
        }
        Insert: {
          chave_candidato: string
          chave_original: string
          confianca?: number
          criado_em?: string
          desvantagens?: Json | null
          igual: boolean
          mesma_foto?: boolean
          modelo?: string | null
          motivo?: string | null
          parecido?: boolean | null
          qualidade?: string | null
          qualidade_motivo?: string | null
          semelhanca?: number | null
        }
        Update: {
          chave_candidato?: string
          chave_original?: string
          confianca?: number
          criado_em?: string
          desvantagens?: Json | null
          igual?: boolean
          mesma_foto?: boolean
          modelo?: string | null
          motivo?: string | null
          parecido?: boolean | null
          qualidade?: string | null
          qualidade_motivo?: string | null
          semelhanca?: number | null
        }
        Relationships: []
      }
      limites: {
        Row: {
          chave: string
          valor: number
        }
        Insert: {
          chave: string
          valor: number
        }
        Update: {
          chave?: string
          valor?: number
        }
        Relationships: []
      }
      mercado_sinais: {
        Row: {
          categoria_id: string | null
          categoria_nome: string | null
          coletado_em: string
          extra: Json | null
          fonte: string
          id: number
          posicao: number | null
          produto_id: string | null
          termo: string | null
          url: string | null
        }
        Insert: {
          categoria_id?: string | null
          categoria_nome?: string | null
          coletado_em?: string
          extra?: Json | null
          fonte: string
          id?: number
          posicao?: number | null
          produto_id?: string | null
          termo?: string | null
          url?: string | null
        }
        Update: {
          categoria_id?: string | null
          categoria_nome?: string | null
          coletado_em?: string
          extra?: Json | null
          fonte?: string
          id?: number
          posicao?: number | null
          produto_id?: string | null
          termo?: string | null
          url?: string | null
        }
        Relationships: []
      }
      monitor_precos: {
        Row: {
          ativo: boolean
          chave: string
          criado_em: string
          disponivel: boolean | null
          erro: string | null
          id: number
          imagem: string | null
          leituras: number
          link: string | null
          loja: string | null
          maior_preco: number | null
          menor_em: string | null
          menor_preco: number | null
          parcelas: Json | null
          preco_atual: number | null
          preco_cheio: number | null
          preco_inicial: number | null
          preco_pix: number | null
          proxima_leitura: string
          sem_mudanca: number
          titulo: string | null
          ultima_leitura: string | null
          url: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          criado_em?: string
          disponivel?: boolean | null
          erro?: string | null
          id?: number
          imagem?: string | null
          leituras?: number
          link?: string | null
          loja?: string | null
          maior_preco?: number | null
          menor_em?: string | null
          menor_preco?: number | null
          parcelas?: Json | null
          preco_atual?: number | null
          preco_cheio?: number | null
          preco_inicial?: number | null
          preco_pix?: number | null
          proxima_leitura?: string
          sem_mudanca?: number
          titulo?: string | null
          ultima_leitura?: string | null
          url: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          criado_em?: string
          disponivel?: boolean | null
          erro?: string | null
          id?: number
          imagem?: string | null
          leituras?: number
          link?: string | null
          loja?: string | null
          maior_preco?: number | null
          menor_em?: string | null
          menor_preco?: number | null
          parcelas?: Json | null
          preco_atual?: number | null
          preco_cheio?: number | null
          preco_inicial?: number | null
          preco_pix?: number | null
          proxima_leitura?: string
          sem_mudanca?: number
          titulo?: string | null
          ultima_leitura?: string | null
          url?: string
        }
        Relationships: []
      }
      monitor_seguidores: {
        Row: {
          criado_em: string
          monitor_id: number
          navegador: string
          preco_alvo: number | null
          preco_ao_seguir: number | null
        }
        Insert: {
          criado_em?: string
          monitor_id: number
          navegador: string
          preco_alvo?: number | null
          preco_ao_seguir?: number | null
        }
        Update: {
          criado_em?: string
          monitor_id?: number
          navegador?: string
          preco_alvo?: number | null
          preco_ao_seguir?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monitor_seguidores_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitor_precos"
            referencedColumns: ["id"]
          },
        ]
      }
      monitor_telegram: {
        Row: {
          aviso_em: string | null
          aviso_preco: number | null
          chat_id: number | null
          codigo: string
          criado_em: string
          ligado_em: string | null
          monitor_id: number
          navegador: string
          pendente: boolean
        }
        Insert: {
          aviso_em?: string | null
          aviso_preco?: number | null
          chat_id?: number | null
          codigo: string
          criado_em?: string
          ligado_em?: string | null
          monitor_id: number
          navegador: string
          pendente?: boolean
        }
        Update: {
          aviso_em?: string | null
          aviso_preco?: number | null
          chat_id?: number | null
          codigo?: string
          criado_em?: string
          ligado_em?: string | null
          monitor_id?: number
          navegador?: string
          pendente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "monitor_telegram_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "monitor_precos"
            referencedColumns: ["id"]
          },
        ]
      }
      multiloja_resultados: {
        Row: {
          criado_em: string
          pedido_id: number
          resultado: Json
        }
        Insert: {
          criado_em?: string
          pedido_id: number
          resultado: Json
        }
        Update: {
          criado_em?: string
          pedido_id?: number
          resultado?: Json
        }
        Relationships: []
      }
      operacao_execucoes: {
        Row: {
          erro: string | null
          fim: string | null
          id: number
          inicio: string
          ok: boolean | null
          resumo: Json | null
          tarefa: string
        }
        Insert: {
          erro?: string | null
          fim?: string | null
          id?: number
          inicio?: string
          ok?: boolean | null
          resumo?: Json | null
          tarefa: string
        }
        Update: {
          erro?: string | null
          fim?: string | null
          id?: number
          inicio?: string
          ok?: boolean | null
          resumo?: Json | null
          tarefa?: string
        }
        Relationships: []
      }
      pedidos_link: {
        Row: {
          analise: Json | null
          atendido_em: string | null
          cep_destino: string | null
          chave: string
          codigo: string | null
          criado_em: string
          cupom_id: number | null
          erro: string | null
          id: number
          link: string | null
          origem: string | null
          preco: number | null
          processando_em: string | null
          status: string
          titulo: string | null
          url_alvo: string | null
          vendedor: string
        }
        Insert: {
          analise?: Json | null
          atendido_em?: string | null
          cep_destino?: string | null
          chave?: string
          codigo?: string | null
          criado_em?: string
          cupom_id?: number | null
          erro?: string | null
          id?: number
          link?: string | null
          origem?: string | null
          preco?: number | null
          processando_em?: string | null
          status?: string
          titulo?: string | null
          url_alvo?: string | null
          vendedor: string
        }
        Update: {
          analise?: Json | null
          atendido_em?: string | null
          cep_destino?: string | null
          chave?: string
          codigo?: string | null
          criado_em?: string
          cupom_id?: number | null
          erro?: string | null
          id?: number
          link?: string | null
          origem?: string | null
          preco?: number | null
          processando_em?: string | null
          status?: string
          titulo?: string | null
          url_alvo?: string | null
          vendedor?: string
        }
        Relationships: []
      }
      prazo_entrega_cache: {
        Row: {
          cep: string
          em: string
          item: string
          opcoes: Json
          status: number
        }
        Insert: {
          cep: string
          em?: string
          item: string
          opcoes?: Json
          status: number
        }
        Update: {
          cep?: string
          em?: string
          item?: string
          opcoes?: Json
          status?: number
        }
        Relationships: []
      }
      precos_vistos: {
        Row: {
          chave: string
          id: number
          loja: string | null
          preco: number
          visto_em: string
        }
        Insert: {
          chave: string
          id?: number
          loja?: string | null
          preco: number
          visto_em?: string
        }
        Update: {
          chave?: string
          id?: number
          loja?: string | null
          preco?: number
          visto_em?: string
        }
        Relationships: []
      }
      produtos_vistos: {
        Row: {
          alt_economia: number | null
          alt_frete_gratis: boolean | null
          alt_link: string | null
          alt_loja: string | null
          alt_muda: string | null
          alt_oficial: boolean | null
          alt_preco: number | null
          alt_titulo: string | null
          alt_vantagem: string | null
          categoria: string | null
          chave: string
          economia: number | null
          frete_gratis: boolean | null
          imagem: string | null
          link: string | null
          loja: string | null
          lojas_comparadas: number | null
          lojas_mais_caras: number | null
          melhor_frete_gratis: boolean | null
          melhor_link: string | null
          melhor_loja: string | null
          melhor_preco: number | null
          preco: number | null
          primeiro_em: string
          segunda_loja: string | null
          segunda_preco: number | null
          titulo: string
          url_produto: string | null
          vezes: number
          visto_em: string
        }
        Insert: {
          alt_economia?: number | null
          alt_frete_gratis?: boolean | null
          alt_link?: string | null
          alt_loja?: string | null
          alt_muda?: string | null
          alt_oficial?: boolean | null
          alt_preco?: number | null
          alt_titulo?: string | null
          alt_vantagem?: string | null
          categoria?: string | null
          chave: string
          economia?: number | null
          frete_gratis?: boolean | null
          imagem?: string | null
          link?: string | null
          loja?: string | null
          lojas_comparadas?: number | null
          lojas_mais_caras?: number | null
          melhor_frete_gratis?: boolean | null
          melhor_link?: string | null
          melhor_loja?: string | null
          melhor_preco?: number | null
          preco?: number | null
          primeiro_em?: string
          segunda_loja?: string | null
          segunda_preco?: number | null
          titulo: string
          url_produto?: string | null
          vezes?: number
          visto_em?: string
        }
        Update: {
          alt_economia?: number | null
          alt_frete_gratis?: boolean | null
          alt_link?: string | null
          alt_loja?: string | null
          alt_muda?: string | null
          alt_oficial?: boolean | null
          alt_preco?: number | null
          alt_titulo?: string | null
          alt_vantagem?: string | null
          categoria?: string | null
          chave?: string
          economia?: number | null
          frete_gratis?: boolean | null
          imagem?: string | null
          link?: string | null
          loja?: string | null
          lojas_comparadas?: number | null
          lojas_mais_caras?: number | null
          melhor_frete_gratis?: boolean | null
          melhor_link?: string | null
          melhor_loja?: string | null
          melhor_preco?: number | null
          preco?: number | null
          primeiro_em?: string
          segunda_loja?: string | null
          segunda_preco?: number | null
          titulo?: string
          url_produto?: string | null
          vezes?: number
          visto_em?: string
        }
        Relationships: []
      }
      sinc_config: {
        Row: {
          chave: string
          valor: string
        }
        Insert: {
          chave: string
          valor: string
        }
        Update: {
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      sinc_log: {
        Row: {
          id: number
          novos: number | null
          quando: string
          recebidos: number | null
          sumidos_removidos: number | null
          vencidos_removidos: number | null
        }
        Insert: {
          id?: number
          novos?: number | null
          quando?: string
          recebidos?: number | null
          sumidos_removidos?: number | null
          vencidos_removidos?: number | null
        }
        Update: {
          id?: number
          novos?: number | null
          quando?: string
          recebidos?: number | null
          sumidos_removidos?: number | null
          vencidos_removidos?: number | null
        }
        Relationships: []
      }
      telegram_chats: {
        Row: {
          cep: string | null
          chat_id: number
          ia_dia: string | null
          ia_usos: number
          origem: string | null
          primeiro_em: string
          ultimo_em: string
        }
        Insert: {
          cep?: string | null
          chat_id: number
          ia_dia?: string | null
          ia_usos?: number
          origem?: string | null
          primeiro_em?: string
          ultimo_em?: string
        }
        Update: {
          cep?: string | null
          chat_id?: number
          ia_dia?: string | null
          ia_usos?: number
          origem?: string | null
          primeiro_em?: string
          ultimo_em?: string
        }
        Relationships: []
      }
    }
    Views: {
      aprendizado_indicacoes: {
        Row: {
          fazem_sentido: number | null
          nao_equivalentes: number | null
          pedidos: number | null
          semana: string | null
        }
        Relationships: []
      }
      campanha_metricas_painel: {
        Row: {
          cliques: number | null
          conversoes: number | null
          ctr_pct: number | null
          dia: string | null
          impressoes: number | null
          slug: string | null
        }
        Relationships: []
      }
      painel_operacao: {
        Row: {
          cliques_afiliado: number | null
          cliques_telegram: number | null
          com_mais_barata: number | null
          conversas_bot_novas: number | null
          dia: string | null
          membros_canal: number | null
          pedidos_site: number | null
          produtos_site: number | null
          publicacoes_canal: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      acompanhar_preco: {
        Args: { p_alvo?: number; p_navegador: string; p_pedido: number }
        Returns: number
      }
      alerta_telegram: {
        Args: { p_monitor: number; p_navegador: string }
        Returns: string
      }
      alternativa_da_analise: {
        Args: { a: Json; p_base: number }
        Returns: Json
      }
      anotar_estado_robo: {
        Args: { p_chave: string; p_token: string; p_valor: string }
        Returns: undefined
      }
      artes_campanhas: {
        Args: never
        Returns: {
          tema: string
          url: string
          versao: number
        }[]
      }
      atender_pedido: {
        Args: {
          p_analise?: Json
          p_codigo?: string
          p_erro?: string
          p_id: number
          p_link: string
          p_token: string
        }
        Returns: undefined
      }
      atualizar_produto_visto: {
        Args: { p: Database["public"]["Tables"]["pedidos_link"]["Row"] }
        Returns: undefined
      }
      auditoria_exibicao: {
        Args: { p_horas?: number }
        Returns: {
          detalhe: string
          gravidade: string
          pedido_id: number
          problema: string
        }[]
      }
      avaliar_indicacao: {
        Args: {
          p_item: string
          p_motivo?: string
          p_pedido: number
          p_util: boolean
        }
        Returns: boolean
      }
      campanha_publica: {
        Args: { p_slug: string }
        Returns: {
          beneficio_texto: string
          estado: string
          inicia_em: string
          nome: string
          produtos: Json
          regras_resumo: string
          slug: string
          tema_visual: string
          temporada: string
          termina_em: string
        }[]
      }
      campanhas_ativas: {
        Args: { p_uf?: string }
        Returns: {
          beneficio_texto: string
          demanda_tipo: string
          fonte: string
          inicia_em: string
          link_afiliado_campanha: string
          nacional: boolean
          nome: string
          produtos: Json
          regras_resumo: string
          slug: string
          tema_visual: string
          temporada: string
          termina_em: string
        }[]
      }
      categoria_do_site: {
        Args: { p_categoria: string; p_titulo: string }
        Returns: string
      }
      chave_do_produto: { Args: { p_url: string }; Returns: string }
      chave_do_url: { Args: { u: string }; Returns: string }
      cobertura_do_titulo: {
        Args: { colado: string; outro: string }
        Returns: number
      }
      completar_pedido: {
        Args: { p_analise: Json; p_id: number; p_token: string }
        Returns: undefined
      }
      concluir_geracao: {
        Args: {
          p_chave: string
          p_erro: string
          p_meta?: Json
          p_resultado: string
          p_tipo: string
          p_token: string
        }
        Returns: undefined
      }
      condicoes_pendentes: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          id: number
        }[]
      }
      conferir_links: {
        Args: { p_lista: Json; p_token: string }
        Returns: Json
      }
      confiabilidade_da_vitrine: {
        Args: { p_chaves: string[] }
        Returns: {
          alt_lider: string
          alt_oficial: boolean
          categoria: string
          chave: string
          colado_condicao: string
          colado_lider: string
          colado_oficial: boolean
          conferido_em: string
          melhor_lider: string
          melhor_oficial: boolean
          pedido_id: number
        }[]
      }
      consolidar_metricas_campanhas: { Args: never; Returns: number }
      consultar_etiqueta: { Args: { p_cupom_id: number }; Returns: string }
      consultar_pedido: {
        Args: { p_id: number }
        Returns: {
          analise: Json
          codigo: string
          comparado_em: string
          erro: string
          link: string
          status: string
        }[]
      }
      curadoria_brinquedos: {
        Args: never
        Returns: {
          atendido_em: string
          economia: number
          em_alta: boolean
          faixa: string
          frete_gratis: boolean
          idade_texto: string
          imagem: string
          link: string
          loja: string
          lojas_comparadas: number
          melhor_frete_gratis: boolean
          melhor_link: string
          melhor_loja: string
          melhor_preco: number
          nome: string
          ofertas: number
          posicao: number
          preco: number
          produto: string
          url: string
        }[]
      }
      detalhes_da_vitrine: {
        Args: { p_chave: string }
        Returns: {
          comparado_em: string
          detalhes: Json
          imagem: string
          titulo: string
        }[]
      }
      disparar_operacao: { Args: { p_caminho: string }; Returns: number }
      estado_do_robo: {
        Args: never
        Returns: {
          freio_ate: string
          freio_motivo: string
          visto_em: string
        }[]
      }
      etiqueta_da_loja: { Args: { p_cupom_id: number }; Returns: Json }
      etiquetas_pendentes: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          desconto: string
          id: number
          pedido: boolean
        }[]
      }
      expirar_campanhas: { Args: never; Returns: number }
      expirar_pedidos: { Args: never; Returns: undefined }
      gravar_diagnostico: {
        Args: { p_dados: Json; p_tipo: string; p_token: string }
        Returns: undefined
      }
      gravar_monitor: {
        Args: {
          p_cheio: number
          p_disponivel: boolean
          p_erro: string
          p_id: number
          p_parcelas: Json
          p_pix: number
          p_preco: number
          p_token: string
        }
        Returns: undefined
      }
      gravar_multiloja: {
        Args: { p_pedido: number; p_resultado: Json; p_token: string }
        Returns: undefined
      }
      iniciar_pedido: {
        Args: { p_id: number; p_token: string }
        Returns: undefined
      }
      jsonb_sim: { Args: { j: Json }; Returns: boolean }
      ligar_alerta_telegram: {
        Args: { p_chat: number; p_codigo: string }
        Returns: Json
      }
      limpar_vencidos: { Args: never; Returns: number }
      links_para_conferir: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          id: number
          link_origem: string
        }[]
      }
      links_pendentes: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          id: number
        }[]
      }
      lojas_para_resolver: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          cupons: number
          origem: string
          seller_id: string
          vendedor: string
        }[]
      }
      lojas_pedidas: {
        Args: { p_token: string }
        Returns: {
          cupom_id: number
          origem: string
          seller_id: string
          vendedor: string
        }[]
      }
      marcar_etapa: {
        Args: { p_etapa: string; p_id: number; p_token: string }
        Returns: boolean
      }
      marcar_frete_vitrine: {
        Args: { p: Database["public"]["Tables"]["pedidos_link"]["Row"] }
        Returns: undefined
      }
      marcar_loja_sem_pagina: {
        Args: { p_token: string; p_vendedor: string }
        Returns: number
      }
      marcar_menor_preco: {
        Args: { p: Database["public"]["Tables"]["pedidos_link"]["Row"] }
        Returns: undefined
      }
      melhor_cupom: {
        Args: { p_token: string; p_vendedor: string }
        Returns: {
          categoria: string
          compra_min: number
          desconto: string
          id: number
          qualidade: string
          sem_teto: boolean
          teto: number
          tipo: string
          valor: number
          vence: string
          vendedor: string
        }[]
      }
      melhores_cupons_por_nome: {
        Args: { p_nomes: string[] }
        Returns: {
          codigo_cupom: string
          compra_min: number
          desconto: string
          id: number
          nome: string
          sem_teto: boolean
          teto: number
          tipo: string
          valor: number
          vence: string
          vendedor: string
        }[]
      }
      meus_precos: {
        Args: { p_navegador: string }
        Returns: {
          disponivel: boolean
          historico: Json
          id: number
          imagem: string
          link: string
          loja: string
          maior_preco: number
          menor_em: string
          menor_preco: number
          parcelas: Json
          preco_alvo: number
          preco_ao_seguir: number
          preco_atual: number
          preco_cheio: number
          preco_pix: number
          proxima_leitura: string
          seguindo_desde: string
          titulo: string
          ultima_leitura: string
          url: string
        }[]
      }
      muda_nao_e_alternativa: { Args: never; Returns: string }
      multiloja_vale: {
        Args: { p_pedido: number; p_token: string }
        Returns: Json
      }
      normalizar_nome: { Args: { p: string }; Returns: string }
      parar_de_acompanhar: {
        Args: { p_monitor: number; p_navegador: string }
        Returns: undefined
      }
      pedidos_esperando: { Args: { p_token: string }; Returns: number }
      pedidos_no_limite: { Args: never; Returns: boolean }
      pedidos_pendentes: {
        Args: { p_token: string }
        Returns: {
          cupom_id: number
          id: number
          url_alvo: string
          vendedor: string
        }[]
      }
      pedir_comparacao:
        | { Args: { p_nova?: boolean; p_url: string }; Returns: Json }
        | {
            Args: { p_cep: string; p_nova: boolean; p_url: string }
            Returns: Json
          }
      pedir_etiqueta: { Args: { p_cupom_id: number }; Returns: string }
      pedir_link: { Args: { p_url: string }; Returns: number }
      pedir_link_agente: {
        Args: { p_fonte?: string; p_url: string }
        Returns: number
      }
      pedir_link_base: {
        Args: { p_reusar: boolean; p_url: string }
        Returns: number
      }
      pedir_link_da_loja: { Args: { p_url: string }; Returns: Json }
      pedir_link_loja: { Args: { p_url: string }; Returns: number }
      pedir_link_novo: { Args: { p_url: string }; Returns: number }
      pedir_loja: { Args: { p_cupom_id: number }; Returns: string }
      produto_permitido: { Args: { p_texto: string }; Returns: boolean }
      produtos_da_campanha: { Args: { p_id: number }; Returns: Json }
      proximo_monitor: {
        Args: { p_token: string }
        Returns: {
          chave: string
          id: number
          url: string
        }[]
      }
      registrar_evento: {
        Args: {
          p_destino?: string
          p_origem?: string
          p_pagina?: string
          p_pedido?: number
          p_tipo: string
        }
        Returns: boolean
      }
      registrar_hub: { Args: { p_itens: Json; p_token: string }; Returns: Json }
      registrar_produto_visto: {
        Args: { p: Database["public"]["Tables"]["pedidos_link"]["Row"] }
        Returns: undefined
      }
      reservar_geracao: {
        Args: { p_chave: string; p_tipo: string; p_token: string }
        Returns: Json
      }
      salvar_condicoes: {
        Args: { p_cond: Json; p_token: string }
        Returns: Json
      }
      salvar_etiquetas: {
        Args: { p_lista: Json; p_token: string }
        Returns: Json
      }
      salvar_link_loja: {
        Args: { p_cupom_id: number; p_link: string }
        Returns: undefined
      }
      salvar_links: { Args: { p_links: Json; p_token: string }; Returns: Json }
      salvar_origem_cupom: {
        Args: { p_id: number; p_token: string; p_url: string }
        Returns: boolean
      }
      salvar_pagina_loja: {
        Args: { p_token: string; p_url: string; p_vendedor: string }
        Returns: number
      }
      salvar_vitrines: {
        Args: { p_lista: Json; p_token: string }
        Returns: Json
      }
      sincronizar_cupons: {
        Args: { p_completo?: boolean; p_cupons: Json; p_token: string }
        Returns: Json
      }
      tempo_estimado: {
        Args: never
        Returns: {
          amostras: number
          segundos: number
        }[]
      }
      tokens_do_titulo: { Args: { t: string }; Returns: string[] }
      ver_pedido: {
        Args: { p_chave: string; p_id: number }
        Returns: {
          analise: Json
          codigo: string
          comparado_em: string
          erro: string
          link: string
          status: string
        }[]
      }
      vitrine: {
        Args: { p_limite?: number }
        Returns: {
          alt_economia: number
          alt_frete_gratis: boolean
          alt_link: string
          alt_loja: string
          alt_muda: string
          alt_oficial: boolean
          alt_preco: number
          alt_titulo: string
          alt_vantagem: string
          categoria: string
          categoria_site: string
          chave: string
          cupom_codigo: string
          cupom_desconto: string
          economia: number
          imagem: string
          link: string
          loja: string
          lojas_comparadas: number
          melhor_link: string
          melhor_loja: string
          melhor_preco: number
          preco: number
          titulo: string
          url_produto: string
          vezes: number
          visto_em: string
        }[]
      }
      vitrine_completar: {
        Args: {
          p_categoria: string
          p_chave: string
          p_imagem: string
          p_token: string
        }
        Returns: undefined
      }
      vitrine_frete: {
        Args: { p_limite?: number }
        Returns: {
          chave: string
          frete_gratis: boolean
          melhor_frete_gratis: boolean
        }[]
      }
      vitrine_menor_preco: {
        Args: { p_limite?: number }
        Returns: {
          chave: string
          imagem: string
          link: string
          loja: string
          lojas_mais_caras: number
          preco: number
          segunda_loja: string
          segunda_preco: number
          titulo: string
          url_produto: string
          visto_em: string
        }[]
      }
      vitrine_sem_foto: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          chave: string
          url_produto: string
        }[]
      }
      vitrines_para_conferir: {
        Args: { p_limite?: number; p_token: string }
        Returns: {
          id: number
          link_origem: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
