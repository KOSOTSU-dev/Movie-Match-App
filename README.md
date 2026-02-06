## Movie Match App

映画 / ドラマを Tinder ライクなスワイプ操作で直感的に選べる Web アプリです。

### セットアップ

1. 依存インストール
   ```bash
   cd Movie-Match-App
   npm install
   ```

2. `.env.local` をプロジェクト直下に作成し、以下を設定してください:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase anon key

   NEXT_PUBLIC_TMDB_API_KEY=あなたのTMDB APIキー（v4 Read Access Token）
   NEXT_PUBLIC_TMDB_API_BASE_URL=https://api.themoviedb.org/3

   # あらすじを1行に要約するAI（任意・未設定時は先頭1文で表示）
   OPENAI_API_KEY=あなたのOpenAI APIキー
   ```

   **重要**: クライアントコンポーネントから環境変数を読み込むため、`NEXT_PUBLIC_` プレフィックスが必要です。`OPENAI_API_KEY` はサーバー側のみで使用するためプレフィックス不要です。

3. 開発サーバー起動
   ```bash
   npm run dev
   ```

