import { ICON_PATHS, type IconName as MaterialIconName } from "./iconPaths";

const OUTLINE_ICONS = {
  swatch_book: (
    <>
      <rect x="3" y="2" width="7" height="20" rx="2" />
      <path d="m10 4 2.1-1.2a2 2 0 0 1 2.7.7l5 8.7a2 2 0 0 1-.7 2.7L9 21.3M14.7 17H21a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H7" />
      <path d="M6.5 18h.01" />
    </>
  ),
  globe: (
    <g transform="rotate(-15 12 12)">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="12" cy="3" r="1.5" />
        <circle cx="12" cy="21" r="1.5" />
        <circle cx="3" cy="12" r="1.5" />
        <circle cx="21" cy="12" r="1.5" />
      </g>
    </g>
  ),
};

export type IconName = MaterialIconName | keyof typeof OUTLINE_ICONS;

interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      style={{ width: size, height: size, flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {name in OUTLINE_ICONS ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {OUTLINE_ICONS[name as keyof typeof OUTLINE_ICONS]}
        </g>
      ) : (
        <path d={ICON_PATHS[name as MaterialIconName]} />
      )}
    </svg>
  );
}
