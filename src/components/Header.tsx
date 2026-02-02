import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ExternalLink } from 'lucide-react';
import { TaskScope } from '@/types';

interface HeaderProps {
  activeTab: TaskScope;
  onTabChange: (tab: TaskScope) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const { user, logout } = useAuth();

  const handleOpenSheet = () => {
    const sheetUrl = import.meta.env.VITE_GOOGLE_SHEET_URL;
    if (sheetUrl) {
      window.open(sheetUrl, '_blank');
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        {/* Desktop layout */}
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-base lg:text-lg font-bold text-foreground truncate max-w-[300px] lg:max-w-none">
            Цифровизация AkTrans Service
          </h1>

          {/* Tabs */}
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => onTabChange('common')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'common'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Общие задачи
            </button>
            <button
              onClick={() => onTabChange('personal')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'personal'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Мои задачи
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{user?.name}</span>
              <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                {user?.role === 'admin' ? 'Админ' : 'Пользователь'}
              </Badge>
            </div>

            {user?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={handleOpenSheet}>
                <ExternalLink className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">Google-таблица</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline ml-1">Выйти</span>
            </Button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden space-y-2.5">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold text-foreground truncate max-w-[140px]">
              AkTrans
            </h1>
            <div className="flex items-center gap-1.5">
              <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="text-[11px] px-2 py-0.5 max-w-[100px] truncate">
                {user?.name}
              </Badge>
              {user?.role === 'admin' && (
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleOpenSheet}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Full-width segmented control */}
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => onTabChange('common')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'common'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Общие
            </button>
            <button
              onClick={() => onTabChange('personal')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'personal'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Мои задачи
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
