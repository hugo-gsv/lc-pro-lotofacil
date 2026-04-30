import { cn } from "@/lib/utils";

export function LotteryBalls({
  dezenas,
  destacar,
}: {
  dezenas: number[];
  destacar?: Set<number>;
}) {
  return (
    <div
      className="flex flex-wrap gap-3 justify-center p-7 rounded-2xl border border-[#DDE8EC]"
      style={{
        background:
          "radial-gradient(circle at 50% 100%, rgba(20,198,228,.08) 0%, transparent 60%), linear-gradient(180deg, #F8FBFC 0%, #E8F8FB 100%)",
        boxShadow: "inset 0 1px 2px rgba(15,27,45,.03)",
      }}
    >
      {dezenas.map((d) => {
        const dim = destacar && !destacar.has(d);
        return (
          <div
            key={d}
            className={cn(
              "relative w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-[19px] tracking-tight transition-transform hover:scale-110",
              "select-none"
            )}
            style={{
              background: dim
                ? "radial-gradient(circle at 30% 28%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 30%), radial-gradient(circle at 50% 50%, #E8EDF0 0%, #B8C4CC 70%, #9DABB5 100%)"
                : "radial-gradient(circle at 30% 28%, rgba(255,255,255,.45) 0%, rgba(255,255,255,0) 30%), radial-gradient(circle at 50% 50%, #14C6E4 0%, #0095B6 60%, #006B82 100%)",
              color: dim ? "#5C7080" : "white",
              boxShadow: dim
                ? "0 4px 10px rgba(15,27,45,.08), inset -3px -4px 6px rgba(0,0,0,.08), inset 0 1px 2px rgba(255,255,255,.6)"
                : "0 8px 18px rgba(20,198,228,.35), inset -4px -6px 10px rgba(0,0,0,.18), inset 0 1px 2px rgba(255,255,255,.4)",
              textShadow: dim ? "none" : "0 1px 2px rgba(0,0,0,.25)",
            }}
          >
            {d.toString().padStart(2, "0")}
          </div>
        );
      })}
    </div>
  );
}
