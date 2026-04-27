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
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          dob: string;
          created_at?: string;
          home_institute?: string | null;
          onboarded?: boolean;
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
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
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
          club_id: string;
          name: string;
          description: string | null;
          start_date: string;
          end_date: string;
          event_type: string;
          difficulty: string;
          source: "system" | "custom";
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          name: string;
          description?: string | null;
          start_date: string;
          end_date: string;
          event_type?: string;
          difficulty?: string;
          source?: "system" | "custom";
          created_by: string;
          created_at?: string;
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
        };
        Insert: {
          user_id: string;
          cash?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["paper_accounts"]["Insert"]>;
      };

      paper_holdings: {
        Row: {
          user_id: string;
          symbol: string;
          shares: number;
          avg_price: number;
        };
        Insert: Database["public"]["Tables"]["paper_holdings"]["Row"];
        Update: Partial<
          Database["public"]["Tables"]["paper_holdings"]["Row"]
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
  };
}
