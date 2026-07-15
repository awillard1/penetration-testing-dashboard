import clsx from "clsx";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-900 text-red-300 border-red-800",
  high: "bg-orange-900 text-orange-300 border-orange-800",
  medium: "bg-yellow-900 text-yellow-300 border-yellow-800",
  low: "bg-blue-900 text-blue-300 border-blue-800",
  informational: "bg-gray-800 text-gray-300 border-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-800 text-gray-300",
  confirmed: "bg-blue-900 text-blue-300",
  "ready for report": "bg-green-900 text-green-300",
  reported: "bg-purple-900 text-purple-300",
  closed: "bg-gray-900 text-gray-500",
  "false positive": "bg-gray-800 text-gray-400",
  complete: "bg-green-900 text-green-300",
  active: "bg-green-900 text-green-300",
  planning: "bg-blue-900 text-blue-300",
  archived: "bg-gray-900 text-gray-500",
};

interface BadgeProps {
  label: string;
  colorMap?: Record<string, string>;
  className?: string;
}

export function Badge({ label, colorMap = {}, className }: BadgeProps) {
  const color = colorMap[label.toLowerCase()] ?? "bg-gray-800 text-gray-300";
  return (
    <span className={clsx("px-2 py-0.5 rounded text-xs font-medium border border-transparent", color, className)}>
      {label.toUpperCase()}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge label={severity} colorMap={SEV_COLORS} />;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge label={status} colorMap={STATUS_COLORS} />;
}
