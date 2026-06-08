export interface TodoContentResponse {
  id: number;
  todo_id: number;
  content: string;
  check_flag: boolean;
  checked_by: number | null;
}

export interface TodoResponse {
  id: number;
  home_id: number;
  title: string;
  complete_flag: boolean;
  contents: TodoContentResponse[];
  created_at: string;
  created_by: number | null;
}

export interface TodoContentInput {
  content: string;
  check_flag: boolean;
  checked_by: number | null;
}

export interface TodoBody {
  title: string;
  complete_flag: boolean;
  contents: TodoContentInput[];
}
