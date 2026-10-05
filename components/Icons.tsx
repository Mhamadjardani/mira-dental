import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const Logo = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
    <rect width="40" height="40" rx="12" fill="#0f766e" />
    <path
      d="M13.5 12.5c-2.6 0-4.3 2.2-3.9 5.1.4 3 1.6 4.4 2.3 7.6.6 2.6 1.2 4.4 2.6 4.4 1.6 0 1.9-2.4 2.4-4.4.4-1.7 1-2.6 3.1-2.6s2.7.9 3.1 2.6c.5 2 .8 4.4 2.4 4.4 1.4 0 2-1.8 2.6-4.4.7-3.2 1.9-4.6 2.3-7.6.4-2.9-1.3-5.1-3.9-5.1-2.2 0-3.3 1.4-6.5 1.4s-4.3-1.4-6.5-1.4Z"
      fill="#fff"
    />
    <path d="M16 18.2c1.3 1 2.6 1.4 4 1.4s2.7-.4 4-1.4" stroke="#0f766e" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </svg>
);

export const ServiceIcon = ({ name, size = 22 }: { name: string; size?: number }) => {
  const p = base(size);
  switch (name) {
    case "sparkle":
      return (
        <svg {...p} aria-hidden>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p} aria-hidden>
          <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "root":
      return (
        <svg {...p} aria-hidden>
          <path d="M8 4c-2 0-3 1.6-2.7 3.8.3 2.2 1.3 3.2 1.7 5.6.4 2 .8 3.6 1.8 3.6s1.3-1.8 1.6-3.3c.3-1.3.7-2 1.6-2s1.3.7 1.6 2c.3 1.5.6 3.3 1.6 3.3s1.4-1.6 1.8-3.6c.4-2.4 1.4-3.4 1.7-5.6C19 5.6 18 4 16 4c-1.6 0-2.4 1-4 1s-2.4-1-4-1Z" />
          <path d="M12 9v5" />
        </svg>
      );
    case "brace":
      return (
        <svg {...p} aria-hidden>
          <rect x="3" y="8" width="18" height="8" rx="4" />
          <path d="M7 8v8M12 8v8M17 8v8M3 12h18" />
        </svg>
      );
    case "child":
      return (
        <svg {...p} aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M10.5 8.5h.01M13.5 8.5h.01M10.6 10.3c.8.6 2 .6 2.8 0M6 21c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5" />
        </svg>
      );
    case "implant":
      return (
        <svg {...p} aria-hidden>
          <path d="M8 3h8l-1 5H9L8 3Z" />
          <path d="M9.5 8h5M10 11h4M10 14h4M10.5 17h3M11 20h2" />
        </svg>
      );
    default:
      return (
        <svg {...p} aria-hidden>
          <path d="M8 4c-2 0-3 1.6-2.7 3.8.3 2.2 1.3 3.2 1.7 5.6.4 2 .8 4.6 1.8 4.6s1.3-2.8 1.6-4.3c.3-1.3.7-2 1.6-2s1.3.7 1.6 2c.3 1.5.6 4.3 1.6 4.3s1.4-2.6 1.8-4.6c.4-2.4 1.4-3.4 1.7-5.6C19 5.6 18 4 16 4c-1.6 0-2.4 1-4 1s-2.4-1-4-1Z" />
        </svg>
      );
  }
};

export const Icon = {
  Calendar: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  Clock: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Pin: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  Phone: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  ),
  Mail: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  Chat: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.4A8 8 0 1 1 21 12Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  ),
  Mic: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  ),
  Speaker: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
    </svg>
  ),
  Send: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" />
    </svg>
  ),
  Close: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Check: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  ),
  Arrow: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden className={`rtl:-scale-x-100 ${r.className ?? ""}`}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Menu: ({ size, ...r }: P) => (
    <svg {...base(size)} {...r} aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
};
