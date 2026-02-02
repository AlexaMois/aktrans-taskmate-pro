import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task, User, Comment, TaskHistory, Attachment, TaskStatus, TaskScope, STATUS_LABELS, PRIORITY_LABELS, STATUS_ORDER } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Loader2, Send, Link, Paperclip, Trash2, ExternalLink, Upload } from 'lucide-react';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onTaskUpdate: (updatedTask: Task) => void;
  onTaskDelete: (taskId: string) => void;
}

export default function TaskModal({ task, isOpen, onClose, users, onTaskUpdate, onTaskDelete }: TaskModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const isAdmin = user?.role === 'admin';
  const isAuthor = task?.author_id === user?.id;
  const canEdit = isAdmin || isAuthor;
  const canSetDone = isAdmin;

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task });
      loadTaskData(task.id);
      setActiveTab('details');
    }
  }, [task]);

  const loadTaskData = async (taskId: string) => {
    setIsLoading(true);
    try {
      const [commentsRes, historyRes, attachmentsRes] = await Promise.all([
        supabase
          .from('comments')
          .select('*, author:profiles(*)')
          .eq('task_id', taskId)
          .order('created_at', { ascending: true }),
        supabase
          .from('task_history')
          .select('*, author:profiles(*)')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase
          .from('attachments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
      ]);

      if (commentsRes.data) {
        setComments(commentsRes.data.map(c => ({
          ...c,
          author: c.author ? {
            id: c.author.id,
            telegram_id: c.author.telegram_id,
            name: c.author.name,
            active: c.author.active,
            role: 'user' as const
          } : null
        })));
      }
      if (historyRes.data) {
        setHistory(historyRes.data.map(h => ({
          ...h,
          author: h.author ? {
            id: h.author.id,
            telegram_id: h.author.telegram_id,
            name: h.author.name,
            active: h.author.active,
            role: 'user' as const
          } : null
        })));
      }
      if (attachmentsRes.data) {
        setAttachments(attachmentsRes.data as Attachment[]);
      }
    } catch (error) {
      console.error('Error loading task data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logHistory = async (taskId: string, action: string, oldValue: string | null, newValue: string | null) => {
    if (!user) return;
    try {
      await supabase.from('task_history').insert({
        task_id: taskId,
        action,
        old_value: oldValue,
        new_value: newValue,
        author_id: user.id,
      });
    } catch (error) {
      console.error('Error logging history:', error);
    }
  };

  const handleSave = async () => {
    if (!editedTask || !user || !task) return;

    if (editedTask.status === 'done' && task.status !== 'done' && !canSetDone) {
      toast.error('Только администратор может завершить задачу');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editedTask.title,
          description: editedTask.description,
          status: editedTask.status,
          priority: editedTask.priority,
          owner_id: editedTask.owner_id,
        })
        .eq('id', editedTask.id);

      if (error) throw error;

      // Log all changes to history
      if (task.title !== editedTask.title) {
        await logHistory(editedTask.id, 'Изменено название', task.title, editedTask.title);
      }
      if (task.description !== editedTask.description) {
        await logHistory(editedTask.id, 'Изменено описание', task.description || '(пусто)', editedTask.description || '(пусто)');
      }
      if (task.status !== editedTask.status) {
        await logHistory(editedTask.id, 'Изменён статус', STATUS_LABELS[task.status], STATUS_LABELS[editedTask.status]);
      }
      if (task.priority !== editedTask.priority) {
        await logHistory(editedTask.id, 'Изменён приоритет', PRIORITY_LABELS[task.priority], PRIORITY_LABELS[editedTask.priority]);
      }
      if (task.owner_id !== editedTask.owner_id) {
        const oldOwner = users.find(u => u.id === task.owner_id)?.name || 'Не назначен';
        const newOwner = users.find(u => u.id === editedTask.owner_id)?.name || 'Не назначен';
        await logHistory(editedTask.id, 'Изменён исполнитель', oldOwner, newOwner);
      }

      const { data: updatedData } = await supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(*), author:profiles!tasks_author_id_fkey(*)')
        .eq('id', editedTask.id)
        .single();

      if (updatedData) {
        const updatedTask: Task = {
          id: updatedData.id,
          title: updatedData.title,
          description: updatedData.description,
          status: updatedData.status as TaskStatus,
          priority: updatedData.priority as number,
          scope: updatedData.scope as TaskScope,
          owner_id: updatedData.owner_id,
          author_id: updatedData.author_id,
          created_at: updatedData.created_at,
          updated_at: updatedData.updated_at,
          owner: updatedData.owner ? {
            id: updatedData.owner.id,
            telegram_id: updatedData.owner.telegram_id,
            name: updatedData.owner.name,
            active: updatedData.owner.active,
            role: 'user' as const
          } : null,
          author: updatedData.author ? {
            id: updatedData.author.id,
            telegram_id: updatedData.author.telegram_id,
            name: updatedData.author.name,
            active: updatedData.author.active,
            role: 'user' as const
          } : null,
        };
        onTaskUpdate(updatedTask);
      } else {
        onTaskUpdate(editedTask);
      }

      toast.success('Задача сохранена');
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !isAdmin) return;

    if (!confirm('Удалить задачу?')) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;

      onTaskDelete(task.id);
      toast.success('Задача удалена');
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Ошибка удаления');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task || !user) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          task_id: task.id,
          author_id: user.id,
          text: newComment.trim(),
        })
        .select('*, author:profiles(*)')
        .single();

      if (error) throw error;

      setComments([...comments, {
        ...data,
        author: data.author ? {
          id: data.author.id,
          telegram_id: data.author.telegram_id,
          name: data.author.name,
          active: data.author.active,
          role: 'user' as const
        } : null
      }]);
      setNewComment('');
      
      await logHistory(task.id, 'Добавлен комментарий', null, newComment.trim().substring(0, 50) + (newComment.trim().length > 50 ? '...' : ''));
      
      toast.success('Комментарий добавлен');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Ошибка добавления комментария');
    }
  };

  const handleAddLink = async () => {
    if (!newLinkUrl.trim() || !newLinkName.trim() || !task || !user) return;

    try {
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          task_id: task.id,
          type: 'link',
          name: newLinkName.trim(),
          url: newLinkUrl.trim(),
          author_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setAttachments([data as Attachment, ...attachments]);
      
      await logHistory(task.id, 'Добавлена ссылка', null, newLinkName.trim());
      
      setNewLinkUrl('');
      setNewLinkName('');
      toast.success('Ссылка добавлена');
    } catch (error) {
      console.error('Error adding link:', error);
      toast.error('Ошибка добавления ссылки');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task || !user) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('task_id', task.id);
      formData.append('file_name', file.name);

      const { data, error } = await supabase.functions.invoke('upload-file', {
        body: formData,
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('attachments')
        .insert({
          task_id: task.id,
          type: 'file',
          name: data.name,
          url: data.url,
          author_id: user.id,
        })
        .select()
        .single();

      if (attachmentError) throw attachmentError;

      setAttachments([attachmentData as Attachment, ...attachments]);
      
      await logHistory(task.id, 'Загружен файл', null, data.name);
      
      toast.success('Файл загружен');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Ошибка загрузки файла');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    try {
      const { error } = await supabase.from('attachments').delete().eq('id', attachment.id);
      if (error) throw error;

      setAttachments(attachments.filter(a => a.id !== attachment.id));
      
      if (task) {
        await logHistory(task.id, 'Удалено вложение', attachment.name, null);
      }
      
      toast.success('Вложение удалено');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Ошибка удаления');
    }
  };

  if (!task || !editedTask) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Редактирование задачи</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Детали</TabsTrigger>
            <TabsTrigger value="attachments">Вложения</TabsTrigger>
            <TabsTrigger value="comments">Комментарии</TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="details" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column: Title & Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Input
                      value={editedTask.title}
                      onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                      disabled={!canEdit}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Textarea
                      value={editedTask.description || ''}
                      onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                      disabled={!canEdit}
                      rows={6}
                      placeholder="Добавьте описание задачи..."
                    />
                  </div>
                </div>

                {/* Right column: Status, Priority, Owner, Meta */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Статус</Label>
                    <Select
                      value={editedTask.status}
                      onValueChange={(v) => setEditedTask({ ...editedTask, status: v as TaskStatus })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((status) => (
                          <SelectItem 
                            key={status} 
                            value={status}
                            disabled={status === 'done' && !canSetDone}
                          >
                            {STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Приоритет</Label>
                    <Select
                      value={String(editedTask.priority)}
                      onValueChange={(v) => setEditedTask({ ...editedTask, priority: parseInt(v) })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Высокий</SelectItem>
                        <SelectItem value="2">Средний</SelectItem>
                        <SelectItem value="3">Низкий</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Исполнитель</Label>
                    <Select
                      value={editedTask.owner_id || 'unassigned'}
                      onValueChange={(v) => setEditedTask({ ...editedTask, owner_id: v === 'unassigned' ? null : v })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Не назначен</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Read-only meta fields */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Автор</span>
                      <span className="font-medium">{task.author?.name || 'Неизвестно'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Исполнитель</span>
                      <span className="font-medium">{task.owner?.name || 'Не назначен'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Создано</span>
                      <span>{format(new Date(task.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Обновлено</span>
                      <span>{format(new Date(task.updated_at), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label>Добавить ссылку</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Название"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                    className="flex-1 h-11"
                  />
                  <Input
                    placeholder="URL"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="flex-1 h-11"
                  />
                  <Button onClick={handleAddLink} disabled={!newLinkUrl.trim() || !newLinkName.trim()} className="h-11">
                    <Link className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Загрузить файл</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-11"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Выбрать файл
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Нет вложений</p>
                ) : (
                  attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        {attachment.type === 'link' ? (
                          <Link className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        )}
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {attachment.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDeleteAttachment(attachment)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="comments" className="mt-0 space-y-4">
              <div className="space-y-3">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Нет комментариев</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{comment.author?.name || 'Неизвестно'}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Textarea
                  placeholder="Написать комментарий..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()} className="h-auto">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Нет истории</p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-lg border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{entry.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.author?.name || 'Неизвестно'}
                    </div>
                    {(entry.old_value || entry.new_value) && (
                      <div className="text-sm pt-1">
                        {entry.old_value && <span className="line-through text-muted-foreground">{entry.old_value}</span>}
                        {entry.old_value && entry.new_value && <span className="mx-2">→</span>}
                        {entry.new_value && <span>{entry.new_value}</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="flex justify-between pt-4 border-t">
          <div>
            {isAdmin && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Сохранить
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
