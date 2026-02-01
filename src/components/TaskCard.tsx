import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Task } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium line-clamp-2">{task.title}</h4>
          {task.priority === 'urgent' && (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          {task.priority === 'urgent' && (
            <Badge variant="destructive" className="text-xs">
              Срочно
            </Badge>
          )}
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
