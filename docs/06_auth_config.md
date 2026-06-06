# 認証構成

## 設計方針

| 方針 | 内容 |
|------|------|
| トークン保存場所 | HTTPonly クッキー（XSS対策） |
| 認証方式 | JWT（HS256）|
| セッション概念 | 2段階：ユーザーログイン → ホーム選択 |
| ホームID管理 | JWTペイロードに埋め込む（DBアクセス削減） |
| セキュリティ改善 | パスワードバリデーション必須化・全エンドポイント認証強化 |

---

## トークン仕様

| 種別 | クッキー名 | 有効期限 | SameSite | 用途 |
|------|----------|---------|----------|------|
| アクセストークン | `access_token` | 15分 | Lax | API認証 |
| リフレッシュトークン | `refresh_token` | 30日 | Strict | アクセストークン更新 |

---

## JWTペイロード設計

```python
# アクセストークンのペイロード
{
  "sub": "42",              # ユーザーID（文字列）
  "home_id": 7,             # 選択中ホームID（None = ホーム未選択）
  "email": "user@example.com",
  "exp": 1700000000,        # 有効期限（Unix timestamp）
  "iat": 1699999100,        # 発行日時
  "type": "access"
}

# リフレッシュトークンのペイロード
{
  "sub": "42",
  "exp": 1702591100,
  "iat": 1699999100,
  "type": "refresh"
}
```

> `home_id` をJWTに含めることで、ホーム切り替え時に再ログインなしでトークン再発行のみで対応できる。

---

## バックエンド実装

### JWT発行・検証（app/core/security.py）

```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(user_id: int, home_id: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "home_id": home_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != token_type:
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### クッキー設定（app/features/auth/router.py）

```python
from fastapi import Response

def set_auth_cookies(response: Response, user_id: int, home_id: int | None = None) -> None:
    access_token = create_access_token(user_id, home_id)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,          # 本番はTrue（HTTPS必須）
        samesite="lax",
        max_age=60 * settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=60 * 60 * 24 * settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
```

### 認証エンドポイント（app/features/auth/router.py）

```python
@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await AuthService(db).authenticate(body.email, body.password)
    set_auth_cookies(response, user.id, user.selected_home_id)
    return {"message": "Login successful"}


@router.post("/home-login/{home_id}")
async def home_login(
    home_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    home = await AuthService(db).select_home(current_user, home_id)
    set_auth_cookies(response, current_user.id, home.id)
    return {"message": "Home selected"}


@router.post("/refresh")
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = verify_token(refresh_token, token_type="refresh")
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    set_auth_cookies(response, user.id, user.selected_home_id)
    return {"message": "Token refreshed"}


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out"}
```

### 依存関係（2段階認証の実装）

```python
# app/core/dependencies.py

async def get_current_user(
    access_token: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """ユーザーログイン必須"""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(access_token)
    user = await db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_home(
    access_token: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Home:
    """ホーム選択必須（JWTからhome_idを取得）"""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(access_token)
    home_id = payload.get("home_id")
    if not home_id:
        raise HTTPException(status_code=403, detail="No home selected")
    home = await db.get(Home, home_id)
    if not home:
        raise HTTPException(status_code=404, detail="Home not found")
    return home
```

---

## フロントエンド実装

### 認証ガード（src/components/guards/AuthGuard.tsx）

```typescript
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useEffect } from "react";
import { apiClient } from "@/lib/apiClient";

export const AuthGuard = () => {
  const { isUserLoggedIn, setUser } = useAuthStore();

  useEffect(() => {
    // ページリロード時に認証状態を復元
    if (!isUserLoggedIn) {
      apiClient.get("/api/auth/me").then(({ data }) => setUser(data)).catch(() => {});
    }
  }, []);

  if (!isUserLoggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
};

export const HomeGuard = () => {
  const { isHomeSelected } = useAuthStore();
  if (!isHomeSelected) return <Navigate to="/home-select" replace />;
  return <Outlet />;
};
```

### 認証フック（src/features/auth/hooks/useAuth.ts）

```typescript
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

export const useLogin = () => {
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      await apiClient.post("/api/auth/login", body);
      const { data } = await apiClient.get("/api/auth/me");
      return data;
    },
    onSuccess: (user) => {
      setUser(user);
      navigate("/home-select");
    },
  });
};

export const useSelectHome = () => {
  const { setHome } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (homeId: number) => {
      await apiClient.post(`/api/auth/home-login/${homeId}`);
      const { data } = await apiClient.get("/api/auth/me");
      return data;
    },
    onSuccess: ({ home, homeUsers }) => {
      setHome(home, homeUsers);
      navigate("/home");
    },
  });
};

export const useLogout = () => {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => apiClient.post("/api/auth/logout"),
    onSuccess: () => {
      clearAuth();
      navigate("/login");
    },
  });
};
```

---

## 認証フロー全体図

```
[フロントエンド]                          [バックエンド]

POST /api/auth/login
  email + password             ──────────→  パスワード検証
                               ←──────────  access_token（Cookie）
                                            refresh_token（Cookie）
GET /api/auth/me
  Cookie: access_token         ──────────→  JWT検証 → User返却
                               ←──────────  { user, homes }

POST /api/auth/home-login/{id}
  Cookie: access_token         ──────────→  ホーム所属確認
                               ←──────────  新 access_token（home_id入り）

--- 通常APIアクセス ---
GET /api/announces/{homeId}
  Cookie: access_token         ──────────→  JWT検証（home_id確認）
                               ←──────────  データ

--- トークン期限切れ ---
GET /api/...
  Cookie: access_token（期限切れ）──────→  401
POST /api/auth/refresh
  Cookie: refresh_token        ──────────→  検証 → 新 access_token 発行
                               ←──────────  新 access_token（Cookie更新）
元のリクエストをリトライ
```

---

## セキュリティ改善点（旧システムからの変更）

| 項目 | 旧（Django） | 新（FastAPI） |
|------|------------|-------------|
| パスワードバリデーション | 無効化されていた | bcrypt必須・最小8文字強制 |
| `/api/accounts/save/` の認証 | AllowAny（誰でも変更可） | IsAuthenticated（本人のみ） |
| ホームID管理 | DBにselectedHome保存 | JWTペイロードに含める |
| CORS開発環境 | `CORS_ALLOW_ALL_ORIGINS=True` | 明示的なorigins指定 |
| Firebase設定 | コードにハードコード | 環境変数で管理 |
