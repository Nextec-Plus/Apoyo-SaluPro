"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ComboboxItem {
  id: string;
  label: string;
}

interface ComboboxProps {
  items: ComboboxItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  createLabel?: string;
  createPlaceholder?: string;
  onCreate?: (name: string) => Promise<string | null>;
  className?: string;
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder = "Seleccione...",
  disabled = false,
  emptyText = "Sin resultados.",
  createLabel,
  createPlaceholder,
  onCreate,
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((it) => it.id === value);
  const displayText = selectedItem?.label ?? placeholder;

  const filtered = search.trim()
    ? items.filter((it) => it.label.toLowerCase().includes(search.toLowerCase().trim()))
    : items;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setCreating(false);
      setSearch("");
    },
    [onChange],
  );

  const handleCreate = useCallback(async () => {
    if (!createName.trim() || !onCreate) return;
    setSubmitting(true);
    try {
      const newId = await onCreate(createName.trim());
      if (newId) {
        onChange(newId);
        setOpen(false);
        setCreating(false);
        setSearch("");
        setCreateName("");
      }
    } finally {
      setSubmitting(false);
    }
  }, [createName, onCreate, onChange]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(!open); setSearch(""); setCreating(false); } }}
        className={[
          "w-full text-sm text-left bg-white border border-border rounded-lg px-3 py-2.5",
          "transition-colors",
          disabled
            ? "bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed"
            : value
              ? "text-gray-900"
              : "text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary",
        ].join(" ")}
      >
        <span className="block truncate pr-4">{displayText}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          {!creating && (
            <>
              <div className="p-2 border-b border-border">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full text-sm bg-gray-50 border border-border rounded-md px-3 py-1.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-ring"
                />
              </div>
              <ul className="max-h-48 overflow-y-auto py-1">
                {filtered.length === 0 && !search.trim() && (
                  <li className="px-3 py-2 text-sm text-gray-400">{emptyText}</li>
                )}
                {filtered.length === 0 && search.trim() && (
                  <li className="px-3 py-2 text-sm text-gray-400">Sin resultados.</li>
                )}
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={[
                        "w-full text-left px-3 py-2 text-sm transition-colors",
                        item.id === value
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-gray-700 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
              {onCreate && createLabel && (
                <div className="border-t border-border p-1">
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="w-full text-left px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 rounded transition-colors"
                  >
                    + {createLabel}
                  </button>
                </div>
              )}
            </>
          )}

          {creating && onCreate && (
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {createLabel}
              </p>
              <input
                autoFocus
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={createPlaceholder ?? "Nombre"}
                className="w-full text-sm bg-white border border-border rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting || !createName.trim()}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-sm py-2.5 rounded-lg disabled:opacity-60 transition-colors"
                >
                  {submitting ? "Creando..." : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setCreateName(""); }}
                  className="px-4 text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
