// One icon family for the whole game: 24px grid, 1.6 stroke, round caps.
// Decorative by default (aria-hidden). Put the accessible name on the button.

const paths = {
  menu: "M4 7h16M4 12h16M4 17h16",
  tactics: "M5 5l5 5M10 5l-5 5M14.5 17.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM5 14.5h5v5H5zM14 8c2 0 4-1 5-3",
  contract: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
  training: "M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12",
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  office: "M3 8h18v11H3zM9 8V5.5h6V8M3 13h18",
  flag: "M6 21V4M6 5h11l-2 3.5L17 12H6",
  squad:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.3 2.4 3.6 5.2",
  table: "M4 5h16v14H4zM4 10h16M4 14.5h16M9 5v14",
  calendar: "M4 6h16v14H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5",
  transfer: "M4 8h14l-3.5-3.5M20 16H6l3.5 3.5",
  wallet: "M3.5 7.5h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-16zM3.5 7.5 16 4v3.5M16.5 14h2",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5",
  logout: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "chevron-left": "M15 5l-7 7 7 7",
  "chevron-right": "M9 5l7 7-7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  close: "M6 6l12 12M18 6 6 18",
  mail: "M3.5 6h17v12h-17zM4 7l8 6.5L20 7",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.6-4 3.5-6 7.5-6s6.9 2 7.5 6",
  ball:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8l3.5 2.5-1.3 4H9.8l-1.3-4zM12 3v5M15.5 10.5 20 9M14.2 14.5l2.8 3.8M9.8 14.5 7 18.3M8.5 10.5 4 9",
  chat: "M4 5h16v11H9.5L5 20v-4H4z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z",
  news: "M5 4.5h11v15H5zM16 8.5h3.5v9a2 2 0 0 1-2 2H5M8 8.5h5M8 12h5M8 15.5h3",
  pin: "M12 21s6.5-5.7 6.5-11a6.5 6.5 0 1 0-13 0c0 5.3 6.5 11 6.5 11zM12 12a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z",
  upload: "M12 16V5M7 9.5 12 4.5l5 5M5 19.5h14",
  warning: "M12 4l9 16H3zM12 10v4.5M12 17.2v.1",
  pen: "M4 20l1-4L16.5 4.5l3 3L8 19zM14 7l3 3",
} as const;

export type IconName = keyof typeof paths;

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export default function Icon({ name, size = 18, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
