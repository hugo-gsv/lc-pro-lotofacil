export function Hero({
  title,
  subtitle,
  brand,
}: {
  title: string;
  subtitle?: string;
  brand?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl px-12 py-12 text-white mb-7"
      style={{
        background:
          "linear-gradient(135deg, #006B82 0%, #0095B6 35%, #14C6E4 100%)",
        boxShadow:
          "0 20px 60px rgba(20,198,228,.3), 0 1px 0 rgba(255,255,255,.25) inset",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, rgba(255,255,255,.18) 0%, transparent 35%), radial-gradient(circle at 0% 100%, rgba(0,0,0,.12) 0%, transparent 45%)",
        }}
      />
      <div
        className="absolute -right-8 -top-8 text-[260px] opacity-[.08] pointer-events-none"
        style={{ transform: "rotate(-12deg)" }}
      >
        🎯
      </div>
      <div className="relative">
        {brand && (
          <div className="text-[11px] uppercase tracking-[4px] font-bold opacity-90 mb-3">
            {brand}
          </div>
        )}
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-balance leading-[1.05]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-lg font-medium opacity-95 max-w-[640px] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
