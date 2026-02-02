import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [telegramId, setTelegramId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!telegramId.trim()) {
      toast.error('Введите Telegram ID');
      return;
    }

    setIsLoading(true);

    try {
      // Call edge function to authenticate via Google Sheets
      const { data, error } = await supabase.functions.invoke('auth-telegram', {
        body: { telegram_id: telegramId.trim() },
      });

      if (error) {
        console.error('Auth error:', error);
        toast.error('Ошибка авторизации');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (!data.user) {
        toast.error('Нет доступа');
        return;
      }

      login(data.user);
      toast.success(`Добро пожаловать, ${data.user.name}!`);
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Ошибка соединения');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">AK Trans Service</CardTitle>
          <CardDescription>Система управления задачами</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-id">Telegram ID</Label>
              <Input
                id="telegram-id"
                type="text"
                placeholder="Введите ваш Telegram ID"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                'Войти'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
