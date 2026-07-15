import clsx from "clsx";
import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-400">{label}</label>}
      <input
        className={clsx(
          "bg-gray-800 text-gray-100 text-sm px-3 py-1.5 rounded border focus:outline-none focus:border-brand-500",
          error ? "border-red-500" : "border-gray-700",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-400">{label}</label>}
      <select
        className={clsx(
          "bg-gray-800 text-gray-100 text-sm px-3 py-1.5 rounded border focus:outline-none focus:border-brand-500",
          error ? "border-red-500" : "border-gray-700",
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-400">{label}</label>}
      <textarea
        className={clsx(
          "bg-gray-800 text-gray-100 text-sm px-3 py-2 rounded border focus:outline-none focus:border-brand-500 resize-y",
          error ? "border-red-500" : "border-gray-700",
          className
        )}
        rows={4}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
