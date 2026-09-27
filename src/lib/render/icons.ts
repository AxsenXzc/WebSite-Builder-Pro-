import { el, type El } from "./node";

/**
 * Icone SVG inline.
 *
 * Non possono arrivare da lucide-react: l'export statico è HTML puro e non ha
 * React. Qui l'icona è un albero `El`, quindi React e HTML la rendono identica.
 */

const PATHS: Record<string, string[]> = {
  check: ["M4 12.5l5 5L20 6.5"],
  arrowRight: ["M5 12h14", "M13 6l6 6-6 6"],
  arrowUpRight: ["M7 17L17 7", "M8 7h9v9"],
  arrowDown: ["M12 5v14", "M6 13l6 6 6-6"],
  phone: [
    "M5 3h3.5l1.8 4.5-2.2 1.6a12 12 0 0 0 6.8 6.8l1.6-2.2L21 15.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z",
  ],
  mail: ["M3 6h18v12H3z", "M3 7l9 6 9-6"],
  mapPin: ["M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.5V12l3 2"],
  calendar: ["M4 6h16v14H4z", "M4 10h16", "M8 3.5v4", "M16 3.5v4"],
  sparkles: ["M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z", "M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"],
  shield: ["M12 3l7.5 3v6c0 4.3-3.1 7.6-7.5 9-4.4-1.4-7.5-4.7-7.5-9V6z"],
  zap: ["M13 3L5.5 13.5H11l-1.5 7.5L18 10.5h-5.5z"],
  users: [
    "M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M2.5 20.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5",
    "M16 4.6a3.5 3.5 0 0 1 0 6.8",
    "M17.5 15.2c2.4.5 4 2.4 4 5.3",
  ],
  heart: ["M12 20s-7-4.4-7-9.4A4 4 0 0 1 12 7.6 4 4 0 0 1 19 10.6c0 5-7 9.4-7 9.4z"],
  leaf: ["M4 20c0-8 6-14 16-14 0 10-6 14-11 14H4z", "M4 20c3-4 6-6 10-8"],
  award: ["M12 15a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z", "M8.5 14.5L7 22l5-2.5L17 22l-1.5-7.5"],
  star: ["M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z"],
  quote: ["M9 7H5v5h4v5H5", "M19 7h-4v5h4v5h-4"],
  message: ["M4 5h16v11H9l-5 4z"],
  play: ["M8 5.5l11 6.5-11 6.5z"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M3.5 9h17", "M3.5 15h17", "M12 3c2.5 2.4 2.5 15.6 0 18", "M12 3c-2.5 2.4-2.5 15.6 0 18"],
  scissors: ["M7 4l10 10", "M17 4L7 14", "M7.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M16.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  utensil: ["M7 3v8a2.5 2.5 0 0 0 5 0V3", "M9.5 11v10", "M17 3c1.5 2 1.5 5 0 7v11"],
  scale: ["M12 4v16", "M5 8h14", "M5 8l-2.5 6h5z", "M19 8l-2.5 6h5z"],
  activity: ["M3 12h4l2.5-6 4 12L16 12h5"],
  briefcase: ["M4 8h16v11H4z", "M9 8V5.5h6V8", "M4 13h16"],
  code: ["M9 8l-5 4 5 4", "M15 8l5 4-5 4"],
  truck: ["M3 7h11v9H3z", "M14 10h4l3 3v3h-7z", "M7 19a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 7 19z", "M17.5 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"],
  lock: ["M6 11h12v10H6z", "M9 11V8a3 3 0 0 1 6 0v3"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  chevronDown: ["M6 9.5l6 6 6-6"],
  chevronRight: ["M9.5 6l6 6-6 6"],
  language: ["M4 6h9", "M8.5 4v2c0 4-2 7-4.5 9", "M6 12c1.5 3 4 5 7 6", "M13 20l4-10 4 10", "M14.6 17h4.8"],
};

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function hasIcon(name: string): name is IconName {
  return name in PATHS;
}

/** Icona come albero `El`: identica in anteprima React e nell'HTML esportato. */
export function icon(name: string, size = 20, extraClass?: string): El {
  const paths = PATHS[name] ?? PATHS.sparkles;
  return el(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: extraClass ? `atl-icon ${extraClass}` : "atl-icon",
      "aria-hidden": "true",
      focusable: "false",
    },
    ...paths.map((d) => el("path", { d })),
  );
}
