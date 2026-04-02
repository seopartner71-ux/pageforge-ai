import { useState } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  loading?: boolean;
}

export function UrlInput({ onAnalyze, loading }: UrlInputProps) {
  const { tr } = useLang();
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onAnalyze(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={tr.enterUrl}
          className="pl-11 h-12 bg-secondary border-border/50 focus:border-primary text-base"
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="btn-gradient border-0 h-12 px-8">
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {tr.analyzing}</>
        ) : (
          tr.analyze
        )}
      </Button>
    </form>
  );
}
