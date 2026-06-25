// Database schema types for the Supabase client.
//
// Handwritten for V1 — every table in supabase/schema.sql has a
// corresponding Row / Insert / Update type here. After a real
// Supabase project is up, regenerate this file with:
//
//   npx supabase gen types typescript --project-id <ref> \
//     --schema public > lib/supabase/types.ts
//
// Until then, these types keep the IDE honest and let the app
// compile with zero-config Supabase.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // --- Identity ---
      profiles: {
        Row: {
          id: string; // auth.users.id
          email: string;
          display_name: string;
          dob: string; // date
          created_at: string;
          home_institute: string | null;
          onboarded: boolean;
          is_admin: boolean;
          referral_code: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          dob: string;
          created_at?: string;
          home_institute?: string | null;
          onboarded?: boolean;
          is_admin?: boolean;
          referral_code?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      // --- Progress ---
      daily_results: {
        Row: {
          id: string;
          user_id: string;
          date_key: string; // YYYY-MM-DD
          correct: number;
          total: number;
          xp: number;
          time_ms: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["daily_results"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_results"]["Insert"]>;
      };

      user_stats: {
        Row: {
          user_id: string;
          streak: number;
          last_played_key: string | null;
          total_xp: number;
          longest_streak: number;
          streak_freezes: number;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["user_stats"]["Row"],
          "updated_at"
        > & { updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_stats"]["Insert"]>;
      };

      // --- Compete ---
      trade_floors: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          privacy: "public" | "private";
          start_at: string | null;
          end_at: string | null;
          member_cap: number;
          virtual_capital: number;
          stock_universe: Json;
          asset_classes: string[];
          market_region: "IN" | "UAE" | "US" | "GLOBAL";
          status: "pending_approval" | "live" | "ended" | "rejected";
          created_by_kind: "user" | "club" | "ambassador";
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          privacy?: "public" | "private";
          start_at?: string | null;
          end_at?: string | null;
          member_cap?: number;
          virtual_capital?: number;
          stock_universe?: Json;
          asset_classes?: string[];
          market_region?: "IN" | "UAE" | "US" | "GLOBAL";
          status?: "pending_approval" | "live" | "ended" | "rejected";
          created_by_kind?: "user" | "club" | "ambassador";
        };
        Update: Partial<Database["public"]["Tables"]["trade_floors"]["Insert"]>;
      };

      trade_floor_members: {
        Row: {
          trade_floor_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["trade_floor_members"]["Row"],
          "joined_at"
        > & { joined_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["trade_floor_members"]["Insert"]
        >;
      };

      clubs: {
        Row: {
          id: string;
          institute_id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institute_id: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clubs"]["Insert"]>;
      };

      club_members: {
        Row: {
          club_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
        };
        Insert: {
          club_id: string;
          user_id: string;
          role?: "owner" | "member";
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["club_members"]["Insert"]>;
      };

      fests: {
        Row: {
          id: string;
          club_id: string | null;
          name: string;
          description: string | null;
          start_date: string;
          end_date: string;
          event_type: string;
          difficulty: string;
          source: "system" | "custom";
          created_by: string;
          created_at: string;
          privacy: "public" | "private";
          status: "pending_approval" | "live" | "ended" | "rejected";
          categories: string[];
          starts_at: string | null;
          ends_at: string | null;
          member_cap: number;
        };
        Insert: {
          id?: string;
          club_id?: string | null;
          name: string;
          description?: string | null;
          start_date: string;
          end_date: string;
          event_type?: string;
          difficulty?: string;
          source?: "system" | "custom";
          created_by: string;
          created_at?: string;
          privacy?: "public" | "private";
          status?: "pending_approval" | "live" | "ended" | "rejected";
          categories?: string[];
          starts_at?: string | null;
          ends_at?: string | null;
          member_cap?: number;
        };
        Update: Partial<Database["public"]["Tables"]["fests"]["Insert"]>;
      };

      fest_participants: {
        Row: {
          fest_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fest_participants"]["Row"],
          "joined_at"
        > & { joined_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["fest_participants"]["Insert"]
        >;
      };

      // --- Floor posts (P4 social) ---
      floor_posts: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          kind: "text" | "chart-read" | "portfolio-share";
          body: string;
          ticker: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          kind?: "text" | "chart-read" | "portfolio-share";
          body: string;
          ticker?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["floor_posts"]["Insert"]>;
      };

      floor_reactions: {
        Row: {
          post_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["floor_reactions"]["Row"],
          "created_at"
        > & { created_at?: string };
        Update: Partial<
          Database["public"]["Tables"]["floor_reactions"]["Insert"]
        >;
      };

      floor_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["floor_comments"]["Insert"]
        >;
      };

      // --- Portfolios + orders ---
      portfolios: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          base_date: string;
          initial_capital: number;
          universe: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          base_date: string;
          initial_capital: number;
          universe?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["portfolios"]["Insert"]>;
      };

      portfolio_holdings: {
        Row: {
          portfolio_id: string;
          symbol: string;
          pct: number;
        };
        Insert: Database["public"]["Tables"]["portfolio_holdings"]["Row"];
        Update: Partial<
          Database["public"]["Tables"]["portfolio_holdings"]["Row"]
        >;
      };

      paper_accounts: {
        Row: {
          user_id: string;
          cash: number;
          created_at: string;
          scope_id: string;
        };
        Insert: {
          user_id: string;
          cash?: number;
          created_at?: string;
          scope_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["paper_accounts"]["Insert"]>;
      };

      paper_holdings: {
        Row: {
          user_id: string;
          symbol: string;
          shares: number;
          avg_price: number;
          scope_id: string;
        };
        Insert: {
          user_id: string;
          symbol: string;
          shares: number;
          avg_price: number;
          scope_id?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["paper_holdings"]["Insert"]
        >;
      };

      orders: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          side: "buy" | "sell";
          kind: "market" | "limit" | "stop" | "stop-limit";
          qty: number;
          filled_qty: number;
          avg_fill_price: number;
          limit_price: number | null;
          stop_price: number | null;
          status: "pending" | "partial" | "filled" | "cancelled" | "rejected";
          placed_at: string;
          last_updated: string;
          fills: Json;
          scope_id: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          side: "buy" | "sell";
          kind: "market" | "limit" | "stop" | "stop-limit";
          qty: number;
          filled_qty?: number;
          avg_fill_price?: number;
          limit_price?: number | null;
          stop_price?: number | null;
          status?: "pending" | "partial" | "filled" | "cancelled" | "rejected";
          placed_at?: string;
          last_updated?: string;
          fills?: Json;
          scope_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };

      watchlist_items: {
        Row: {
          user_id: string;
          symbol: string;
          added_at: string;
        };
        Insert: {
          user_id: string;
          symbol: string;
          added_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["watchlist_items"]["Insert"]>;
      };

      quest_claims: {
        Row: {
          user_id: string;
          quest_id: string;
          window_key: string;
          reward_xp: number;
          claimed_at: string;
        };
        Insert: {
          user_id: string;
          quest_id: string;
          window_key: string;
          reward_xp?: number;
          claimed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quest_claims"]["Insert"]>;
      };

      badge_unlocks: {
        Row: {
          user_id: string;
          badge_id: string;
          earned_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: string;
          earned_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["badge_unlocks"]["Insert"]>;
      };

      event_allocations: {
        Row: {
          user_id: string;
          event_id: string;
          allocation: Json;
          submitted_at: string;
          claimed: boolean;
        };
        Insert: {
          user_id: string;
          event_id: string;
          allocation: Json;
          submitted_at?: string;
          claimed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["event_allocations"]["Insert"]>;
      };

      live_sessions: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string | null;
          kind: "walkthrough" | "open-market" | "ama" | "other";
          host_id: string;
          host_display: string;
          starts_at: string;
          duration_mins: number;
          external_link: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description?: string | null;
          kind?: "walkthrough" | "open-market" | "ama" | "other";
          host_id: string;
          host_display: string;
          starts_at: string;
          duration_mins: number;
          external_link?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["live_sessions"]["Insert"]>;
      };

      session_rsvps: {
        Row: {
          session_id: string;
          user_id: string;
          display_name: string;
          joined_at: string;
        };
        Insert: {
          session_id: string;
          user_id: string;
          display_name: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["session_rsvps"]["Insert"]>;
      };

      notification_reads: {
        Row: {
          user_id: string;
          notif_id: string;
          read_at: string;
        };
        Insert: {
          user_id: string;
          notif_id: string;
          read_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_reads"]["Insert"]>;
      };

      alerts: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          condition: "above" | "below";
          price: number;
          one_shot: boolean;
          armed: boolean;
          triggered_at: string | null;
          triggered_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          condition: "above" | "below";
          price: number;
          one_shot?: boolean;
          armed?: boolean;
          triggered_at?: string | null;
          triggered_price?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
      };

      share_clicks: {
        Row: {
          id: string;
          inviter_id: string;
          kind: "floor" | "fest" | "event";
          resource_id: string;
          clicker_id: string | null;
          clicked_at: string;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          kind: "floor" | "fest" | "event";
          resource_id: string;
          clicker_id?: string | null;
          clicked_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["share_clicks"]["Insert"]>;
      };

      share_joins: {
        Row: {
          inviter_id: string;
          invitee_id: string;
          kind: "floor" | "fest" | "event";
          resource_id: string;
          joined_at: string;
        };
        Insert: {
          inviter_id: string;
          invitee_id: string;
          kind: "floor" | "fest" | "event";
          resource_id: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["share_joins"]["Insert"]>;
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
  };
}
