import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { downloadPdf } from '@/lib/downloadPdf';
import {
  FileText, Download, Loader2, Upload, X, Save, Plus, GripVertical,
  Palette, Type, Image, Maximize, Sun, Moon, Trash2
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ── Section definitions ── */

const ALL_SECTIONS = [
  'scores', 'aiReport', 'priorities', 'tfidf', 'ngrams', 'images',
  'anchors', 'stealth', 'semanticMap', 'blueprint', 'implementationPlan', 'topicalGap',
] as const;
type SectionKey = typeof ALL_SECTIONS[number];

const sectionLabels: Record<SectionKey, { ru: string; en: string }> = {
  scores: { ru: 'Скоринг', en: 'Scoring' },
  aiReport: { ru: 'ИИ-отчёт', en: 'AI Report' },
  priorities: { ru: 'Quick Wins', en: 'Quick Wins' },
  tfidf: { ru: 'TF-IDF', en: 'TF-IDF' },
  ngrams: { ru: 'N-граммы', en: 'N-grams' },
  images: { ru: 'Изображения', en: 'Images' },
  anchors: { ru: 'Ссылки', en: 'Links' },
  stealth: { ru: 'Stealth Engine', en: 'Stealth Engine' },
  semanticMap: { ru: 'Семантическая карта', en: 'Semantic Map' },
  blueprint: { ru: 'Blueprint', en: 'Blueprint' },
  implementationPlan: { ru: 'ТЗ на внедрение', en: 'Implementation Plan' },
  topicalGap: { ru: 'Topical Gap', en: 'Topical Gap' },
};

const FONTS = ['Inter', 'Roboto', 'Open Sans', 'Montserrat'] as const;

/* ── Template type ── */

interface PdfTemplate {
  id?: string;
  name: string;
  is_active: boolean;
  theme: 'dark' | 'light';
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_sizes: { heading: number; subheading: number; body: number };
  margins: { top: number; bottom: number; left: number; right: number };
  logo_url: string | null;
  company_name: string;
  enabled_sections: SectionKey[];
  section_order: SectionKey[];
}

const defaultTemplate: PdfTemplate = {
  name: 'Default',
  is_active: true,
  theme: 'dark',
  primary_color: '#7c3aed',
  accent_color: '#3b82f6',
  font_family: 'Inter',
  font_sizes: { heading: 20, subheading: 16, body: 13 },
  margins: { top: 25, bottom: 25, left: 20, right: 20 },
  logo_url: null,
  company_name: '',
  enabled_sections: [...ALL_SECTIONS],
  section_order: [...ALL_SECTIONS],
};

/* ── Sortable item ── */

function SortableSection({ id, label, enabled, onToggle, lang }: {
  id: string; label: string; enabled: boolean; onToggle: () => void; lang: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-card/50 border border-border/30 hover:border-primary/30 transition-colors">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </button>
      <Switch checked={enabled} onCheckedChange={onToggle} className="scale-90" />
      <span className="text-sm text-foreground flex-1">{label}</span>
    </div>
  );
}

/* ── Main page ── */

export default function PdfEditorPage() {
  const { lang } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<(PdfTemplate & { id: string })[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tpl, setTpl] = useState<PdfTemplate>({ ...defaultTemplate });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /* ── Download test PDF ── */
  const handleDownloadTestPdf = async () => {
    setDownloading(true);
    try {
      // Find the latest analysis to use real data, or show placeholder
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: latestAnalysis } = await supabase
        .from('analyses')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestAnalysis) {
        toast.error(lang === 'ru' ? 'Нет завершённых анализов для экспорта' : 'No completed analyses to export');
        return;
      }

      await downloadPdf({
        analysisId: latestAnalysis.id,
        lang,
        template: {
          theme: tpl.theme,
          primary_color: tpl.primary_color,
          accent_color: tpl.accent_color,
          font_family: tpl.font_family,
          font_sizes: tpl.font_sizes,
          margins: tpl.margins,
          logo_url: tpl.logo_url,
          company_name: tpl.company_name,
          enabled_sections: tpl.enabled_sections,
          section_order: tpl.section_order,
        },
      });
      toast.success(lang === 'ru' ? 'PDF открыт — используйте "Сохранить как PDF"' : 'PDF opened — use "Save as PDF"');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  /* ── Load templates ── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          is_active: d.is_active,
          theme: d.theme as 'dark' | 'light',
          primary_color: d.primary_color,
          accent_color: d.accent_color,
          font_family: d.font_family,
          font_sizes: d.font_sizes as any,
          margins: d.margins as any,
          logo_url: d.logo_url,
          company_name: d.company_name || '',
          enabled_sections: (d.enabled_sections || []) as SectionKey[],
          section_order: (d.section_order || [...ALL_SECTIONS]) as SectionKey[],
        }));
        setTemplates(mapped);
        const active = mapped.find(t => t.is_active) || mapped[0];
        setActiveId(active.id);
        setTpl(active);
      }
      setLoading(false);
    })();
  }, []);

  /* ── Helpers ── */
  const update = useCallback((patch: Partial<PdfTemplate>) => {
    setTpl(prev => ({ ...prev, ...patch }));
  }, []);

  const toggleSection = (key: SectionKey) => {
    setTpl(prev => {
      const set = new Set(prev.enabled_sections);
      set.has(key) ? set.delete(key) : set.add(key);
      return { ...prev, enabled_sections: Array.from(set) };
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTpl(prev => {
        const oldIndex = prev.section_order.indexOf(active.id as SectionKey);
        const newIndex = prev.section_order.indexOf(over.id as SectionKey);
        return { ...prev, section_order: arrayMove(prev.section_order, oldIndex, newIndex) };
      });
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        name: tpl.name,
        is_active: true,
        theme: tpl.theme,
        primary_color: tpl.primary_color,
        accent_color: tpl.accent_color,
        font_family: tpl.font_family,
        font_sizes: tpl.font_sizes,
        margins: tpl.margins,
        logo_url: tpl.logo_url,
        company_name: tpl.company_name,
        enabled_sections: tpl.enabled_sections,
        section_order: tpl.section_order,
      };

      if (activeId) {
        // deactivate others then update
        await supabase.from('pdf_templates').update({ is_active: false }).eq('user_id', user.id).neq('id', activeId);
        const { error } = await supabase.from('pdf_templates').update(payload).eq('id', activeId);
        if (error) throw error;
      } else {
        await supabase.from('pdf_templates').update({ is_active: false }).eq('user_id', user.id);
        const { data, error } = await supabase.from('pdf_templates').insert(payload).select().single();
        if (error) throw error;
        if (data) {
          setActiveId(data.id);
          setTemplates(prev => [...prev, { ...tpl, id: data.id }]);
        }
      }
      toast.success(lang === 'ru' ? 'Шаблон сохранён' : 'Template saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNew = async () => {
    const newTpl: PdfTemplate = { ...defaultTemplate, name: `Template ${templates.length + 1}` };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.from('pdf_templates').update({ is_active: false }).eq('user_id', user.id);
      const { data, error } = await supabase.from('pdf_templates').insert({
        ...newTpl, user_id: user.id, is_active: true,
      }).select().single();
      if (error) throw error;
      if (data) {
        const mapped = { ...newTpl, id: data.id };
        setTemplates(prev => [...prev, mapped]);
        setActiveId(data.id);
        setTpl(mapped);
        toast.success(lang === 'ru' ? 'Новый шаблон создан' : 'New template created');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    await supabase.from('pdf_templates').delete().eq('id', activeId);
    setTemplates(prev => prev.filter(t => t.id !== activeId));
    const remaining = templates.filter(t => t.id !== activeId);
    if (remaining.length > 0) {
      setActiveId(remaining[0].id);
      setTpl(remaining[0]);
    } else {
      setActiveId(null);
      setTpl({ ...defaultTemplate });
    }
    toast.success(lang === 'ru' ? 'Шаблон удалён' : 'Template deleted');
  };

  /* ── Logo upload ── */
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop();
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('report-logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('report-logos').getPublicUrl(path);
      update({ logo_url: publicUrl });
      toast.success(lang === 'ru' ? 'Логотип загружен' : 'Logo uploaded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  /* ── Preview rendering ── */
  const previewBg = tpl.theme === 'dark' ? '#1a1a2e' : '#ffffff';
  const previewFg = tpl.theme === 'dark' ? '#e2e8f0' : '#1a1a1a';
  const previewMuted = tpl.theme === 'dark' ? '#64748b' : '#6b7280';

  const visibleSections = tpl.section_order.filter(s => tpl.enabled_sections.includes(s));

  const t = lang === 'ru' ? {
    title: 'PDF-Конструктор',
    subtitle: 'Настройте внешний вид и структуру отчёта',
    sections: 'Блоки отчёта',
    theme: 'Тема',
    dark: 'Тёмная',
    light: 'Светлая',
    colors: 'Цвета',
    primary: 'Основной',
    accent: 'Акцентный',
    typography: 'Типографика',
    font: 'Шрифт',
    headingSize: 'Заголовки',
    subheadingSize: 'Подзаголовки',
    bodySize: 'Текст',
    logo: 'Логотип',
    uploadLogo: 'Загрузить',
    removeLogo: 'Удалить',
    margins: 'Отступы (мм)',
    top: 'Верх',
    bottom: 'Низ',
    left: 'Лево',
    right: 'Право',
    save: 'Сохранить шаблон',
    newTpl: 'Новый шаблон',
    deleteTpl: 'Удалить',
    company: 'Название компании',
    companyPh: 'Ваша компания',
    preview: 'Предпросмотр',
    selectTpl: 'Шаблон',
  } : {
    title: 'PDF Constructor',
    subtitle: 'Customize report appearance and structure',
    sections: 'Report Sections',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    colors: 'Colors',
    primary: 'Primary',
    accent: 'Accent',
    typography: 'Typography',
    font: 'Font',
    headingSize: 'Headings',
    subheadingSize: 'Subheadings',
    bodySize: 'Body',
    logo: 'Logo',
    uploadLogo: 'Upload',
    removeLogo: 'Remove',
    margins: 'Margins (mm)',
    top: 'Top',
    bottom: 'Bottom',
    left: 'Left',
    right: 'Right',
    save: 'Save Template',
    newTpl: 'New Template',
    deleteTpl: 'Delete',
    company: 'Company name',
    companyPh: 'Your company',
    preview: 'Preview',
    selectTpl: 'Template',
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="py-4 px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 max-w-[1600px] mx-auto">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.title}</h1>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {templates.length > 1 && (
              <Select
                value={activeId || ''}
                onValueChange={(val) => {
                  const found = templates.find(t => t.id === val);
                  if (found) { setActiveId(found.id); setTpl(found); }
                }}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder={t.selectTpl} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(tp => (
                    <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleNew}>
              <Plus className="w-3 h-3" /> {t.newTpl}
            </Button>
            {activeId && templates.length > 1 && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5 text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" /> {t.deleteTpl}
              </Button>
            )}
            <Button size="sm" className="btn-gradient border-0 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {t.save}
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleDownloadTestPdf} disabled={downloading}>
              {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {lang === 'ru' ? 'Скачать тестовый PDF' : 'Download Test PDF'}
            </Button>
          </div>
        </div>

        {/* Three-panel layout */}
        <div className="grid grid-cols-[260px_1fr_280px] gap-4 max-w-[1600px] mx-auto" style={{ minHeight: 'calc(100vh - 140px)' }}>

          {/* ── LEFT: Sections ── */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-160px)] pr-1">
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase px-1 mb-2">{t.sections}</h2>
            <div className="mb-2 px-1">
              <Input
                placeholder={t.company}
                value={tpl.name}
                onChange={e => update({ name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tpl.section_order} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {tpl.section_order.map(key => (
                    <SortableSection
                      key={key}
                      id={key}
                      label={sectionLabels[key][lang as 'ru' | 'en'] || key}
                      enabled={tpl.enabled_sections.includes(key)}
                      onToggle={() => toggleSection(key)}
                      lang={lang}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* ── CENTER: A4 Preview ── */}
          <div className="flex justify-center overflow-y-auto max-h-[calc(100vh-160px)]">
            <div
              className="border border-border/40 rounded-lg shadow-lg overflow-hidden"
              style={{
                width: '595px',
                minHeight: '842px',
                background: previewBg,
                fontFamily: tpl.font_family + ', sans-serif',
                padding: `${tpl.margins.top}px ${tpl.margins.right}px ${tpl.margins.bottom}px ${tpl.margins.left}px`,
              }}
            >
              {/* Cover */}
              <div className="text-center mb-8 pt-12">
                {tpl.logo_url && (
                  <img src={tpl.logo_url} alt="Logo" className="mx-auto mb-4" style={{ maxHeight: 60, maxWidth: 180 }} />
                )}
                <h1 style={{ fontSize: tpl.font_sizes.heading + 6, color: tpl.primary_color, fontWeight: 700 }}>
                  SEO Report
                </h1>
                {tpl.company_name && (
                  <p style={{ fontSize: tpl.font_sizes.body, color: previewMuted, marginTop: 6 }}>{tpl.company_name}</p>
                )}
                <p style={{ fontSize: tpl.font_sizes.body - 1, color: previewMuted, marginTop: 4 }}>example.com</p>
              </div>

              <Separator className="mb-6 opacity-30" />

              {/* Section previews */}
              {visibleSections.map(key => (
                <div key={key} className="mb-6">
                  <h2 style={{ fontSize: tpl.font_sizes.heading, color: tpl.primary_color, fontWeight: 600, marginBottom: 8, borderBottom: `2px solid ${tpl.primary_color}`, paddingBottom: 4 }}>
                    {sectionLabels[key][lang as 'ru' | 'en']}
                  </h2>
                  {key === 'scores' ? (
                    <div className="flex gap-3 mt-3">
                      {['SEO', 'LLM', 'Human', 'SGE'].map((l, i) => (
                        <div key={l} className="flex-1 text-center rounded-lg border p-3" style={{ borderColor: tpl.accent_color + '40' }}>
                          <div style={{ fontSize: tpl.font_sizes.heading + 4, fontWeight: 700, color: tpl.accent_color }}>
                            {[78, 65, 82, 71][i]}
                          </div>
                          <div style={{ fontSize: tpl.font_sizes.body - 2, color: previewMuted }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  ) : key === 'tfidf' || key === 'ngrams' ? (
                    <div className="mt-2 rounded overflow-hidden" style={{ border: `1px solid ${tpl.theme === 'dark' ? '#334155' : '#e5e7eb'}` }}>
                      <div className="flex text-xs font-semibold" style={{ background: tpl.primary_color, color: '#fff', padding: '6px 10px' }}>
                        <span className="flex-1">{lang === 'ru' ? 'Термин' : 'Term'}</span>
                        <span className="w-20 text-right">Score</span>
                      </div>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex text-xs" style={{ padding: '5px 10px', background: i % 2 === 0 ? (tpl.theme === 'dark' ? '#1e293b' : '#f9fafb') : 'transparent', color: previewFg }}>
                          <span className="flex-1">keyword {i}</span>
                          <span className="w-20 text-right">0.{40 - i * 5}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {[1, 2].map(i => (
                        <div key={i} className="rounded" style={{ background: tpl.theme === 'dark' ? '#1e293b' : '#f3f4f6', padding: '8px 12px' }}>
                          <div style={{ fontSize: tpl.font_sizes.body, color: previewFg, height: 10, borderRadius: 4, background: previewMuted + '30', width: `${90 - i * 15}%` }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {visibleSections.length === 0 && (
                <p className="text-center py-20" style={{ color: previewMuted, fontSize: tpl.font_sizes.body }}>
                  {lang === 'ru' ? 'Включите хотя бы один блок' : 'Enable at least one section'}
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Settings ── */}
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-160px)] pr-1">

            {/* Theme */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  {tpl.theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  {t.theme}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex gap-2">
                  <Button
                    variant={tpl.theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => update({ theme: 'dark' })}
                  >{t.dark}</Button>
                  <Button
                    variant={tpl.theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => update({ theme: 'light' })}
                  >{t.light}</Button>
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" />
                  {t.colors}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t.primary}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tpl.primary_color}
                      onChange={e => update({ primary_color: e.target.value })}
                      className="w-8 h-8 rounded border-0 cursor-pointer"
                    />
                    <Input value={tpl.primary_color} onChange={e => update({ primary_color: e.target.value })} className="w-24 h-7 text-xs" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t.accent}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tpl.accent_color}
                      onChange={e => update({ accent_color: e.target.value })}
                      className="w-8 h-8 rounded border-0 cursor-pointer"
                    />
                    <Input value={tpl.accent_color} onChange={e => update({ accent_color: e.target.value })} className="w-24 h-7 text-xs" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Typography */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Type className="w-3.5 h-3.5" />
                  {t.typography}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">{t.font}</span>
                  <Select value={tpl.font_family} onValueChange={v => update({ font_family: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONTS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {([
                  ['heading', t.headingSize, 12, 32],
                  ['subheading', t.subheadingSize, 10, 24],
                  ['body', t.bodySize, 9, 18],
                ] as const).map(([key, label, min, max]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-mono text-foreground">{tpl.font_sizes[key]}px</span>
                    </div>
                    <Slider
                      value={[tpl.font_sizes[key]]}
                      min={min}
                      max={max}
                      step={1}
                      onValueChange={([v]) => update({ font_sizes: { ...tpl.font_sizes, [key]: v } })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Image className="w-3.5 h-3.5" />
                  {t.logo}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {tpl.logo_url ? (
                  <div className="flex items-center gap-2 p-2 rounded border bg-muted/20">
                    <img src={tpl.logo_url} alt="Logo" className="h-8 max-w-[100px] object-contain" />
                    <Button variant="ghost" size="sm" className="text-xs ml-auto" onClick={() => update({ logo_url: null })}>
                      <X className="w-3 h-3 mr-1" /> {t.removeLogo}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={() => fileRef.current?.click()} disabled={logoUploading}>
                    {logoUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {t.uploadLogo}
                  </Button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">{t.company}</span>
                  <Input
                    value={tpl.company_name}
                    onChange={e => update({ company_name: e.target.value })}
                    placeholder={t.companyPh}
                    className="h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Margins */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Maximize className="w-3.5 h-3.5" />
                  {t.margins}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {(['top', 'bottom', 'left', 'right'] as const).map(side => (
                    <div key={side}>
                      <span className="text-[10px] text-muted-foreground">{t[side]}</span>
                      <Input
                        type="number"
                        value={tpl.margins[side]}
                        onChange={e => update({ margins: { ...tpl.margins, [side]: Number(e.target.value) || 0 } })}
                        className="h-7 text-xs"
                        min={0}
                        max={50}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
