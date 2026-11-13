import type { ReactNode } from "react";
import GsmMark from "./GsmMark";
import Icon from "./Icon";

const steps = ["Contract", "League", "Club", "Appointment"];

type Props = {
  /** 1-4 in the career setup flow; leave out outside the flow */
  step?: 1 | 2 | 3 | 4;
  onBack?: () => void;
  /** a menu button shown before the logo */
  menu?: ReactNode;
  right?: ReactNode;
  /** label such as 2027/28; defaults to the first season */
  season?: string;
};

export default function GameHud({ step, onBack, menu, right, season }: Props) {
  return (
    <header className="gx-hud">
      <div className="gx-hud-left">
        {menu}
        {onBack && (
          <button type="button" className="gx-hud-back" onClick={onBack} aria-label="Go back">
            <Icon name="arrow-left" size={20} />
          </button>
        )}
        <div className="gx-hud-brand">
          <GsmMark size={34} />
          <span>GSM</span>
        </div>
      </div>

      {step ? (
        <ol className="gx-steps" aria-label="Career setup progress">
          {steps.map((label, index) => {
            const n = index + 1;
            const state = n < step ? "done" : n === step ? "now" : "next";
            return (
              <li key={label} data-state={state} aria-current={state === "now" ? "step" : undefined}>
                <i>
                  <span>
                    {state === "done" ? <Icon name="check" size={12} strokeWidth={3} /> : n}
                  </span>
                </i>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <span />
      )}

      <div className="gx-hud-right">
        {right ?? (
          <span className="gx-season">
            Season <b>{season ?? "2026/27"}</b>
          </span>
        )}
      </div>
    </header>
  );
}
