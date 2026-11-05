import { useEffect, useState } from 'react';

// Wechselnde Bilder links auf der Login-Seite. Jede Grafik zeichnet sich beim Einblenden neu.
const INTERVAL_MS = 5000;

const SPEED = [6, 8, 7, 12, 10, 26, 14, 9, 11, 8, 13, 29, 16, 10, 9, 12, 24, 13, 8, 7];
const speedPath = SPEED.map((v, i) => `${i === 0 ? 'M' : 'L'}${4 + i * 5.2} ${62 - v * 1.8}`).join(' ');
const sprints = SPEED.map((v, i) => ({ v, x: 4 + i * 5.2, y: 62 - v * 1.8 })).filter((p) => p.v > 20);

const SLIDES: { word: string; text: string; graphic: JSX.Element }[] = [
  {
    word: 'Lauf',
    text: 'Strecke und Laufwege jedes Spielers, Meter für Meter auf dem Feld.',
    graphic: (
      <>
        <g className="lines">
          <rect x="0.2" y="0.2" width="104.6" height="67.6" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="0" y="13.84" width="16.5" height="40.32" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" />
        </g>
        <path className="draw" pathLength={1} d="M14 50 C 28 44, 30 22, 44 20 S 62 38, 70 30 S 86 14, 92 24" />
        <circle className="pop" cx="92" cy="24" r="1.6" />
      </>
    ),
  },
  {
    word: 'Sprint',
    text: 'Top-Speed, Antritte und Sprints. Wer zieht an, wer baut ab?',
    graphic: (
      <>
        <g className="lines">
          <line x1="4" y1="62" x2="104" y2="62" />
          <line x1="4" y1="26" x2="104" y2="26" strokeDasharray="1.2 1.6" />
        </g>
        <text className="tag" x="5" y="23.5">
          Sprint &gt; 25 km/h
        </text>
        <path className="draw" pathLength={1} d={speedPath} />
        {sprints.map((p) => (
          <circle key={p.x} className="pop" cx={p.x} cy={p.y} r="1.6" />
        ))}
        <text className="tag tag-accent" x={sprints[1].x} y={sprints[1].y - 4} textAnchor="middle">
          31,2 km/h
        </text>
      </>
    ),
  },
  {
    word: 'Schuss',
    text: 'Jeder Abschluss mit Position auf dem Feld, damit nichts verloren geht.',
    graphic: (
      <>
        <g className="lines">
          <rect x="0.2" y="0.2" width="104.6" height="67.6" />
          <line x1="0" y1="0" x2="0" y2="68" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" />
          <rect x="99.5" y="24.84" width="5.5" height="18.32" />
          <path d="M88.5 26.7a9.15 9.15 0 000 14.6" />
          <rect x="104.6" y="30.3" width="1.2" height="7.4" className="goal" />
        </g>
        <circle className="dot" cx="58" cy="52" r="0.9" />
        <circle className="dot" cx="70" cy="18" r="0.9" />
        <circle className="dot" cx="80" cy="44" r="0.9" />
        <path className="draw dashed" pathLength={1} d="M66 48 Q 86 30, 104.5 32" />
        <circle className="pop ball" cx="66" cy="48" r="2" />
        <text className="tag tag-accent" x="66" y="56" textAnchor="middle">
          Abschluss, 21 m
        </text>
      </>
    ),
  },
  {
    word: 'Herzschlag',
    text: 'Puls und Belastungszonen live verfolgen, damit keiner überdreht.',
    graphic: (
      <>
        <g className="zones">
          <rect x="0" y="6" width="105" height="12" className="z5" />
          <rect x="0" y="18" width="105" height="14" className="z4" />
          <rect x="0" y="32" width="105" height="30" className="z3" />
        </g>
        <path
          className="draw"
          pathLength={1}
          d="M0 44 H16 L19 40 L22 48 L25 14 L28 54 L31 44 H46 L49 40 L52 48 L55 10 L58 54 L61 44 H76 L79 40 L82 48 L85 16 L88 54 L91 44 H105"
        />
        <circle className="pop" cx="55" cy="10" r="1.6" />
        <text className="tag tag-accent" x="58.5" y="9">
          178 bpm
        </text>
      </>
    ),
  },
];

export default function AuthSlides() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [resumes, setResumes] = useState(0); // startet den Fortschrittsbalken nach einer Pause neu

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, paused]);

  return (
    <div className="slides" onMouseEnter={() => setPaused(true)} onMouseLeave={() => {
        setPaused(false);
        setResumes((n) => n + 1);
      }}>
      <div className="slides-stage" aria-hidden>
        {SLIDES.map((s, i) => (
          <svg key={s.word} viewBox="-1 -1 107 70" className={i === index ? 'slide-art active' : 'slide-art'}>
            {s.graphic}
          </svg>
        ))}
      </div>

      <div className="slides-text" aria-live="polite">
        {SLIDES.map((s, i) => (
          <div key={s.word} className={i === index ? 'slide-claim active' : 'slide-claim'}>
            <h2>
              Jeder <span>{s.word}</span> zählt.
            </h2>
            <p>{s.text}</p>
          </div>
        ))}
      </div>

      <div className="slides-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.word}
            type="button"
            aria-label={`Bild ${i + 1}: ${s.word}`}
            className={i === index ? (paused ? 'active paused' : 'active') : ''}
            onClick={() => setIndex(i)}
          >
            <span key={resumes} style={{ animationDuration: `${INTERVAL_MS}ms` }} />
          </button>
        ))}
      </div>
    </div>
  );
}
