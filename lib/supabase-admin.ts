import 'server-only';
import { createClient } from '@supabase/supabase-js';

export type SupabaseJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SupabaseJson | undefined }
  | SupabaseJson[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type SupabaseDatabase = {
  public: {
    Tables: {
      app_state: Table<
        { id: string; data: SupabaseJson; version: number; updated_at: string },
        { id: string; data: SupabaseJson; version: number; updated_at?: string },
        { data?: SupabaseJson; version?: number; updated_at?: string }
      >;
      archive_schema_migrations: Table<
        { version: string; applied_at: string; notes: string | null },
        { version: string; applied_at?: string; notes?: string | null },
        { version?: string; applied_at?: string; notes?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      archive_load_snapshot: { Args: Record<string, never>; Returns: SupabaseJson };
      archive_save_snapshot: {
        Args: { p_data: SupabaseJson; p_expected_version: number };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let supabaseAdmin: ReturnType<typeof createClient<SupabaseDatabase>> | null = null;

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase 服务端环境变量未配置');
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient<SupabaseDatabase>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  return supabaseAdmin;
}
