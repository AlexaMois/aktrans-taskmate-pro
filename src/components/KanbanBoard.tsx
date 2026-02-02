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

  const getColumnStyle = (status: TaskStatus) => {
    switch (status) {
      case 'ideas':
        return 'bg-muted/30';
      case 'planned':
        return 'bg-blue-500/5';
      case 'in_progress':
        return 'bg-amber-500/5';
      case 'review':
        return 'bg-purple-500/5';
      case 'done':
        return 'bg-green-500/5';
      default:
        return 'bg-muted/30';
    }
  };

  return (
    <>
      {/* Mobile: Horizontal scroll */}
      <div className="md:hidden -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className={`flex-shrink-0 w-[280px] rounded-lg ${getColumnStyle(status)} p-3 snap-start`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">{STATUS_LABELS[status]}</h3>
                <span className="text-xs text-muted-foreground bg-background/80 rounded-full px-2 py-0.5">
                  {getTasksByStatus(status).length}
                </span>
              </div>
              <div className="space-y-2">
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
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden md:grid grid-cols-5 gap-3 h-[calc(100vh-280px)]">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            className={`rounded-lg ${getColumnStyle(status)} p-3 flex flex-col`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{STATUS_LABELS[status]}</h3>
              <span className="text-xs text-muted-foreground bg-background/80 rounded-full px-2 py-0.5">
                {getTasksByStatus(status).length}
              </span>
            </div>
            <ScrollArea className="flex-1 -mr-2 pr-2">
              <div className="space-y-2">
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
    </>
  );
}
