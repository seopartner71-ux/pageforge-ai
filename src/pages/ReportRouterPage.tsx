import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import ReportPage from './ReportPage';

export default function ReportRouterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase
        .from('analyses')
        .select('url')
        .eq('id', id)
        .single();
      if (data) setUrl(data.url);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!url) {
    navigate('/history');
    return null;
  }

  return (
    <ReportPage
      url={url}
      analysisId={id}
      onBack={() => navigate('/history')}
    />
  );
}
