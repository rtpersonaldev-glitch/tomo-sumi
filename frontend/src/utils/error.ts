import type { AxiosError } from "axios";

type ApiErrorDetail = string | Array<{ msg: string }>;

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && "response" in error) {
    const axiosError = error as AxiosError<{ detail: ApiErrorDetail }>;
    const detail = axiosError.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  }
  return "予期しないエラーが発生しました";
};
