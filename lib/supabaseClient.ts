import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 開発時に気付きやすくするための簡易チェック
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase 環境変数が設定されていません。NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。"
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

