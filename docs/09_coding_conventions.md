# コーディング規約

> **目的：** AIと人間の両方が迷わずコードを書けるよう、ルールを明文化する。  
> 「どう書くか」に悩む時間を最小化し、「何を作るか」に集中する。

---

## バックエンド（Python / FastAPI）

### 基本ルール

| 項目 | ルール |
|------|--------|
| フォーマッター | Ruff（`ruff format`） |
| リンター | Ruff（`ruff check`） |
| 型チェック | Mypy（`--strict`） |
| 行長 | 100文字 |
| 文字列クォート | ダブルクォート |
| インポート順 | 標準ライブラリ → サードパーティ → ローカル（Ruff自動整列） |

### 型アノテーション

```python
# ✅ 良い：全ての関数に型を付ける
async def get_announce(id: int, db: AsyncSession) -> Announce:
    ...

# ❌ 悪い：型省略
async def get_announce(id, db):
    ...

# ✅ 良い：Optional はパイプ演算子で書く（Python 3.10+）
def create_user(icon_path: str | None = None) -> User:
    ...

# ❌ 悪い：Optional[str]
from typing import Optional
def create_user(icon_path: Optional[str] = None) -> User:
    ...
```

### Pydanticスキーマ

```python
# ✅ 良い：Request / Response を明確に分ける
class AnnounceCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
    content: str = Field(..., min_length=1, max_length=300)
    priority: Literal["high", "medium", "low"]
    end_date: date

class AnnounceResponse(BaseModel):
    id: int
    title: str
    content: str
    priority: str
    end_date: date
    like_count: int
    is_liked: bool
    created_at: datetime
    created_by_nickname: str

    model_config = ConfigDict(from_attributes=True)

# ✅ 良い：共通フィールドはBaseクラスにまとめる
class AnnounceBase(BaseModel):
    title: str
    content: str
    priority: Literal["high", "medium", "low"]
    end_date: date

class AnnounceCreateRequest(AnnounceBase):
    pass

class AnnounceUpdateRequest(AnnounceBase):
    pass
```

### SQLAlchemy モデル

```python
# ✅ 良い：Mapped / mapped_column スタイル（SQLAlchemy 2.0）
class Announce(Base, TimestampMixin):
    __tablename__ = "announces"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False)

    home: Mapped["Home"] = relationship("Home", back_populates="announces")
    likes: Mapped[list["AnnounceLike"]] = relationship("AnnounceLike", back_populates="announce")

# ❌ 悪い：Column() スタイル（旧形式）
class Announce(Base):
    id = Column(Integer, primary_key=True)
    home_id = Column(Integer, ForeignKey("homes.id"))
```

### サービス層

```python
# ✅ 良い：サービスクラスはDBセッションを受け取る
class AnnounceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, id: int) -> Announce:
        announce = await self.db.get(Announce, id)
        if not announce:
            raise HTTPException(status_code=404, detail="Announce not found")
        return announce

# ✅ 良い：N+1を避けるためjoinedloadを使う
async def get_list_with_likes(self, home_id: int, user_id: int) -> list[Announce]:
    result = await self.db.execute(
        select(Announce)
        .options(joinedload(Announce.likes))
        .where(Announce.home_id == home_id)
        .order_by(desc(Announce.created_at))
    )
    return result.scalars().unique().all()
```

### エラーハンドリング

```python
# ✅ 良い：HTTPExceptionを使う。detail は日本語OK
raise HTTPException(status_code=404, detail="お知らせが見つかりません")
raise HTTPException(status_code=403, detail="このホームへのアクセス権がありません")
raise HTTPException(status_code=409, detail="既にいいね済みです")

# ❌ 悪い：生のExceptionを使う（500エラーになる）
raise Exception("Not found")
```

---

## フロントエンド（TypeScript / React）

### 基本ルール

| 項目 | ルール |
|------|--------|
| フォーマッター | Prettier |
| リンター | ESLint + TypeScript |
| 行長 | 100文字 |
| 文字列クォート | ダブルクォート |
| セミコロン | あり |
| インポート | 絶対パス（`@/`プレフィックス）を優先 |

### コンポーネント

```typescript
// ✅ 良い：propsの型は明示的に定義する
interface AnnounceCardProps {
  announce: Announce;
  onLike: (id: number) => void;
  isLiked: boolean;
}

export const AnnounceCard = ({ announce, onLike, isLiked }: AnnounceCardProps) => {
  return (
    <div>
      <h2>{announce.title}</h2>
      <button onClick={() => onLike(announce.id)}>
        {isLiked ? "♥" : "♡"} {announce.likeCount}
      </button>
    </div>
  );
};

// ❌ 悪い：propsの型がない or any
export const AnnounceCard = (props: any) => { ... }
```

### カスタムフック（TanStack Query）

