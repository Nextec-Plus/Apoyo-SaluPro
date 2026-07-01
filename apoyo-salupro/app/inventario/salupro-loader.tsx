"use client";

import Image from "next/image";

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
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full bg-primary/20"
          style={{ animation: "salupulse-ring 1.2s ease-in-out infinite" }}
        />
        <Image
          src="/isotipo_salupro_light.png"
          alt="Cargando"
          width={size}
          height={size}
          priority
          className="relative"
          style={{ animation: "salupulse 1.2s ease-in-out infinite" }}
        />
      </div>
      {text && (
        <p className="text-sm font-semibold text-gray-500 animate-pulse">{text}</p>
      )}
      <style jsx>{`
        @keyframes salupulse {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          15%  { transform: scale(1.15); opacity: 1; }
          30%  { transform: scale(1); opacity: 0.75; }
          45%  { transform: scale(1.08); opacity: 0.9; }
          60%  { transform: scale(1); opacity: 0.75; }
        }
        @keyframes salupulse-ring {
          0% { transform: scale(0.85); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(0.85); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
