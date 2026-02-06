"use client";

import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";
import { useAuth } from "@/components/AuthProvider";

function HomeContent() {
  const { user, loading } = useAuth();

  return (
    <div className="h-screen overflow-hidden">
      <main className="flex h-full flex-col items-center justify-center bg-[#0E0F11] px-4">
        <div className="max-w-xl space-y-6 text-center">
        <h1 className="logo-font text-6xl font-bold tracking-tight">
          サガシネマ
        </h1>
        <p className="text-sm text-gray-300">
          スワイプ操作で直感的に「次に観る作品」を見つけましょう。
        </p>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : user ? (
            <>
              <p className="text-sm text-gray-300">
                {user.email} でログイン中です。
              </p>
              <Link
                href="/discover"
                className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black shadow hover:bg-emerald-400"
              >
                サガシネマを始める
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                まずは Google ログインして、あなた専用の作品レコメンドを始めましょう。
              </p>
              <AuthButtons />
            </>
          )}
        </div>
      </div>
    </main>
    </div>
  );
}

export default function HomePage() {
  // App Router のトップページはサーバーコンポーネントだが、
  // 認証状態はクライアントで扱うためラッパーを分離
  return <HomeContent />;
}


