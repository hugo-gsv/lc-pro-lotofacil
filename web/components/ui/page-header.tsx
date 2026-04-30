import type { ReactNode } from "react";

export function PageHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative bg-white border border-[#DDE8EC] rounded-2xl px-6 py-5 mb-6 shadow-sm overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, #14C6E4 0%, #0095B6 100%)",
        }}
      />
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
          style={{
            background:
              "linear-gradient(135deg, #14C6E4 0%, #0095B6 100%)",
            boxShadow: "0 8px 20px rgba(20,198,228,.3)",
          }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0F1B2D]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm font-medium text-[#5C7080] mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
