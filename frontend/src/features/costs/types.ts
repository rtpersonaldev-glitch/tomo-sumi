export interface CostCategoryResponse {
  id: number;
  home_id: number;
  name: string;
}

export interface SeikyusakiResponse {
  id: number;
  payer_user_id: number | null;
  amount: number;
  dish_count: number | null;
}

export interface CostResponse {
  id: number;
  home_id: number;
  purchase_date: string;
  category_id: number | null;
  category_name: string | null;
  amount: number;
  payer_user_id: number | null;
  payer_nickname: string | null;
  payer_icon_url: string | null;
  receipt_image_url: string | null;
  payment_method: string;
  memo: string;
  dish_count: number | null;
  seisan_id: number | null;
  seikyusaki: SeikyusakiResponse[];
  created_at: string;
}

export interface SummaryUserAmount {
  user_id: number;
  nickname: string;
  amount: number;
}

export interface SummaryCategoryAmount {
  category_id: number | null;
  name: string;
  amount: number;
}

export interface CostSummaryResponse {
  total_amount: number;
  by_user: SummaryUserAmount[];
  by_category: SummaryCategoryAmount[];
}

export interface AutoSeisanResponse {
  id: number;
  home_id: number;
  execute_flag: boolean;
  seisan_day: number;
}

export interface CostSettingsResponse {
  auto_seisan: AutoSeisanResponse | null;
}

export interface KoteihiResponse {
  id: number;
  home_id: number;
  category_id: number | null;
  amount: number;
  from_user_id: number | null;
  to_user_id: number | null;
  memo: string;
}

export interface SeisanMeisaiResponse {
  id: number;
  seisan_id: number;
  from_user_id: number | null;
  from_nickname: string | null;
  to_user_id: number | null;
  to_nickname: string | null;
  amount: number;
  complete_flag: boolean;
}

export interface SeisanListResponse {
  id: number;
  home_id: number;
  title: string;
  complete_flag: boolean;
  settled_date: string;
  created_at: string;
}

export interface SeisanResponse {
  id: number;
  home_id: number;
  title: string;
  complete_flag: boolean;
  settled_date: string;
  meisai: SeisanMeisaiResponse[];
  created_at: string;
}

/** フロントエンド専用: 清算方法 */
export type SeisanMethod = "equal" | "dish" | "direct";

/** フロントエンド専用: 請求先メンバーの入力 */
export interface MemberBillInput {
  userId: number;
  dishCount: number;
  amount: number;
}
