interface Props {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: boolean;
}

export default function Stat({ label, value, unit, note, accent }: Props) {
  return (
    <div className={accent ? 'stat stat-accent' : 'stat'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
