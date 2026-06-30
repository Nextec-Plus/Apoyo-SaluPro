"use client";

import React from "react";

const inputCls =
  "w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-colors";

const inputDisabledCls =
  "w-full text-sm bg-gray-100/70 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 text-gray-400 cursor-not-allowed transition-colors";

const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

export function CascadeStep({
  step,
  label,
  active,
  blocked,
  blockHint,
  onBlockedClick,
  children,
}: {
  step: number;
  label: string;
  active: boolean;
  blocked: boolean;
  blockHint?: string;
  onBlockedClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className={[
            "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
            active
              ? "bg-primary text-white"
              : blocked
                ? "bg-gray-200 text-gray-400"
                : "bg-gray-300 text-white",
          ].join(" ")}
        >
          {step}
        </span>
        <label className={`${labelCls} mb-0`}>{label}</label>
      </div>
      <div
        onClick={() => { if (blocked && onBlockedClick) onBlockedClick(); }}
        className={blocked ? "cursor-not-allowed" : ""}
      >
        {children}
      </div>
      {blocked && blockHint && (
        <p className="text-[10px] text-gray-400 leading-tight pl-6.5">↑ {blockHint}</p>
      )}
    </div>
  );
}

export { inputCls, inputDisabledCls, labelCls };
