import { useCallback, useEffect, useState } from 'react';
import { check, supabase } from './supabase';

// Vergleichsanfragen zwischen Spielern desselben Teams.
// Erst wenn der andere annimmt, sehen beide die Messdaten des anderen (erzwingt die Datenbank).

export type RequestStatus = 'pending' | 'accepted' | 'declined';

export interface CompareRequest {
  id: string;
  teamId: string;
  from: string; // Kader-Eintrag (member id) des Absenders
  to: string; // Kader-Eintrag des Empfängers
  status: RequestStatus;
}

interface Row {
  id: string;
  team_id: string;
  from_member: string;
  to_member: string;
  status: RequestStatus;
}

export function useCompareRequests(onShareChange?: () => void) {
  const [requests, setRequests] = useState<CompareRequest[]>([]);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      const rows = check(await supabase.from('compare_requests').select('id, team_id, from_member, to_member, status')) as Row[];
      setRequests(rows.map((r) => ({ id: r.id, teamId: r.team_id, from: r.from_member, to: r.to_member, status: r.status })));
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Beim Start, beim Zurückkommen in den Tab und alle 30 Sekunden nachsehen, ob sich etwas getan hat.
  useEffect(() => {
    reload();
    const onFocus = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onFocus);
    const timer = setInterval(onFocus, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(timer);
    };
  }, [reload]);

  async function run(job: () => Promise<unknown>, sharesChanged = false) {
    try {
      await job();
    } catch (err) {
      setError((err as Error).message);
    }
    await reload();
    if (sharesChanged) onShareChange?.();
  }

  return {
    requests,
    error,
    reload,

    // Anfrage senden. Eine alte (z. B. abgelehnte) Anfrage zwischen den beiden wird dabei ersetzt.
    send: (teamId: string, from: string, to: string) =>
      run(async () => {
        const old = between(requests, from, to);
        if (old) check(await supabase.from('compare_requests').delete().eq('id', old.id));
        check(await supabase.from('compare_requests').insert({ team_id: teamId, from_member: from, to_member: to }));
      }),

    answer: (id: string, accept: boolean) =>
      run(async () => check(await supabase.from('compare_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', id)), accept),

    // Anfrage zurückziehen oder Freigabe beenden.
    remove: (id: string) => run(async () => check(await supabase.from('compare_requests').delete().eq('id', id)), true),
  };
}

// Status zwischen mir und einem Teamkollegen, egal wer angefragt hat.
export function between(requests: CompareRequest[], me: string, other: string) {
  return requests.find((r) => (r.from === me && r.to === other) || (r.from === other && r.to === me));
}
