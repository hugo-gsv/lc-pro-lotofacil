export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="group relative bg-white border border-[#DDE8EC] rounded-2xl px-5 py-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-cyan-200 overflow-hidden">
      <div className="absolute top-0 left-4 right-4 h-[3px] rounded-b-md bg-gradient-to-r from-cyan-400 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="text-[10px] uppercase tracking-[1.4px] font-bold text-[#5C7080]">
        {label}
      </div>
      <div className="text-2xl font-extrabold tracking-tight text-[#0F1B2D] mt-1">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] font-medium text-[#5C7080] mt-1">{sub}</div>
      )}
    </div>
  );
}
