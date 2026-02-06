# Supabase Google 認証設定ガイド

## Supabase ダッシュボードでの設定

### 1. Enable Sign in with Google
- ✅ **ON にする**（スイッチを有効化）

### 2. Client IDs
- Google Cloud Console で取得した **「クライアント ID」** をそのまま貼り付け
- 例: `123456789-abcdefghijklmnop.apps.googleusercontent.com`
- 複数のクライアント ID を使う場合は、カンマ区切りで入力（通常は1つでOK）

### 3. Client Secret (for OAuth)
- Google Cloud Console で取得した **「クライアント シークレット」** をそのまま貼り付け
- 例: `GOCSPX-xxxxxxxxxxxxxxxxxxxxx`

### 4. Skip nonce checks
- ⚠️ **OFF のまま**（デフォルトで OFF）
- セキュリティ上の理由から、通常はチェックしない

### 5. Allow users without an email
- ⚠️ **OFF のまま**（デフォルトで OFF）
- このアプリではメールアドレスが必要なので、OFF で問題なし

---

## リダイレクト URI の確認

Google Cloud Console の「承認済みのリダイレクト URI」に以下が追加されていることを確認:

```
https://lcdzemgbidsxhyegnhxo.supabase.co/auth/v1/callback
```

---

## 設定後の動作確認

1. Supabase の設定を **Save** で保存
2. ブラウザで `http://localhost:3000` にアクセス
3. 「Googleでログイン」ボタンをクリック
4. Google の認証画面が表示され、ログイン後 `/discover` にリダイレクトされることを確認
