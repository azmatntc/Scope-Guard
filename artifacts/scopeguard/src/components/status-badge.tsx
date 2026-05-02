import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  SENT: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
  REVISED: { label: "Revision Needed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ACTIVE: { label: "Active", className: "bg-green-50 text-green-700 border-green-200" },
  COMPLETED: { label: "Completed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <Badge variant="outline" className={cn("font-medium text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
