export function StatusBadge({ success, statusCode }: { success: boolean; statusCode: number | null }) {
  if (success) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-300">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        {statusCode ?? '—'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-300">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      {statusCode ?? 'ERR'}
    </span>
  );
}
