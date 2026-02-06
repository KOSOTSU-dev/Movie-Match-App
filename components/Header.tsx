"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-transparent">
      <nav className="flex items-center justify-between gap-4 px-2 py-2 md:px-4 md:py-2">
        <div className="flex flex-1 flex-col justify-center gap-0.5 leading-tight">
          <Link
            href="/discover"
            className="logo-font shrink-0 text-3xl font-bold text-[#E6E7EB] md:text-4xl"
          >
            サガシネマ
          </Link>
          <p className="hidden text-[10px] text-[#E6E7EB] md:block md:text-[11px]">
            次に観る一本を、直感で。
          </p>
        </div>
        {user && (
          <div className="group relative flex shrink-0 flex-col items-end overflow-visible">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex size-9 items-center justify-center rounded-full text-[#E6E7EB] transition-colors hover:bg-[#808080]"
              aria-label="ログアウト"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:rotate-90"
                aria-hidden
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </button>
            <span className="pointer-events-none absolute right-0 top-full z-10 whitespace-nowrap pt-1 text-right text-xs text-[#E6E7EB] opacity-0 transition-opacity group-hover:opacity-100">
              ログアウト
            </span>
          </div>
        )}
      </nav>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutConfirm(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-[#14161A] p-5 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-[#E6E7EB]">
              ログアウトしますか？
            </h2>
            <p className="mb-4 text-xs text-gray-400">
              サガシネマからサインアウトします。あとでまたログインすれば、マイリストや履歴はそのまま利用できます。
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-full border border-gray-600 px-3 py-1.5 text-gray-200 hover:bg-gray-700/60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleLogout();
                  setShowLogoutConfirm(false);
                }}
                className="rounded-full bg-pink-500 px-3 py-1.5 font-semibold text-black hover:bg-pink-400"
              >
                ログアウトする
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
