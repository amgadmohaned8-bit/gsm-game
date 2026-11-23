import type { IconName } from "@/components/Icon";

export type NavItem = {
  icon: IconName;
  label: string;
  note: string;
  href?: string;
  /** opens a panel of the club hub */
  action?: "room" | "press";
};

/** The game menu: the same list in every league and every cup. */
export const GAME_NAV: NavItem[] = [
  { icon: "home", label: "My teams", note: "Your teams in one place", href: "/game/myteams" },
  { icon: "user", label: "Manager", note: "Your office and the manager", href: "/game/management" },
  { icon: "squad", label: "Squad", note: "Your players, and sell them", href: "/game/players" },
  { icon: "squad", label: "Lineups", note: "Formation and tactics", href: "/game/squad" },
  { icon: "calendar", label: "Fixtures", note: "League and cup matches", href: "/game/fixtures" },
  { icon: "table", label: "League", note: "Table and form", href: "/game/standings" },
  { icon: "tactics", label: "Analyst", note: "Scout the next opponent", href: "/game/analyst" },
  { icon: "training", label: "Training", note: "Develop your players", href: "/game/training" },
  { icon: "ball", label: "Friendlies", note: "Five warm-up matches", href: "/game/friendlies" },
  { icon: "transfer", label: "Transfers", note: "Buy and sell", href: "/game/transfers" },
  { icon: "contract", label: "Contracts", note: "Renew and wages", href: "/game/contracts" },
  { icon: "wallet", label: "Bank", note: "Loans, debts and credit", href: "/game/bank" },
  { icon: "chat", label: "Social", note: "Feed, stories and coaches", href: "/game/social" },
  { icon: "news", label: "Press room", note: "Face the journalists", action: "press" },
  { icon: "user", label: "Friend code", note: "Invite friends with a code", action: "room" },
  { icon: "sliders", label: "Settings", note: "Game options", href: "/game/settings" },
];

/** The cups are not in the menu: their matches are in Fixtures, and the club hub has buttons for them. */
