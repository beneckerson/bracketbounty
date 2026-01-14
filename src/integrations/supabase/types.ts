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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action_type: string
          actor_user_id: string | null
          created_at: string
          id: string
          payload: Json | null
          pool_id: string
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          pool_id: string
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          away_team: string
          best_of: number | null
          competition_key: string
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          external_event_id: string | null
          final_away_score: number | null
          final_home_score: number | null
          home_team: string
          id: string
          round_key: string
          round_order: number
          series_away_wins: number | null
          series_home_wins: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          winner_team_code: string | null
        }
        Insert: {
          away_team: string
          best_of?: number | null
          competition_key: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          external_event_id?: string | null
          final_away_score?: number | null
          final_home_score?: number | null
          home_team: string
          id?: string
          round_key: string
          round_order?: number
          series_away_wins?: number | null
          series_home_wins?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          winner_team_code?: string | null
        }
        Update: {
          away_team?: string
          best_of?: number | null
          competition_key?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          external_event_id?: string | null
          final_away_score?: number | null
          final_home_score?: number | null
          home_team?: string
          id?: string
          round_key?: string
          round_order?: number
          series_away_wins?: number | null
          series_home_wins?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          winner_team_code?: string | null
        }
        Relationships: []
      }
      lines: {
        Row: {
          book: string | null
          event_id: string
          id: string
          locked_at: string | null
          locked_line_payload: Json | null
          source: string
        }
        Insert: {
          book?: string | null
          event_id: string
          id?: string
          locked_at?: string | null
          locked_line_payload?: Json | null
          source?: string
        }
        Update: {
          book?: string | null
          event_id?: string
          id?: string
          locked_at?: string | null
          locked_line_payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ownership: {
        Row: {
          acquired_at: string
          acquired_via: string
          from_matchup_id: string | null
          id: string
          member_id: string
          pool_id: string
          team_code: string
        }
        Insert: {
          acquired_at?: string
          acquired_via?: string
          from_matchup_id?: string | null
          id?: string
          member_id: string
          pool_id: string
          team_code: string
        }
        Update: {
          acquired_at?: string
          acquired_via?: string
          from_matchup_id?: string | null
          id?: string
          member_id?: string
          pool_id?: string
          team_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_from_matchup_id_fkey"
            columns: ["from_matchup_id"]
            isOneToOne: false
            referencedRelation: "pool_matchups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pool_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_matchups: {
        Row: {
          commissioner_note: string | null
          decided_at: string | null
          decided_by: Database["public"]["Enums"]["scoring_rule"] | null
          event_id: string | null
          id: string
          participant_a_member_id: string | null
          participant_b_member_id: string | null
          pool_id: string
          round_id: string
          winner_member_id: string | null
        }
        Insert: {
          commissioner_note?: string | null
          decided_at?: string | null
          decided_by?: Database["public"]["Enums"]["scoring_rule"] | null
          event_id?: string | null
          id?: string
          participant_a_member_id?: string | null
          participant_b_member_id?: string | null
          pool_id: string
          round_id: string
          winner_member_id?: string | null
        }
        Update: {
          commissioner_note?: string | null
          decided_at?: string | null
          decided_by?: Database["public"]["Enums"]["scoring_rule"] | null
          event_id?: string | null
          id?: string
          participant_a_member_id?: string | null
          participant_b_member_id?: string | null
          pool_id?: string
          round_id?: string
          winner_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_matchups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_matchups_participant_a_member_id_fkey"
            columns: ["participant_a_member_id"]
            isOneToOne: false
            referencedRelation: "pool_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_matchups_participant_b_member_id_fkey"
            columns: ["participant_b_member_id"]
            isOneToOne: false
            referencedRelation: "pool_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_matchups_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_matchups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "pool_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_matchups_winner_member_id_fkey"
            columns: ["winner_member_id"]
            isOneToOne: false
            referencedRelation: "pool_members"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_members: {
        Row: {
          claim_token: string | null
          display_name: string
          guest_id: string | null
          id: string
          is_claimed: boolean
          joined_at: string
          pool_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string | null
          venmo_handle_copy: string | null
        }
        Insert: {
          claim_token?: string | null
          display_name: string
          guest_id?: string | null
          id?: string
          is_claimed?: boolean
          joined_at?: string
          pool_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
          venmo_handle_copy?: string | null
        }
        Update: {
          claim_token?: string | null
          display_name?: string
          guest_id?: string | null
          id?: string
          is_claimed?: boolean
          joined_at?: string
          pool_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
          venmo_handle_copy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_rounds: {
        Row: {
          id: string
          name: string
          pool_id: string
          round_key: string
          round_order: number
        }
        Insert: {
          id?: string
          name: string
          pool_id: string
          round_key: string
          round_order: number
        }
        Update: {
          id?: string
          name?: string
          pool_id?: string
          round_key?: string
          round_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_rounds_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          allocation_method: Database["public"]["Enums"]["allocation_method"]
          buyin_amount_cents: number | null
          competition_key: string
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          invite_code: string
          max_players: number | null
          mode: Database["public"]["Enums"]["pool_mode"]
          name: string
          payout_note: string | null
          scoring_rule: Database["public"]["Enums"]["scoring_rule"]
          season: string
          status: Database["public"]["Enums"]["pool_status"]
          teams_per_player: number | null
        }
        Insert: {
          allocation_method?: Database["public"]["Enums"]["allocation_method"]
          buyin_amount_cents?: number | null
          competition_key: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          invite_code?: string
          max_players?: number | null
          mode?: Database["public"]["Enums"]["pool_mode"]
          name: string
          payout_note?: string | null
          scoring_rule?: Database["public"]["Enums"]["scoring_rule"]
          season: string
          status?: Database["public"]["Enums"]["pool_status"]
          teams_per_player?: number | null
        }
        Update: {
          allocation_method?: Database["public"]["Enums"]["allocation_method"]
          buyin_amount_cents?: number | null
          competition_key?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          invite_code?: string
          max_players?: number | null
          mode?: Database["public"]["Enums"]["pool_mode"]
          name?: string
          payout_note?: string | null
          scoring_rule?: Database["public"]["Enums"]["scoring_rule"]
          season?: string
          status?: Database["public"]["Enums"]["pool_status"]
          teams_per_player?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          venmo_handle: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          venmo_handle?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          venmo_handle?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pool_creator: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
      is_pool_member: {
        Args: { _pool_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      allocation_method: "random" | "draft"
      app_role: "admin" | "user"
      event_status: "scheduled" | "live" | "final"
      event_type: "game" | "series"
      member_role: "creator" | "member"
      pool_mode: "capture" | "standard"
      pool_status: "draft" | "lobby" | "active" | "completed"
      scoring_rule: "straight" | "ats"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      allocation_method: ["random", "draft"],
      app_role: ["admin", "user"],
      event_status: ["scheduled", "live", "final"],
      event_type: ["game", "series"],
      member_role: ["creator", "member"],
      pool_mode: ["capture", "standard"],
      pool_status: ["draft", "lobby", "active", "completed"],
      scoring_rule: ["straight", "ats"],
    },
  },
} as const
