import Image from "next/image";

/** Crédito de desarrollo — Nextec. Usado en los footers de dashboard e inventario. */
export function DevCredit() {
  return (
    <p className="mt-1.5 flex items-center justify-center">
      <a
        href="https://nextec.plus"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 text-[11px]"
      >
        <span className="text-gray-500">Desarrollado por</span>
        <Image src="/nextec.svg" alt="nextec" width={14} height={14} className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:rotate-90" />
        <span className="font-semibold text-gray-300 group-hover:text-white transition-colors duration-150 tracking-wide lowercase">
          nextec
        </span>
      </a>
    </p>
  );
}
