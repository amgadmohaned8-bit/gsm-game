import GameMenu from "./GameMenu";
import Icon from "./Icon";
import "./dx-theme.css";

/** The top bar of the game screens: back, the name of the screen, the season and the menu. */
export default function DxBar({ title, onBack, season }: { title: string; onBack: () => void; season?: string }) {
  return (
    <header className="dxbar">
      <button type="button" className="dxbar-back" onClick={onBack} aria-label="Go back">
        <Icon name="arrow-left" size={22} />
      </button>
      <span className="dxbar-title">{title}</span>
      <span className="dxbar-grow" />
      {season ? <span className="dxbar-pill">{season}</span> : null}
      <GameMenu />
    </header>
  );
}
