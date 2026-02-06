import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { TmdbAttribution } from "@/components/TmdbAttribution";

export const metadata: Metadata = {
  title: "サガシネマ",
  description:
    "スワイプ操作で直感的に「次に観る作品」を見つけられる映画ディスカバリーアプリ"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col bg-[#0E0F11] text-[#E6E7EB]">
        <AuthProvider>
          <div className="flex min-h-screen flex-1 flex-col pb-8">
            {children}
          </div>
          <TmdbAttribution />
        </AuthProvider>
      </body>
    </html>
  );
}


