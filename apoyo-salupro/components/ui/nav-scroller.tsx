"use client";

import { Children, cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

/**
 * Fila de tabs con scroll horizontal sin scrollbar nativa. Muestra flechas
 * y un fade en los bordes solo cuando hay contenido oculto, para que nunca
 * se sienta "cortado" sin ninguna pista de que hay más tabs. scroll-snap
 * asegura que en reposo siempre se vea una tab completa, nunca una palabra
 * cortada a la mitad.
 */
export function NavScroller({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", update); };
  }, [update]);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.6, behavior: "smooth" });
  };

  const snappedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ className?: string }>;
    return cloneElement(el, {
      className: `${el.props.className ?? ""} snap-start`.trim(),
    });
  });

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory"
        style={{
          maskImage: `linear-gradient(to right, ${canLeft ? "transparent" : "black"} 0, black 24px, black calc(100% - 24px), ${canRight ? "transparent" : "black"} 100%)`,
          WebkitMaskImage: `linear-gradient(to right, ${canLeft ? "transparent" : "black"} 0, black 24px, black calc(100% - 24px), ${canRight ? "transparent" : "black"} 100%)`,
        }}
      >
        {snappedChildren}
      </div>
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Desplazar a la izquierda"
          className="absolute left-0 top-0 bottom-0 flex items-center px-1 bg-gradient-to-r from-white via-white/90 to-transparent text-gray-400 hover:text-gray-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 010 1.06L8.832 10.29a.75.75 0 000 1.06l3.958 4.002a.75.75 0 11-1.06 1.06L7.77 12.41a2.25 2.25 0 010-3.18l3.96-4.001a.75.75 0 011.06.001z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Desplazar a la derecha"
          className="absolute right-0 top-0 bottom-0 flex items-center px-1 bg-gradient-to-l from-white via-white/90 to-transparent text-gray-400 hover:text-gray-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 010-1.06l3.96-3.999a.75.75 0 000-1.06L7.21 5.65a.75.75 0 111.08-1.04l3.96 4.001a2.25 2.25 0 010 3.18l-3.96 4a.75.75 0 01-1.08-.02z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}
