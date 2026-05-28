import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Возвращает true, если пользователь admin или employee.
 * Используется для доступа к разделу «Центр помощи сотрудникам».
 */
export function useStaffRole() {
  const [isStaff, setIsStaff] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'employee']);

      const roles = (data ?? []).map((r: any) => r.role);
      setIsAdmin(roles.includes('admin'));
      setIsStaff(roles.includes('admin') || roles.includes('employee'));
      setLoading(false);
    };
    check();
  }, []);

  return { isStaff, isAdmin, loading };
}