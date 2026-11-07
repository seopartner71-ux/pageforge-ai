import { useLang } from '@/contexts/LangContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookOpen, Trash2, Upload, Loader2, FileText } from 'lucide-react';
import mammoth from 'mammoth';

const PDFJS_VERSION = '4.7.76';
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

let pdfjsPromise: Promise<any> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ PDFJS_CDN).then((mod: any) => {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return mod;
    });
  }
  return pdfjsPromise;
}

interface KbDoc {
  id: string;
  title: string;
  author: string;
  source_type: string;
  total_chunks: number;
  created_at: string;
}

/* ──────────── PDF parsing (lazy, через CDN worker) ──────────── */
async function parsePdf(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const pageText = tc.items.map((it: any) => ('str' in it ? it.str : '')).join(' ');
    out += pageText + '\n\n';
  }
  return out;
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
  return value;
}

async function parseTxt(file: File): Promise<string> {
  return await file.text();
}

export function KnowledgeBaseTab() {
  const { lang } = useLang();
  const tx = (ru: string, en: string) => lang === 'en' ? en : ru;
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kb_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as KbDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f && !title) {
      setTitle(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const upload = async () => {
    if (!file || !title.trim()) {
      toast.error(tx("Укажите название и выберите файл", "Enter a title and select a file"));
      return;
    }
    setBusy(true);
    setProgress(tx("Извлекаю текст…", "Extracting text\u2026"));
    try {
      let text = '';
      let sourceType = 'manual';
      const ext = file.name.toLowerCase().split('.').pop() || '';

      if (ext === 'pdf')      { text = await parsePdf(file);  sourceType = 'pdf'; }
      else if (ext === 'docx'){ text = await parseDocx(file); sourceType = 'docx'; }
      else if (ext === 'txt' || ext === 'md') { text = await parseTxt(file); sourceType = 'txt'; }
      else throw new Error(tx("Поддерживаются только PDF, DOCX, TXT, MD", "Only PDF, DOCX, TXT and MD are supported"));

      if (text.length < 100) throw new Error(tx(`Извлечено слишком мало текста (${text.length} символов)`, `Too little text extracted (${text.length} characters)`));

      setProgress(tx(`Извлечено ${text.length.toLocaleString()} символов. Отправляю в базу…`, `Extracted ${text.length.toLocaleString()} characters. Uploading…`));

      const { data, error } = await supabase.functions.invoke('kb-ingest', {
        body: { title: title.trim(), author: author.trim(), source_type: sourceType, text },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(tx(`Добавлено ${(data as any).total_chunks} чанков`, `Added ${(data as any).total_chunks} chunks`));
      setFile(null);
      setTitle('');
      setAuthor('');
      setProgress('');
      void refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || tx("Ошибка загрузки", "Upload failed"));
      setProgress('');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(tx(`Удалить «${title}» и все её чанки?`, `Delete “${title}” and all its chunks?`))) return;
    const { error } = await supabase.from('kb_documents').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(tx("Удалено", "Deleted"));
    void refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-4 h-4" />
            {tx("Загрузить документ в базу знаний Copilot", "Upload a document to the Copilot knowledge base")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kb-title" className="text-xs">{tx("Название *", "Title *")}</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tx("Например: SEO 2026 (Дмитрий Севальнев)", "For example: SEO 2026 (Dmitry Sevalnev)")}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="kb-author" className="text-xs">{tx("Автор (опц.)", "Author (optional)")}</Label>
              <Input
                id="kb-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={tx("Автор / источник", "Author / source")}
                disabled={busy}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="kb-file" className="text-xs">{tx("Файл (PDF / DOCX / TXT / MD)", "File (PDF / DOCX / TXT / MD)")}</Label>
            <Input
              id="kb-file"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              disabled={busy}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          {progress && (
            <p className="text-xs text-primary font-mono flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> {progress}
            </p>
          )}
          <Button onClick={upload} disabled={busy || !file || !title.trim()} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {busy ? tx("Обработка…", "Processing\u2026") : tx("Загрузить", "Upload")}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {tx("Файл парсится в браузере, в базу уходит чистый текст. Большие PDF (200+ страниц) могут обрабатываться 30–60 сек.", "The file is parsed in your browser; only text is stored. Large PDFs (200+ pages) may take 30\u201360 seconds.")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4" />
            {tx("Документы в базе", "Stored documents")} ({docs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{tx("База знаний пуста - загрузите первый документ", "The knowledge base is empty \u2014 upload your first document")}</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {d.author && <span>{d.author}</span>}
                        <Badge variant="outline" className="text-[10px] py-0 h-4 uppercase">{d.source_type}</Badge>
                        <span className="font-mono">{d.total_chunks} {tx("чанков", "chunks")}</span>
                        <span>{new Date(d.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU')}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(d.id, d.title)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
