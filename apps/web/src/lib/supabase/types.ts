export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TeamRole = "owner" | "admin" | "member";

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          slug: string;
          name: string;
          plan: string;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          plan?: string;
          settings?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          default_team_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          default_team_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };
      team_members: {
        Row: {
          team_id: string;
          user_id: string | null;
          role: TeamRole;
          joined_at: string;
          invited_by: string | null;
          member_id: string;
          member_type: "human" | "agent";
          display_name: string | null;
          scopes: Json;
          created_by_user_id: string | null;
          last_seen_at: string | null;
          active: boolean;
          revoked_at: string | null;
        };
        Insert: {
          team_id: string;
          user_id?: string | null;
          role: TeamRole;
          joined_at?: string;
          invited_by?: string | null;
          member_id: string;
          member_type?: "human" | "agent";
          display_name?: string | null;
          scopes?: Json;
          created_by_user_id?: string | null;
          last_seen_at?: string | null;
          active?: boolean;
          revoked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
        Relationships: [];
      };
      team_member_api_keys: {
        Row: {
          id: string;
          team_id: string;
          member_id: string;
          name: string;
          key_prefix: string | null;
          key_hash: string;
          scopes: Json;
          created_by_user_id: string | null;
          rotated_from_key_id: string | null;
          last_used_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          member_id: string;
          name: string;
          key_prefix?: string | null;
          key_hash: string;
          scopes?: Json;
          created_by_user_id?: string | null;
          rotated_from_key_id?: string | null;
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_member_api_keys"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      app_resolve_human_principal: {
        Args: {
          requested_team?: string | null;
        };
        Returns: {
          id: string;
          team_id: string;
          role: TeamRole;
          team_slug: string;
          team_name: string;
        }[];
      };
      app_team_admin_page: {
        Args: {
          requested_team?: string | null;
        };
        Returns: Json;
      };
      app_rename_team: {
        Args: {
          requested_team?: string | null;
          new_name?: string | null;
        };
        Returns: Json;
      };
      app_update_team_member_role: {
        Args: {
          requested_team?: string | null;
          target_user?: string | null;
          next_role?: TeamRole | null;
        };
        Returns: Json;
      };
      app_remove_team_member: {
        Args: {
          requested_team?: string | null;
          target_user?: string | null;
        };
        Returns: void;
      };
      app_create_team_invitation: {
        Args: {
          requested_team?: string | null;
          invite_email?: string | null;
          invite_role?: TeamRole | null;
          invite_token_hash?: string | null;
          invite_expires_at?: string | null;
        };
        Returns: Json;
      };
      app_cancel_team_invitation: {
        Args: {
          requested_team?: string | null;
          invitation_id?: string | null;
        };
        Returns: void;
      };
      app_regenerate_team_invitation: {
        Args: {
          requested_team?: string | null;
          invitation_id?: string | null;
          invite_token_hash?: string | null;
          invite_expires_at?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
