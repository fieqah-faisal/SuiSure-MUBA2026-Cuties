import * as React from "react";
import {
  FaArrowRight,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaExclamationCircle,
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaFileVideo,
  FaShieldAlt,
  FaTimes,
} from "react-icons/fa";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type FileStatus = "queued" | "uploading" | "done" | "error";

export interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
}

export interface FileUploaderProps {
  title?: string;
  description?: string;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedLabel?: string;
  submitLabel?: string;
  cancelLabel?: string;
  footerNote?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit?: (files: File[]) => void;
  onCancel?: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileIcon({ file }: { file: File }) {
  const type = file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const className = "h-4 w-4 text-primary";
  if (type.startsWith("image/")) return <FaFileImage className={className} />;
  if (type.startsWith("video/")) return <FaFileVideo className={className} />;
  if (type === "application/pdf" || ext === "pdf") return <FaFilePdf className={className} />;
  return <FaFileAlt className={className} />;
}

export function FileUploader({
  title = "Upload a file",
  description = "Attach a file to continue.",
  accept,
  maxFiles = 1,
  maxSizeMB = 25,
  acceptedLabel = "PNG, JPG · up to 25 MB each",
  submitLabel = "Continue",
  cancelLabel = "Discard",
  footerNote = "256-bit encrypted",
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: FileUploaderProps) {
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const dragCounter = React.useRef(0);

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const allDone = files.length > 0 && files.every((f) => f.status === "done");
  const hasUploading = files.some((f) => f.status === "uploading" || f.status === "queued");
  const isAtLimit = files.length >= maxFiles;

  function simulateUpload(id: string) {
    let progress = 0;
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "uploading" } : f)));
    const interval = setInterval(() => {
      progress += Math.random() * 18 + 8;
      if (progress >= 100) {
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress: 100, status: "done" } : f)),
        );
      } else {
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, progress: Math.min(progress, 99) } : f)),
        );
      }
    }, 120);
  }

  function addFiles(incoming: FileList | File[]) {
    const remaining = maxFiles - files.length;
    const toAdd: UploadedFile[] = Array.from(incoming)
      .filter((f) => f.size <= maxSizeMB * 1024 * 1024)
      .slice(0, remaining)
      .map((file) => ({ id: generateId(), file, progress: 0, status: "queued" as const }));

    setFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((f) => setTimeout(() => simulateUpload(f.id), 80));
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (inputRef.current) inputRef.current.value = "";
  }

  function clearAll() {
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {files.length > 0 ? (
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {files.length} / {maxFiles}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-3 px-4 pb-4">
        {!isAtLimit ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              dragCounter.current += 1;
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              dragCounter.current -= 1;
              if (dragCounter.current === 0) setIsDragging(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dragCounter.current = 0;
              setIsDragging(false);
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors",
              isDragging && "border-primary bg-primary/10",
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <FaCloudUploadAlt className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">
              {isDragging ? "Release to add files" : "Drag & drop or click to browse"}
            </span>
            <span className="text-xs text-muted-foreground">{acceptedLabel}</span>
          </button>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
          }}
        />

        {files.length > 0 ? (
          <ul className="space-y-2">
            {files.map((uf) => (
              <li key={uf.id} className="rounded-2xl border border-border bg-card/60 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                    <FileIcon file={uf.file} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{uf.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(uf.file.size)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {uf.status === "done" ? (
                      <FaCheckCircle className="h-4 w-4 text-success" />
                    ) : null}
                    {uf.status === "error" ? (
                      <FaExclamationCircle className="h-4 w-4 text-critical" />
                    ) : null}
                    {uf.status === "uploading" || uf.status === "queued" ? (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(uf.progress)}%
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${uf.file.name}`}
                      onClick={() => removeFile(uf.id)}
                      className="text-muted-foreground transition-colors hover:text-critical"
                    >
                      <FaTimes className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {uf.status === "uploading" || uf.status === "queued" ? (
                  <Progress value={uf.progress} className="mt-3 h-1" />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {files.length > 0 ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {files.length} file{files.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} total
            </span>
            {!hasUploading ? (
              <button type="button" onClick={clearAll} className="font-medium text-primary">
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-critical">{error}</p> : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FaShieldAlt className="h-3.5 w-3.5" /> {footerNote}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              clearAll();
              onCancel?.();
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            className="flex-1"
            disabled={!allDone || busy}
            onClick={() => onSubmit?.(files.filter((f) => f.status === "done").map((f) => f.file))}
          >
            {submitLabel}
            <FaArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FileUploader;
