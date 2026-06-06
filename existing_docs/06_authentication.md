# 認証方式

## 認証方式の概要

| 項目 | 内容 |
|------|------|
| 方式 | JWT（JSON Web Token） |
| ライブラリ | `djangorestframework-simplejwt` 5.3.1 |
| トークン保存場所 | HTTPonly クッキー |
| カスタム実装 | `backend/authentication.py` の `CustomJWTAuthentication` |
| ユーザーモデル | `CustomUser`（Emailベース、username なし） |

---

## トークン仕様

| トークン種別 | クッキー名 | 有効期限 | 説明 |
|------------|----------|---------|------|
| アクセストークン | `access_token` | 15分 | API認証に使用 |
| リフレッシュトークン | `refresh_token` | 長期 | アクセストークン更新に使用 |

両トークンともに **HTTPonly クッキー** に保存され、JavaScriptからは直接アクセス不可。  
リクエスト時は `credentials: 'include'` を指定してクッキーを自動送信。

---

## 認証フロー（フロントエンド）

```
1. ユーザーがメール・パスワードを入力
        ↓
2. POST /api/accounts/login
   → レスポンス: HTTPonly クッキーに access_token・refresh_token をセット
        ↓
3. GET /api/accounts/auth/
   → ユーザー情報・所属ホーム一覧を取得
   → AuthContext に保存（isUserLogin = true）
        ↓
4. ホーム選択画面（/homeSelect）
        ↓
5. POST /api/accounts/auth/homeLogin/{id}/
   → 選択ホームを確定
   → AuthContext に home・homeUser を保存（isHomeLogin = true）
        ↓
6. ダッシュボード（/home）へ遷移
```

---

## トークンリフレッシュフロー

```
API呼び出し → 401 Unauthorized
        ↓
POST /api/accounts/auth/refresh/
  → refresh_token クッキーで新しい access_token を取得
        ↓
元のAPIリクエストを再実行
        ↓
再び 401 → ログイン画面へリダイレクト
```

実装: `src/hooks/useFetchData.ts` 内で 401 検出時に自動リフレッシュ処理。

---

## フロントエンドの認証実装

### AuthContext（src/contexts/useAuth.tsx）

```typescript
// AuthContext が提供する状態と関数
interface AuthContextType {
  user: User | null;          // ログインユーザー情報
  home: Home | null;          // 選択中のホーム
  homeUser: HomeUser[];       // ホームのメンバー一覧
  isUserLogin: boolean;       // ユーザーログイン状態
  isHomeLogin: boolean;       // ホーム選択状態
  login(): void;              // ログイン
  logout(): void;             // ログアウト
  homeLogin(): void;          // ホーム選択
  homeLogout(): void;         // ホームからログアウト
  refreshAuth(): void;        // 認証情報リフレッシュ
}
```

### PrivateRoute（保護ルート）

```
isUserLogin === false → /login にリダイレクト
isHomeLogin === false → /homeSelect にリダイレクト
両方 true → 通常のページ表示
```

---

## バックエンドの認証実装

### CustomJWTAuthentication（backend/authentication.py）

- Django REST Framework の `BaseAuthentication` を継承
- リクエストの `access_token` クッキーからJWTを取得・検証
- 有効な場合は `CustomUser` インスタンスを返す

### 権限クラス

| エンドポイント | 権限クラス | 説明 |
|-------------|----------|------|
| `/api/accounts/register/` | `AllowAny` | 誰でも登録可能 |
| `/api/accounts/login` | `AllowAny` | 誰でもログイン可能 |
| `/api/accounts/save/{id}/` | `AllowAny` | プロフィール更新（暫定） |
| `/api/hellow/` | `AllowAny` | 動作確認用 |
| その他全エンドポイント | `IsAuthenticated` | ログイン必須 |

---

## ホーム認証の概念

LifeSync-webは **2段階の認証状態** を持つ。

| 状態 | 説明 |
|------|------|
| ユーザーログイン | メール・パスワード認証済み。ホームは未選択。 |
| ホームログイン | ユーザーログイン済み + 特定ホームを選択済み。アプリ機能が利用可能。 |

`CustomUser.selectedHome` に選択中のホームが保存される。  
ホームをまたいで切り替える際は `homeLogout` → `homeLogin` の順で実行。

---

## セキュリティ上の注意点

- `AUTH_PASSWORD_VALIDATORS` が空（パスワードバリデーション無効化）  
  → **本番環境では必ず有効化が必要**
- `/api/accounts/save/{id}/` に `AllowAny` が設定されているため  
  → 本番環境ではアクセス制御の見直しが必要
- CORS設定が開発環境では `CORS_ALLOW_ALL_ORIGINS = True`  
  → 本番環境（`prod.py`）ではドメイン指定に切り替わっている
