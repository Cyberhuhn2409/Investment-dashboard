import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Base {...p}>
      <path
        d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19v-8.8Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Base>
  );
}

export function GridIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  const f = filled ? "currentColor" : "none";
  return (
    <Base {...p}>
      <rect x="3.5" y="3.5" width="10" height="10" rx="2" fill={f} />
      <rect x="15.5" y="3.5" width="5" height="10" rx="1.6" fill={f} />
      <rect x="3.5" y="15.5" width="6" height="5" rx="1.6" fill={f} />
      <rect x="11.5" y="15.5" width="9" height="5" rx="1.6" fill={f} />
    </Base>
  );
}

export function CompassIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" fill={filled ? "currentColor" : "none"} />
    </Base>
  );
}

export function StarIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Base {...p}>
      <path
        d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.6l-5.1 2.6 1-5.6-4.1-4 5.7-.8L12 3.6Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Base>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Base>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m14.5 5-7 7 7 7" />
    </Base>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m9.5 5 7 7-7 7" />
    </Base>
  );
}

export function ArrowUpIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Base>
  );
}

export function ArrowDownIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Base>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Base>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </Base>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function ExternalIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </Base>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </Base>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.2M12 17v.2" />
    </Base>
  );
}

export function FilterIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 6.5h16M7 12h10M10 17.5h4" />
    </Base>
  );
}

export function RefreshIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
    </Base>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.5A7.5 7.5 0 1 1 20 12Z" />
    </Base>
  );
}

export function NewsIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7 9h10M7 12.5h10M7 16h6" />
    </Base>
  );
}

export function SparkIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </Base>
  );
}

export function ArrowUpRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M7 17 17 7M9 7h8v8" />
    </Base>
  );
}

export function WifiOffIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.5M12 8a14 14 0 0 1 9.5 3.6M2.5 9.6a14 14 0 0 1 3.2-2.1M12 20h.01" />
    </Base>
  );
}

export function LogoMark({ size = 28, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...rest}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M6 19.5h4.2l2.6-8 4.4 13 3.2-9.5 1.6 4.5H26"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