```typescript
// ✅ 良い：1フック1責務。queryKeyは配列の先頭をドメイン名に統一
export const useAnnounces = (homeId: number) => {
  return useQuery({
    queryKey: ["announces", homeId],
    queryFn: () => apiClient.get<Announce[]>(`/api/announces/${homeId}`).then(r => r.data),
    enabled: homeId > 0,
  });
};

export const useCreateAnnounce = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AnnounceCreateInput) =>
      apiClient.post<Announce>("/api/announces", body).then(r => r.data),
    onSuccess: (_, variables) => {
      // 関連するクエリを無効化してリフレッシュ
      qc.invalidateQueries({ queryKey: ["announces"] });
    },
  });
};
```

### 型定義

```typescript
// ✅ 良い：APIレスポンスに対応した型を src/features/XXX/types.ts に定義
export interface Announce {
  id: number;
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  endDate: string;  // ISO8601形式
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  createdByNickname: string;
}

export interface AnnounceCreateInput {
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  endDate: string;
}

// ✅ 良い：グローバルな共通型は src/types/api.ts に
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### フォーム（react-hook-form + zod）

```typescript
// ✅ 良い：zodスキーマでバリデーションを定義
const announceSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(50, "50文字以内で入力してください"),
  content: z.string().min(1, "本文は必須です").max(300),
  priority: z.enum(["high", "medium", "low"]),
  endDate: z.string().min(1, "終了日は必須です"),
});

type AnnounceFormData = z.infer<typeof announceSchema>;

export const AnnounceEditForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<AnnounceFormData>({
    resolver: zodResolver(announceSchema),
  });
  ...
};
```

---

## 命名規則一覧

> この表がプロジェクト全体の命名規則の**唯一の定義場所**です。

| 対象 | 規則 | 例 |
|------|------|---|
| Pythonファイル | snake_case | `cost_tasks.py`, `file_storage.py` |
| Pythonクラス | PascalCase | `AnnounceService`, `CostService` |
| Python関数・メソッド | snake_case | `get_announce_by_id`, `save_image` |
| Python定数 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE_MB`, `ALLOWED_CONTENT_TYPES` |
| DBテーブル | snake_case・複数形 | `announces`, `seisan_meisai`, `costs` |
| DBカラム | snake_case | `home_id`, `created_at`, `purchase_date` |
| TSファイル（コンポーネント） | PascalCase | `AnnounceCard.tsx`, `UserAvatar.tsx` |
| TSファイル（フック・ユーティリティ） | camelCase | `useAnnounces.ts`, `apiClient.ts` |
| TSコンポーネント | PascalCase | `AnnounceCard`, `CostListItem` |
| TSフック | `use` + PascalCase | `useAnnounces`, `useCreateCost` |
| TSインターフェース | PascalCase | `Announce`, `AnnounceCreateInput` |
| TS型エイリアス | PascalCase | `Priority`, `MessageType` |
| CSSクラス（Tailwind使用） | kebab-case（カスタムクラスのみ） | `announce-card` |
| 環境変数（バックエンド） | UPPER_SNAKE_CASE | `DATABASE_URL`, `SECRET_KEY` |
| 環境変数（フロントエンド） | `VITE_` + UPPER_SNAKE_CASE | `VITE_API_BASE_URL`, `VITE_APP_NAME` |
| URLパス（API） | kebab-case | `/api/announces`, `/api/home-login` |
| URLパス（フロント画面） | kebab-case | `/home-select`, `/home-create` |
| featuresフォルダ名 | kebab-case（単語区切りなし可） | `announces/`, `todos/`, `costs/` |

---

## Gitコミット規約

> ブランチ戦略・Issue運用・PR運用については **[15_git_workflow.md](15_git_workflow.md)** を参照してください。

```
<種別>: <日本語の説明>

例:
feat: お知らせ一覧APIを実装
fix: リマインダー通知のタイムゾーンがずれる問題を修正
refactor: AnnounceServiceをサービスクラスに分離
docs: 認証フローの図を更新
test: 家計清算APIのテストを追加
chore: Ruffのリント設定を追加
```

| 種別 | 用途 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング（動作変更なし） |
| `docs` | ドキュメントのみの変更 |
| `test` | テストの追加・修正 |
| `chore` | ビルド・設定の変更 |

---

## AIとの開発時のお作法

1. **機能を実装する前に対応するスキーマ（schemas.py / types.ts）を先に見せる**  
   → AIがAPIの入出力を把握しやすい

2. **1つの機能を1プロンプトで完結させる**  
   例：「announces機能のrouter.py, service.py, schemas.pyを実装して」

3. **テストを先に書いてからロジックを依頼する**  
   → テスト仕様がAIへの「何を作るか」の説明になる

4. **`docs/` フォルダを常に最新に保つ**  
   → AIが迷ったときに参照できるソースオブトゥルース
