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
    <button
      type="button"
      onClick={handleLogin}
      className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow hover:bg-gray-100"
    >
      Googleでログイン
    </button>
  );
}

