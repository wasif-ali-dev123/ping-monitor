type Status = 'connecting' | 'connected' | 'disconnected';

const config: Record<Status, { dot: string; label: string; text: string }> = {
  connecting:   { dot: 'bg-yellow-400 animate-pulse', label: 'bg-yellow-50 text-yellow-700 ring-yellow-300',  text: 'Connecting'    },
  connected:    { dot: 'bg-green-500',                label: 'bg-green-50 text-green-700 ring-green-300',     text: 'Live'          },
  disconnected: { dot: 'bg-red-500',                  label: 'bg-red-50 text-red-700 ring-red-300',           text: 'Disconnected'  },
};

export function ConnectionBadge({ status }: { status: Status }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${c.label}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.text}
    </span>
  );
}
