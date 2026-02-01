import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ExternalLink } from 'lucide-react';

interface HeaderProps {
  activeTab: 'all' | 'my';
  onTabChange: (tab: 'all' | 'my') => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const { user, logout } = useAuth();

  const handleOpenSheet = () => {
    // This would open the Google Sheet - placeholder for now
    window.open('https://docs.google.com/spreadsheets', '_blank');
  };

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-foreground">AK Trans Service</h1>
            
            <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'all' | 'my')}>
              <TabsList>
                <TabsTrigger value="all">Общие задачи</TabsTrigger>
                <TabsTrigger value="my">Мои задачи</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{user?.name}</span>
              <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                {user?.role === 'admin' ? 'Админ' : 'Пользователь'}
              </Badge>
            </div>

            <Button variant="outline" size="sm" onClick={handleOpenSheet}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Google-таблица
            </Button>

            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
