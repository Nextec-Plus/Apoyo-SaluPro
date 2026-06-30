"use client";

const HEART_PATH =
  "M19 14c1.5-1.5 3-3.4 3-5.5A4.5 4.5 0 0 0 12 5.5 4.5 4.5 0 0 0 2 8.5c0 2.1 1.5 4 3 5.5l7 7Z";
const PLUS_PATH = "M12 5v14M5 12h14";
const CROSS_STYLE = "fill-none stroke-current stroke-[2.5] stroke-linecap-round";

export function SaluproLoader({
  size = 64,
  text,
  className = "",
}: {
  size?: number;
  text?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-pulse"
        style={{ animation: "salupulse 1.2s ease-in-out infinite" }}
      >
        <defs>
          <linearGradient id="hlg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        <path
          d={HEART_PATH}
          fill="url(#hlg)"
          stroke="url(#hlg)"
          strokeWidth="0.5"
        />
        <path d={PLUS_PATH} className={CROSS_STYLE} stroke="white" />
      </svg>
      {text && (
        <p className="text-sm font-semibold text-gray-500 animate-pulse">{text}</p>
      )}
      <style jsx>{`
        @keyframes salupulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          15%  { transform: scale(1.18); opacity: 1; }
          30%  { transform: scale(1); opacity: 0.7; }
          45%  { transform: scale(1.1); opacity: 0.85; }
          60%  { transform: scale(1); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
