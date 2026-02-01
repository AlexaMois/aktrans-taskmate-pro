import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuickTaskInputProps {
  onCreateTask: (title: string, isUrgent: boolean) => void;
  isCreating: boolean;
}

export default function QuickTaskInput({ onCreateTask, isCreating }: QuickTaskInputProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const parseInput = (text: string) => {
    const lowerText = text.toLowerCase();
    const isUrgent = lowerText.includes('срочно') || lowerText.includes('urgent');
    const title = text.replace(/срочно|urgent/gi, '').trim();
    return { title, isUrgent };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const { title, isUrgent } = parseInput(input);
    if (!title) {
      toast.error('Введите название задачи');
      return;
    }

    onCreateTask(title, isUrgent);
    setInput('');
  };

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Голосовой ввод не поддерживается в вашем браузере');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      toast.success('Текст распознан');
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      toast.error('Ошибка распознавания речи');
    };

    recognition.start();
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Сделать отчёт Power BI для Арсения срочно"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="flex-1"
        disabled={isCreating}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleVoiceInput}
        disabled={isRecording || isCreating}
      >
        {isRecording ? (
          <MicOff className="h-4 w-4 text-destructive" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      <Button type="submit" disabled={isCreating || !input.trim()}>
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        Создать
      </Button>
    </form>
  );
}
