export interface ScheduleResponse {
  id: number;
  home_id: number;
  title: string;
  memo: string;
  start_day: string;
  end_day: string;
  created_at: string;
  created_by: number | null;
}

export interface ScheduleFormValues {
  title: string;
  memo: string;
  start_day: string;
  end_day: string;
}
