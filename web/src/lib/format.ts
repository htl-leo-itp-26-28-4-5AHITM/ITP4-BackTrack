const num = (digits: number) =>
  new Intl.NumberFormat('de-AT', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmt = {
  km: (v: number) => num(2).format(v),
  kmh: (v: number) => num(1).format(v),
  int: (v: number) => num(0).format(v),
  bpm: (v?: number) => (v === undefined ? '–' : num(0).format(v)),
  min: (v: number) => num(0).format(v),
  date: (ms: number) =>
    new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ms),
  short: (ms: number) => new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(ms),
  time: (ms: number) => new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(ms),
};
