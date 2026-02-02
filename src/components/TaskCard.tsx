import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Task, PRIORITY_LABELS, PRIORITY_COLORS } from '@/types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
      onClick={onClick}
    >
      {/* Priority color stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${PRIORITY_COLORS[task.priority]}`} />
      
      <CardHeader className="p-3 pb-1 pl-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium line-clamp-2">{task.title}</h4>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1 pl-4">
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          <Badge 
            variant={task.priority === 1 ? 'destructive' : 'secondary'} 
            className="text-xs"
          >
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          {task.author?.name && (
            <span>От: {task.author.name}</span>
          )}
          {task.owner?.name && (
            <>
              <span>•</span>
              <span>Исп: {task.owner.name}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
