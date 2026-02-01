export type AppRole = 'admin' | 'user';
export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'normal' | 'urgent';

export interface User {
  id: string;
  telegram_id: string;
  name: string;
  active: boolean;
  role: AppRole;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  owner_id: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
  owner?: User | null;
  author?: User | null;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author?: User | null;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  author_id: string;
  created_at: string;
  author?: User | null;
}

export interface Attachment {
  id: string;
  task_id: string;
  type: 'file' | 'link';
  name: string;
  url: string;
  author_id: string;
  created_at: string;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Готово',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: 'Обычный',
  urgent: 'Срочный',
};

export const STATUS_ORDER: TaskStatus[] = ['backlog', 'in_progress', 'review', 'done'];
