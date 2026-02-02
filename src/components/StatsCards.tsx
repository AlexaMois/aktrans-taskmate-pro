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
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-3 flex items-center gap-3">
          <ListTodo className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold">{total}</p>
            <p className="text-xs text-muted-foreground">Всего</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold">{active}</p>
            <p className="text-xs text-muted-foreground">Активных</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-lg font-semibold text-destructive">{urgent}</p>
            <p className="text-xs text-muted-foreground">Срочных</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
