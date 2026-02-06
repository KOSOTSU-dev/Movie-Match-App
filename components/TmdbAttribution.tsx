"use client";

import Link from "next/link";

/**
 * TMDB API利用規約に基づくクレジット表記
 * @see https://www.themoviedb.org/documentation/api/terms-of-use
 */
export function TmdbAttribution() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-[#0E0F11]/95 py-1 px-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-1 text-center text-[9px] text-gray-500">
        <p>
          This product uses the{" "}
          <Link
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            TMDB
          </Link>{" "}
          API but is not endorsed or certified by TMDB.
        </p>
        <Link
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-300"
          aria-label="TMDB"
        >
          <img
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6e.svg"
            alt="TMDB"
            className="h-3 w-auto"
          />
        </Link>
      </div>
    </footer>
  );
}
