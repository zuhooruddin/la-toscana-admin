'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import { errorText } from '@/lib/format';

/** PATCH a branch with only the fields of one tab; readiness errors are shown with the missing items. */
export function useBranchSave(branchId: string, onSaved: () => void) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(body: Record<string, unknown>, message = 'Cambios guardados') {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/branches/${branchId}`, { method: 'PATCH', body });
      toast(message);
      onSaved();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { save, busy, error };
}
