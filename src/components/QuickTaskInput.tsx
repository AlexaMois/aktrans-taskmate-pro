import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuickTaskInputProps {
  onCreateTask: (title: string) => void;
  isCreating: boolean;
}

export default function QuickTaskInput({ onCreateTask, isCreating }: QuickTaskInputProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isCreating) return;

    onCreateTask(input.trim());
    setInput('');
  };

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Голосовой ввод не поддерживается');
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
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
      if (transcript.trim()) {
        // Auto-create task immediately after voice recognition
        onCreateTask(transcript.trim());
        toast.success('Задача создана');
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('Ошибка распознавания');
    };

    recognition.start();
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Новая задача..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="flex-1 h-12 md:h-11 text-base md:text-sm"
        disabled={isCreating}
      />
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="icon"
        className="h-12 w-12 md:h-11 md:w-11 flex-shrink-0"
        onClick={handleVoiceInput}
        disabled={isCreating}
      >
        {isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
      <Button 
        type="submit" 
        disabled={isCreating || !input.trim()}
        className="h-12 md:h-11 px-3 md:px-4 flex-shrink-0"
      >
        {isCreating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Plus className="h-5 w-5 md:mr-1" />
            <span className="hidden md:inline">Создать</span>
          </>
        )}
      </Button>
    </form>
  );
}
