'use client';

import { useMemo, useState } from 'react';
import styles from './TrophyCabinet.module.css';
import {
  buildCabinet,
  listClubs,
  plaqueLines,
  type CabinetSlot,
  type TrophyWin,
} from '@/lib/trophies/aggregate';

interface Props {
  managerName: string;
  /** Manager photo. Falls back to a silhouette. */
  avatarUrl?: string | null;
  wins: TrophyWin[];
}

export default function TrophyCabinet({ managerName, avatarUrl, wins }: Props) {
  const [clubId, setClubId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const clubs = useMemo(() => listClubs(wins), [wins]);
  const cabinet = useMemo(() => buildCabinet(wins, clubId), [wins, clubId]);
  const clubName = clubs.find((c) => c.id === clubId)?.name;

  const subtitle = clubId
    ? `${cabinet.total} ${cabinet.total === 1 ? 'trophy' : 'trophies'} with ${clubName}`
    : `${cabinet.total} ${cabinet.total === 1 ? 'trophy' : 'trophies'} across ${cabinet.clubCount} ${
        cabinet.clubCount === 1 ? 'club' : 'clubs'
      }`;

  const toggle = (type: string) => setSelected((cur) => (cur === type ? null : type));

  return (
    <section className={styles.root} aria-labelledby="trophy-cabinet-title">
      <header className={styles.header}>
        <div className={styles.who}>
          <div className={styles.avatar}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className={styles.avatarImg} />
            ) : (
              <svg width="72" height="72" viewBox="0 0 84 84" aria-hidden="true">
                <circle cx="42" cy="30" r="15" fill="#6f7fa8" />
                <path d="M10 84 C10 58 28 50 42 50 C56 50 74 58 74 84 Z" fill="#6f7fa8" />
              </svg>
            )}
          </div>
          <div>
            <h1 id="trophy-cabinet-title" className={styles.name}>
              {managerName}
            </h1>
            <div className={styles.subtitle} aria-live="polite">
              {subtitle}
            </div>
          </div>
        </div>

        {clubs.length > 1 && (
          <div role="group" aria-label="Filter trophies by club" className={styles.filter}>
            <FilterButton active={clubId === null} onClick={() => setClubId(null)}>
              All clubs
            </FilterButton>
            {clubs.map((c) => (
              <FilterButton key={c.id} active={clubId === c.id} onClick={() => setClubId(c.id)}>
                {c.name}
              </FilterButton>
            ))}
          </div>
        )}
      </header>

      <div className={styles.frame}>
        <div role="group" aria-label="Trophy cabinet" className={styles.cabinet}>
          {cabinet.columns.map((col) => (
            <div key={col.big.def.type} className={styles.compartment}>
              <Slot slot={col.big} size="big" selected={selected === col.big.def.type} onToggle={toggle} />
              <Slot slot={col.small} size="small" selected={selected === col.small.def.type} onToggle={toggle} />
            </div>
          ))}
          <div className={styles.glass} aria-hidden="true" />
        </div>
      </div>

      <footer className={styles.footer}>
        <dl className={styles.stats}>
          <Stat value={cabinet.total} label="Trophies" />
          <Stat value={cabinet.typeCount} label="Different types" />
          <Stat value={cabinet.clubCount} label="Clubs" />
        </dl>
        <div className={styles.legacy}>
          <div className={styles.legacyTitle}>Legacy</div>
          <div className={styles.legacySub}>Trophy Cabinet</div>
        </div>
      </footer>
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.fbtn}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.stat}>
      <dd className={styles.statValue}>{value}</dd>
      <dt className={styles.statLabel}>{label}</dt>
    </div>
  );
}

function Slot({
  slot,
  size,
  selected,
  onToggle,
}: {
  slot: CabinetSlot;
  size: 'big' | 'small';
  selected: boolean;
  onToggle: (type: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const has = slot.count > 0;
  const lines = plaqueLines(slot);
  const label = has
    ? `${slot.def.name}, won ${slot.count} ${slot.count === 1 ? 'time' : 'times'}`
    : `${slot.def.name}, not won yet`;

  return (
    <>
      <button
        type="button"
        className={`${styles.zone} ${size === 'big' ? styles.zoneBig : styles.zoneSmall}`}
        aria-pressed={selected}
        aria-label={label}
        onClick={() => onToggle(slot.def.type)}
      >
        <span className={`${styles.spot} ${has ? '' : styles.spotDim}`} aria-hidden="true" />
        <span className={styles.lamp} aria-hidden="true" />

        <span className={`${styles.trophyBox} ${size === 'big' ? styles.trophyBig : styles.trophySmall}`}>
          {has ? (
            <>
              <span className={styles.floorShadow} aria-hidden="true" />
              {imageFailed ? (
                <span className={styles.fallback}>{slot.def.name}</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slot.def.image}
                  alt=""
                  className={styles.trophyImg}
                  onError={() => setImageFailed(true)}
                />
              )}
            </>
          ) : (
            <span className={styles.ghost} aria-hidden="true" />
          )}
        </span>

        <span className={`${styles.badge} ${slot.count > 1 ? '' : styles.badgeHidden}`}>x{slot.count}</span>
      </button>

      <div className={styles.face}>
        <div className={`${styles.plaque} ${has ? '' : styles.plaqueEmpty}`}>
          <div className={styles.plaqueTitle}>{lines.title}</div>
          <div className={styles.plaqueLine}>{lines.line2}</div>
          <div className={styles.plaqueLine}>{lines.line3}</div>
        </div>
      </div>
    </>
  );
}
