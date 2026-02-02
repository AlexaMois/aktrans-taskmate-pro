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
      className="cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden border-l-0"
      onClick={onClick}
    >
      {/* Priority color stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${PRIORITY_COLORS[task.priority]}`} />
      
      <CardHeader className="p-3 pb-2 pl-4">
        <h4 className="text-sm font-medium line-clamp-2 leading-snug">{task.title}</h4>
      </CardHeader>
      <CardContent className="p-3 pt-0 pl-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge 
            variant={task.priority === 1 ? 'destructive' : 'secondary'} 
            className="text-[10px] px-1.5 py-0"
          >
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          <span className="text-muted-foreground">
            {task.author?.name}
          </span>
          {task.owner?.name && task.owner.id !== task.author?.id && (
            <>
              <span className="text-muted-foreground">→</span>
              <span className="text-muted-foreground">{task.owner.name}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
