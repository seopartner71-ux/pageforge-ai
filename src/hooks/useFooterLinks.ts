import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FooterLink {
  label: string;
  url: string;
  newTab?: boolean;
}

export function useFooterLinks() {
  const [links, setLinks] = useState<FooterLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('site_config')
      .select('value')
      .eq('key', 'footer_links')
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const value = data?.value;
        if (Array.isArray(value)) setLinks(value as FooterLink[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { links, loading };
}
