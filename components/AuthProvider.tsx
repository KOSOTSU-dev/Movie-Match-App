"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const timeout = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000)
        );
        const { data: { user } } = await Promise.race([
          supabase.auth.getUser(),
          timeout
        ]) as { data: { user: User | null } };
        setUser(user ?? null);
      } catch (e) {
        // タイムアウトまたはエラー時は未ログインとしてログインボタンを表示
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

