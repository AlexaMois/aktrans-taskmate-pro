import { Task, TaskStatus, STATUS_LABELS, STATUS_ORDER } from '@/types';
import TaskCard from './TaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

export default function KanbanBoard({ tasks, onTaskClick, onStatusChange }: KanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  const getColumnColor = (status: TaskStatus) => {
    switch (status) {
      case 'ideas':
        return 'bg-muted/50';
      case 'planned':
        return 'bg-primary/10';
      case 'in_progress':
        return 'bg-accent';
      case 'review':
        return 'bg-secondary/10';
      case 'done':
        return 'bg-muted/30';
      default:
        return 'bg-muted/50';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-[calc(100vh-320px)]">
      {STATUS_ORDER.map((status) => (
        <div
          key={status}
          className={`rounded-lg ${getColumnColor(status)} p-3`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{STATUS_LABELS[status]}</h3>
            <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
              {getTasksByStatus(status).length}
            </span>
          </div>
          <ScrollArea className="h-[calc(100%-36px)]">
            <div className="space-y-2 pr-2">
              {getTasksByStatus(status).map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                >
                  <TaskCard task={task} onClick={() => onTaskClick(task)} />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
