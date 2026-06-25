"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";

type VictimDocument = {
  name: string;
  path: string;
  signedUrl: string;
};

function isImage(name: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name);
}

type VictimDocumentsProps = {
  victimId: string;
  organizationId: string;
  variant?: "default" | "panel";
};

export function VictimDocuments({
  victimId,
  organizationId,
  variant = "default",
}: VictimDocumentsProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<VictimDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/catastrophe/victims/${victimId}/documents?organization_id=${organizationId}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al cargar documentos");
      setDocs(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, [victimId, organizationId, toast]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("organization_id", organizationId);
      try {
        const res = await fetch(`/api/catastrophe/victims/${victimId}/documents`, {
          method: "POST",
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Error al subir archivo");
        uploaded++;
      } catch (err) {
        toast.error(
          `${file.name}: ${err instanceof Error ? err.message : "Error al subir"}`,
        );
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} archivo${uploaded > 1 ? "s" : ""} subido${uploaded > 1 ? "s" : ""}`);
      await loadDocs();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (path: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch(
        `/api/catastrophe/victims/${victimId}/documents?path=${encodeURIComponent(path)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al eliminar");
      toast.success("Documento eliminado");
      setDocs((prev) => prev.filter((d) => d.path !== path));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const isPanel = variant === "panel";

  return (
    <div className={isPanel ? "flex flex-col h-full min-h-0 gap-3" : "space-y-4"}>
      <div className={`flex items-center justify-between gap-3 ${isPanel ? "shrink-0" : "flex-wrap"}`}>
        {!isPanel && (
          <p className="text-xs text-gray-500">
            Imágenes y documentos asociados al paciente (PDF, fotos, recetas, etc.)
          </p>
        )}
        {isPanel && (
          <p className="text-sm font-semibold text-gray-800">Documentos e imágenes</p>
        )}
        <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark border border-primary/30 rounded-lg px-3 py-2 bg-primary/5 transition-colors shrink-0 ml-auto">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => handleUpload(e.target.files)}
          />
          {uploading ? "Subiendo…" : "📎 Subir archivos"}
        </label>
      </div>

      {loading ? (
        <p className={`text-sm text-gray-400 text-center ${isPanel ? "flex-1 flex items-center justify-center" : "py-4"}`}>
          Cargando documentos…
        </p>
      ) : docs.length === 0 ? (
        <label className={`cursor-pointer flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-xl bg-white/60 hover:bg-white hover:border-primary/40 transition-colors ${isPanel ? "flex-1 min-h-[200px] p-8" : "py-8 px-4"}`}>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => handleUpload(e.target.files)}
          />
          <span className="text-3xl mb-2 opacity-40">📎</span>
          <p className="text-sm font-medium text-gray-600">Sin documentos adjuntos</p>
          <p className="text-xs text-gray-400 mt-1">Haz clic para subir fotos, PDFs o recetas</p>
        </label>
      ) : (
        <div
          className={`grid gap-3 ${
            isPanel
              ? "flex-1 min-h-0 overflow-y-auto content-start grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 auto-rows-max"
              : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
          }`}
        >
          {docs.map((doc) => (
            <div
              key={doc.path}
              className="group relative bg-muted border border-border rounded-lg overflow-hidden"
            >
              {isImage(doc.name) ? (
                <button
                  type="button"
                  onClick={() => setLightbox(doc.signedUrl)}
                  className="block w-full aspect-square"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={doc.signedUrl}
                    alt={doc.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center aspect-square p-3 text-center hover:bg-white transition-colors"
                >
                  <span className="text-2xl mb-1">📄</span>
                  <span className="text-[10px] text-gray-600 line-clamp-2 break-all">{doc.name}</span>
                </a>
              )}
              <div className="px-2 py-1.5 border-t border-border bg-white flex items-center justify-between gap-1">
                <span className="text-[10px] text-gray-500 truncate flex-1" title={doc.name}>
                  {doc.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.path, doc.name)}
                  className="text-[10px] text-crisis opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Vista ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/** Selector de archivos para usar antes de crear el paciente (ficha médica). */
export function DocumentPicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    onChange(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark border border-primary/30 rounded-lg px-3 py-2 bg-primary/5 transition-colors">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        📎 Agregar documentos o imágenes
      </label>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 text-xs bg-white border border-border rounded-lg px-3 py-2"
            >
              <span>{/\.(jpe?g|png|gif|webp)$/i.test(f.name) ? "🖼️" : "📄"}</span>
              <span className="flex-1 truncate text-gray-700">{f.name}</span>
              <span className="text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-crisis hover:text-crisis/80 shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function uploadVictimDocuments(
  victimId: string,
  organizationId: string,
  files: File[],
): Promise<{ uploaded: number; errors: string[] }> {
  let uploaded = 0;
  const errors: string[] = [];

  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    form.append("organization_id", organizationId);
    try {
      const res = await fetch(`/api/catastrophe/victims/${victimId}/documents`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al subir");
      uploaded++;
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : "Error"}`);
    }
  }

  return { uploaded, errors };
}
