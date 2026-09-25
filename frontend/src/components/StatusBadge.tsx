import type { CallStatus } from "../types";
import { STATUS_LABEL, STATUS_STYLE } from "../types";

export function StatusBadge({ status }: { status: CallStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
