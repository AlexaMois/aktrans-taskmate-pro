import { Card, CardContent } from '@/components/ui/card';
import { Task } from '@/types';
import { ListTodo, Clock, AlertTriangle } from 'lucide-react';

interface StatsCardsProps {
  tasks: Task[];
}

export default function StatsCards({ tasks }: StatsCardsProps) {
  const total = tasks.length;
  const active = tasks.filter(t => t.status !== 'done').length;
  const urgent = tasks.filter(t => t.priority === 1 && t.status !== 'done').length;

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-2 md:p-3 flex items-center gap-2 md:gap-3">
          <ListTodo className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-base md:text-lg font-semibold">{total}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">Всего</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-2 md:p-3 flex items-center gap-2 md:gap-3">
          <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-base md:text-lg font-semibold">{active}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">Активных</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-2 md:p-3 flex items-center gap-2 md:gap-3">
          <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-base md:text-lg font-semibold text-destructive">{urgent}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">Срочных</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
