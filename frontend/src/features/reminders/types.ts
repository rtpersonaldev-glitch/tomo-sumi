export interface ReminderContentResponse {
  id: number;
  reminder_id: number;
  title: string;
  memo: string;
  date: string | null;
  time: string | null;
  repeat: string | null;
  is_active: boolean;
  created_by: number | null;
}

export interface ReminderResponse {
  id: number;
  home_id: number;
  list_name: string;
  complete_flag: boolean;
  created_at: string;
  created_by: number | null;
  contents: ReminderContentResponse[];
}

export interface ReminderGroupBody {
  list_name: string;
  complete_flag: boolean;
}

export interface ReminderContentBody {
  title: string;
  memo: string;
  date: string | null;
  time: string | null;
  repeat: string | null;
  is_active: boolean;
}
