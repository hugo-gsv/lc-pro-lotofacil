export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="text-[12px] uppercase font-extrabold tracking-[2.5px] text-[#0095B6] whitespace-nowrap">
        {children}
      </div>
      <div className="flex-1 h-[1px] bg-gradient-to-r from-[#DDE8EC] to-transparent" />
    </div>
  );
}
