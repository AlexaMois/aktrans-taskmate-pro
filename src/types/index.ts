export type AppRole = 'admin' | 'user';
export type TaskStatus = 'ideas' | 'planned' | 'in_progress' | 'review' | 'done';
export type TaskScope = 'common' | 'personal';

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
  priority: number;
  scope: TaskScope;
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
  ideas: 'Идеи',
  planned: 'Запланировано',
  in_progress: 'В разработке',
  review: 'На проверке',
  done: 'Завершено',
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Высокий',
  2: 'Средний',
  3: 'Низкий',
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-yellow-500',
  3: 'bg-green-500',
};

export const STATUS_ORDER: TaskStatus[] = ['ideas', 'planned', 'in_progress', 'review', 'done'];
