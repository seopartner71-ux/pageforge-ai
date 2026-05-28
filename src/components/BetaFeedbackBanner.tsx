import { useState } from 'react';
import { Sparkles, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Kind = 'bug' | 'idea' | 'other';

export function BetaFeedbackBanner() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (!text) {
      toast.error('Опишите проблему или идею');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Войдите в систему');
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from('beta_feedback').insert({
      user_id: user.id,
      kind,
      message: text,
      page_url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Не удалось отправить: ' + error.message);
      return;
    }
    toast.success('Спасибо! Сообщение отправлено администратору');
    setMessage('');
    setKind('bug');
    setOpen(false);
  };

  return (
    <>
      <div className="border-b border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 px-4 py-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Beta
          </span>
          <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="flex-1 min-w-0 truncate text-foreground/85">
            Идёт бета-тестирование. Нашли баг, ошибку или есть идея? Сообщите админу одной кнопкой.
          </p>
          <Button size="sm" onClick={() => setOpen(true)} className="shrink-0">
            Сообщить
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Обратная связь</DialogTitle>
            <DialogDescription>
              Опишите проблему или предложение - сообщение придёт администратору.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Тип</Label>
              <RadioGroup value={kind} onValueChange={(v) => setKind(v as Kind)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="bug" /> Баг
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="idea" /> Идея
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="other" /> Другое
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-msg">Сообщение</Label>
              <Textarea
                id="bf-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Что случилось или что предлагаете?"
                rows={5}
                maxLength={2000}
              />
              <div className="text-[11px] text-muted-foreground text-right">
                {message.length} / 2000
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={submitting || !message.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              {submitting ? 'Отправка...' : 'Отправить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}