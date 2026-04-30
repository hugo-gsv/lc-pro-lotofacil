export function Sparkline({
  value,
  vmin,
  vmax,
}: {
  value: number;
  vmin: number;
  vmax: number;
}) {
  const frac = Math.max(0, Math.min(1, (value - vmin) / (vmax - vmin || 1)));
  const distToCenter = Math.abs(frac - 0.5) * 2;
  const isCenter = distToCenter <= 0.15;
  const markerColor = isCenter ? "#14C6E4" : "#FF6B35";

  return (
    <div className="relative w-full h-[22px]">
      {/* Trilho */}
      <div
        className="absolute top-1/2 left-0 right-0 h-[3px] rounded -translate-y-1/2"
        style={{
          background: "linear-gradient(90deg, #E0EAEE, #C8D4DA, #E0EAEE)",
        }}
      />
      {/* 5 ticks */}
      {[0, 25, 50, 75, 100].map((p) => (
        <div
          key={p}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${p}%`,
            width: 1,
            height: 7,
            background: "#B5C3CB",
          }}
        />
      ))}
      {/* Linha central */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded"
        style={{
          width: 2.5,
          height: 14,
          background: "#0095B6",
          boxShadow: "0 0 6px rgba(20,198,228,.35)",
        }}
      />
      {/* Marker */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-[2.5px]"
        style={{
          left: `${frac * 100}%`,
          width: 14,
          height: 14,
          borderColor: markerColor,
          boxShadow: `0 2px 6px ${
            isCenter ? "rgba(20,198,228,.45)" : "rgba(255,107,53,.45)"
          }`,
        }}
      >
        <div
          className="absolute inset-[3px] rounded-full"
          style={{ background: markerColor }}
        />
      </div>
    </div>
  );
}
