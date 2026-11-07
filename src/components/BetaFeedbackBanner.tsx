import { useLang } from '@/contexts/LangContext';
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
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (!text) {
      toast.error(isRu ? 'Опишите проблему или идею' : 'Describe your problem or idea');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(isRu ? 'Войдите в систему' : 'Please sign in');
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
      toast.error((isRu ? 'Не удалось отправить: ' : 'Could not send: ') + error.message);
      return;
    }
    toast.success(isRu ? 'Спасибо! Сообщение отправлено администратору' : 'Thank you! Your message was sent to the administrator');
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
            {isRu ? 'Идёт бета-тестирование. Нашли баг, ошибку или есть идея? Сообщите админу одной кнопкой.' : 'Beta testing is in progress. Found a bug or have an idea? Send feedback to the administrator.'}
          </p>
          <Button size="sm" onClick={() => setOpen(true)} className="shrink-0">
            {isRu ? 'Сообщить' : 'Send feedback'}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isRu ? 'Обратная связь' : 'Feedback'}</DialogTitle>
            <DialogDescription>
              {isRu ? 'Опишите проблему или предложение - сообщение придёт администратору.' : 'Describe your problem or suggestion. Your message will be sent to the administrator.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRu ? 'Тип' : 'Type'}</Label>
              <RadioGroup value={kind} onValueChange={(v) => setKind(v as Kind)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="bug" /> {isRu ? 'Баг' : 'Bug'}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="idea" /> {isRu ? 'Идея' : 'Idea'}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="other" /> {isRu ? 'Другое' : 'Other'}
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf-msg">{isRu ? 'Сообщение' : 'Message'}</Label>
              <Textarea
                id="bf-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isRu ? 'Что случилось или что предлагаете?' : 'What happened or what would you suggest?'}
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
              {isRu ? 'Отмена' : 'Cancel'}
            </Button>
            <Button onClick={submit} disabled={submitting || !message.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              {submitting ? (isRu ? 'Отправка...' : 'Sending...') : (isRu ? 'Отправить' : 'Send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}