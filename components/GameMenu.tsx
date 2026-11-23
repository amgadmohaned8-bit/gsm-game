"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { GAME_NAV, type NavItem } from "@/lib/gameNav";
import "./gamemenu.css";

/** The burger and the drawer with the whole game menu, the same on every page of a league or a cup. */
export default function GameMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items: NavItem[] = GAME_NAV;

  function go(item: NavItem) {
    setOpen(false);
    if (item.href) router.push(item.href);
    else if (item.action) router.push(`/game/dashboard?open=${item.action}`);
  }

  return (
    <>
      <button type="button" className="gm-burger" onClick={() => setOpen(true)} aria-label="Open game menu" aria-expanded={open} aria-controls="gm-drawer">
        <Icon name="menu" size={22} />
      </button>
      {open && <div className="gm-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside id="gm-drawer" className={`gm-drawer ${open ? "is-open" : ""}`} aria-label="Game menu" aria-hidden={!open} inert={!open}>
        <header>
          <h2>Game menu</h2>
          <button type="button" ref={closeRef} onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="close" size={22} /></button>
        </header>
        <nav>
          {items.map((item) => (
            <button key={item.label} type="button" onClick={() => go(item)}>
              <Icon name={item.icon} size={22} />
              <span><strong>{item.label}</strong><small>{item.note}</small></span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
