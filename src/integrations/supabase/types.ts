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
      ia_vereditos: {
        Row: {
          chave_candidato: string
          chave_original: string
          confianca: number
          criado_em: string
          igual: boolean
          modelo: string | null
          motivo: string | null
          parecido: boolean | null
        }
        Insert: {
          chave_candidato: string
          chave_original: string
          confianca?: number
          criado_em?: string
          igual: boolean
          modelo?: string | null
          motivo?: string | null
          parecido?: boolean | null
        }
        Update: {
          chave_candidato?: string
          chave_original?: string
          confianca?: number
          criado_em?: string
          igual?: boolean
          modelo?: string | null
          motivo?: string | null
          parecido?: boolean | null
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
      pedidos_link: {
        Row: {
          analise: Json | null
          atendido_em: string | null
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
          categoria: string | null
          chave: string
          economia: number | null
          imagem: string | null
          link: string | null
          loja: string | null
          lojas_comparadas: number | null
          melhor_link: string | null
          melhor_loja: string | null
          melhor_preco: number | null
          preco: number | null
          primeiro_em: string
          titulo: string
          url_produto: string | null
          vezes: number
          visto_em: string
        }
        Insert: {
          categoria?: string | null
          chave: string
          economia?: number | null
          imagem?: string | null
          link?: string | null
          loja?: string | null
          lojas_comparadas?: number | null
          melhor_link?: string | null
          melhor_loja?: string | null
          melhor_preco?: number | null
          preco?: number | null
          primeiro_em?: string
          titulo: string
          url_produto?: string | null
          vezes?: number
          visto_em?: string
        }
        Update: {
          categoria?: string | null
          chave?: string
          economia?: number | null
          imagem?: string | null
          link?: string | null
          loja?: string | null
          lojas_comparadas?: number | null
          melhor_link?: string | null
          melhor_loja?: string | null
          melhor_preco?: number | null
          preco?: number | null
          primeiro_em?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anotar_estado_robo: {
        Args: { p_chave: string; p_token: string; p_valor: string }
        Returns: undefined
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
      categoria_do_site: {
        Args: { p_categoria: string; p_titulo: string }
        Returns: string
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
      consultar_etiqueta: { Args: { p_cupom_id: number }; Returns: string }
      consultar_pedido: {
        Args: { p_id: number }
        Returns: {
          analise: Json
          codigo: string
          erro: string
          link: string
          status: string
        }[]
      }
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
      expirar_pedidos: { Args: never; Returns: undefined }
      gravar_diagnostico: {
        Args: { p_dados: Json; p_tipo: string; p_token: string }
        Returns: undefined
      }
      iniciar_pedido: {
        Args: { p_id: number; p_token: string }
        Returns: undefined
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
      marcar_loja_sem_pagina: {
        Args: { p_token: string; p_vendedor: string }
        Returns: number
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
      normalizar_nome: { Args: { p: string }; Returns: string }
      pedidos_esperando: { Args: { p_token: string }; Returns: number }
      pedidos_pendentes: {
        Args: { p_token: string }
        Returns: {
          cupom_id: number
          id: number
          url_alvo: string
          vendedor: string
        }[]
      }
      pedir_etiqueta: { Args: { p_cupom_id: number }; Returns: string }
      pedir_link: { Args: { p_url: string }; Returns: number }
      pedir_link_loja: { Args: { p_url: string }; Returns: number }
      pedir_link_novo: { Args: { p_url: string }; Returns: number }
      pedir_loja: { Args: { p_cupom_id: number }; Returns: string }
      produto_permitido: { Args: { p_texto: string }; Returns: boolean }
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
      vitrine: {
        Args: { p_limite?: number }
        Returns: {
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
