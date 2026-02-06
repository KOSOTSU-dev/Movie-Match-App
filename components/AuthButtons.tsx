"use client";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";

export function AuthButtons() {
  const { user } = useAuth();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/discover`
            : undefined
      }
    });
  };

  const handleGuestLogin = async () => {
    // 匿名ユーザーとしてログイン（メールアドレス・パスワード不要）
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to sign in anonymously:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700"
      >
        ログアウト
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleLogin}
        className="w-full rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow hover:bg-gray-100"
      >
        Googleでログイン
      </button>
      <button
        type="button"
        onClick={handleGuestLogin}
        className="w-full rounded-full border border-gray-600 bg-transparent px-6 py-2.5 text-sm font-semibold text-gray-100 shadow-sm hover:border-gray-400 hover:bg-white/5"
      >
        ゲストとして試す
      </button>
      <p className="text-[11px] leading-relaxed text-gray-400">
        ゲストログインではメールアドレスやパスワードは不要ですが、ログアウトするとマイリストなどのデータは引き継がれません。
        気軽にUIや使い心地を試したいときにご利用ください。
      </p>
    </div>
  );
}

