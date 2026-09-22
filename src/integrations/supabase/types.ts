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
          created_at: string
          desconto: string | null
          estoque: number | null
          id: number
          link_afiliado: string | null
          link_em: string | null
          link_tentativas: number
          nivel: string | null
          orcamento: number | null
          qualidade: string | null
          sem_teto: boolean
          teto: number | null
          tipo: string | null
          updated_at: string
          valor: number | null
          vence: string | null
          vendas: number | null
          vitrine_conferida_em: string | null
          vitrine_ok: boolean | null
          vendedor: string
        }
        Insert: {
          busca?: string | null
          categoria?: string | null
          codigo_cupom?: string | null
          codigo_em?: string | null
          codigo_pedido_em?: string | null
          codigo_tentativas?: number
          compra_min?: number | null
          created_at?: string
          desconto?: string | null
          estoque?: number | null
          id: number
          link_afiliado?: string | null
          link_em?: string | null
          link_tentativas?: number
          nivel?: string | null
          orcamento?: number | null
          qualidade?: string | null
          sem_teto?: boolean
          teto?: number | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          vence?: string | null
          vendas?: number | null
          vitrine_conferida_em?: string | null
          vitrine_ok?: boolean | null
          vendedor: string
        }
        Update: {
          busca?: string | null
          categoria?: string | null
          codigo_cupom?: string | null
          codigo_em?: string | null
          codigo_pedido_em?: string | null
          codigo_tentativas?: number
          compra_min?: number | null
          created_at?: string
          desconto?: string | null
          estoque?: number | null
          id?: number
          link_afiliado?: string | null
          link_em?: string | null
          link_tentativas?: number
          nivel?: string | null
          orcamento?: number | null
          qualidade?: string | null
          sem_teto?: boolean
          teto?: number | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          vence?: string | null
          vendas?: number | null
          vitrine_conferida_em?: string | null
          vitrine_ok?: boolean | null
          vendedor?: string
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
          status?: string
          titulo?: string | null
          url_alvo?: string | null
          vendedor?: string
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
      expirar_pedidos: { Args: never; Returns: undefined }
      limpar_vencidos: { Args: never; Returns: number }
      pedidos_pendentes: {
        Args: { p_token: string }
        Returns: {
          cupom_id: number
          id: number
          url_alvo: string
          vendedor: string
        }[]
      }
      consultar_etiqueta: { Args: { p_cupom_id: number }; Returns: string }
      pedir_etiqueta: { Args: { p_cupom_id: number }; Returns: string }
      pedir_link: { Args: { p_url: string }; Returns: number }
      sincronizar_cupons: {
        Args: { p_completo?: boolean; p_cupons: Json; p_token: string }
        Returns: Json
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
