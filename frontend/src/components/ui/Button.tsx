import clsx from "clsx";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export default function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-1.5 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500",
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-sm",
        variant === "primary" && "bg-brand-500 text-black hover:bg-brand-600",
        variant === "secondary" && "bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700",
        variant === "danger" && "bg-red-900 text-red-300 hover:bg-red-800 border border-red-800",
        variant === "ghost" && "text-gray-400 hover:text-white hover:bg-gray-800",
        props.disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
