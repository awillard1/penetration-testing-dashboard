import { useRef, useState } from "react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  insertOptions?: Array<{ label: string; value: string }>;
}

export default function MarkdownEditor({ label, value, onChange, placeholder, rows = 6, insertOptions = [] }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedInsert, setSelectedInsert] = useState("");

  const applyFormat = (prefix: string, suffix = prefix, fallback = "text") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const nextValue = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const insertText = (text: string) => {
    if (!text) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + text.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs text-gray-400">{label}</label>}
      <div className="rounded border border-gray-700 overflow-hidden bg-gray-800">
        <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700 flex-wrap">
          <ToolbarButton onClick={() => applyFormat("**", "**")}>Bold</ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("*", "*")}>Italic</ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("## ", "", "Heading")}>Heading</ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("- ", "", "List item")}>List</ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("1. ", "", "List item")}>Numbered</ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("`", "`", "code")}>Code</ToolbarButton>
          <ToolbarButton onClick={() => applyFormat("[", "](https://example.com)", "link text")}>Link</ToolbarButton>
          {insertOptions.length > 0 && (
            <>
              <select
                value={selectedInsert}
                onChange={(e) => setSelectedInsert(e.target.value)}
                className="text-[11px] px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-300"
              >
                <option value="">Insert evidence…</option>
                {insertOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ToolbarButton onClick={() => insertText(selectedInsert)}>Insert</ToolbarButton>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="ml-auto text-[11px] px-2 py-1 rounded text-gray-300 hover:bg-gray-700"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>
        {showPreview ? (
          <div className="p-3 min-h-24 max-h-72 overflow-auto markdown-content text-sm text-gray-200">
            {value ? (
              <ReactMarkdown
                components={{
                  a: ({ ...props }) => <a {...props} className="text-brand-400 hover:text-brand-300 underline" target="_blank" rel="noreferrer" />,
                  code: ({ ...props }) => <code {...props} className="bg-gray-900 rounded px-1 py-0.5 text-xs" />,
                  img: ({ ...props }) => <img {...props} className="max-h-56 rounded border border-gray-700 mt-2" />,
                  p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                  ul: ({ ...props }) => <ul {...props} className="list-disc pl-5 mb-2" />,
                  ol: ({ ...props }) => <ol {...props} className="list-decimal pl-5 mb-2" />,
                  h1: ({ ...props }) => <h1 {...props} className="text-base font-semibold mt-2 mb-1" />,
                  h2: ({ ...props }) => <h2 {...props} className="text-sm font-semibold mt-2 mb-1" />,
                  h3: ({ ...props }) => <h3 {...props} className="text-sm font-semibold mt-2 mb-1" />,
                }}
              >
                {value}
              </ReactMarkdown>
            ) : <span className="text-gray-500">Nothing to preview yet.</span>}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className={clsx(
              "w-full bg-gray-800 text-gray-100 text-sm px-3 py-2 rounded-none border-0 focus:outline-none resize-y"
            )}
          />
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded text-gray-300 hover:bg-gray-700"
    >
      {children}
    </button>
  );
}
