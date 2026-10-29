"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export const inputCls =
  "w-full rounded border border-slate-300 bg-white px-2 py-1 text-[13px] text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Text input that keeps local state and commits on blur/Enter, so each keystroke is not an undo step. */
export function TextField({
  value,
  onCommit,
  placeholder,
  className,
  multiline,
  rows = 3,
  ariaLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  ariaLabel?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onCommit(v);
  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        className={clsx(inputCls, className)}
        rows={rows}
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      className={clsx(inputCls, className)}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        e.stopPropagation();
      }}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  className,
  disabled,
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  className?: string;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        className,
      )}
    >
      {children}
    </button>
  );
}
