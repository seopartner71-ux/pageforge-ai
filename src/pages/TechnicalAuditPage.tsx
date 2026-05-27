import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TechnicalAuditView } from '@/components/audit/TechnicalAuditView';
import { ShieldAlert } from 'lucide-react';

export default function TechnicalAuditPage() {
  const [domainInput, setDomainInput] = useState('');
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (!clean) return;
    setActiveDomain(clean);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Технический аудит</h1>
          <p className="text-sm text-muted-foreground">
            Полное сканирование сайта внешним краулером: HTTPS, robots, sitemap, meta, ссылки, скорость
          </p>
        </div>
      </div>

      <Card className="bg-card border-border p-5">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-[12px] text-muted-foreground mb-1.5 block">Домен сайта</label>
            <Input
              placeholder="example.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!domainInput.trim()}>
            {activeDomain ? 'Сменить домен' : 'Открыть аудит'}
          </Button>
        </form>
      </Card>

      {activeDomain && <TechnicalAuditView domain={activeDomain} />}
    </div>
  );
}