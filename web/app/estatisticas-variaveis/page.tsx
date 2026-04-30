"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { analisarVariaveis, type DezenaStat } from "@/lib/insights";
import { dezenasDe } from "@/lib/lottery";
import { cn } from "@/lib/utils";

export default function EstatisticasVariaveis() {
  const [conc, setConc] = useState(3674);
  const [retros, setRetros] = useState(10);
  const [hist, setHist] = useState<{ c: number; dez: number[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordem, setOrdem] = useState<"dezena" | "freq" | "atraso" | "coef">("dezena");

  useEffect(() => {
    fetch("https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
      { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConc(d.numero + 1))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const start = Math.max(1, conc - retros);
    const end = conc - 1;
    (async () => {
      const promises: Promise<{ c: number; dez: number[] } | null>[] = [];
      for (let n = start; n <= end; n++) {
        promises.push(
          fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${n}`,
            { cache: "force-cache" })
            .then((r) => r.json())
            .then((d) => ({ c: d.numero, dez: dezenasDe(d) }))
            .catch(() => null)
        );
      }
      const results = (await Promise.all(promises)).filter(Boolean) as { c: number; dez: number[] }[];
      if (!cancel) {
        results.sort((a, b) => a.c - b.c);
        setHist(results);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [conc, retros]);

  const stats = useMemo(() => analisarVariaveis(hist), [hist]);
  const ordenadas = useMemo(() => {
    const arr = [...stats];
    if (ordem === "dezena") arr.sort((a, b) => a.dezena - b.dezena);
    if (ordem === "freq") arr.sort((a, b) => b.freq - a.freq);
    if (ordem === "atraso") arr.sort((a, b) => b.atraso - a.atraso);
    if (ordem === "coef") arr.sort((a, b) => b.coef - a.coef);
    return arr;
  }, [stats, ordem]);

  return (
    <>
      <PageHeader
        icon={<Activity size={28} />}
        title="Estatísticas de Variáveis"
        subtitle="Ocorrências, frequência, atraso e coeficiente de cada dezena nos últimos N concursos."
      />

      <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              Para Concurso
            </label>
            <input
              type="number"
              value={conc}
              onChange={(e) => setConc(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              Retros
            </label>
            <input
              type="number"
              value={retros}
              onChange={(e) => setRetros(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              Ordenar por
            </label>
            <div className="flex gap-1">
              {(["dezena","freq","atraso","coef"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrdem(o)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all capitalize",
                    ordem === o
                      ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md"
                      : "bg-white border border-[#DDE8EC] text-[#5C7080] hover:border-cyan-300"
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-3 text-xs text-[#5C7080] md:text-right">
            {loading
              ? <span className="flex items-center gap-2 justify-end"><Loader2 className="animate-spin" size={14}/> Buscando...</span>
              : <>{hist.length} concursos analisados</>}
          </div>
        </div>
      </div>

      <SectionTitle>Análise por Dezena</SectionTitle>
      <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA]">
            <tr>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Dez</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-left border-b border-[#DDE8EC]">Ocorrências (mais antigo → mais recente)</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Freq</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Ats</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Coef</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">P/I</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">B/M</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Pri</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Fib</th>
              <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Mod</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((s, i) => (
              <DezenaRow key={s.dezena} stat={s} zebra={i % 2 === 1} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#5C7080] mt-3">
        <strong>Coeficiente</strong> = índice heurístico baseado em frequência + atraso (quanto maior, mais &quot;quente&quot;).
        <br />
        <strong>P/I</strong>: par/ímpar · <strong>B/M</strong>: borda/miolo · <strong>Pri</strong>: primo · <strong>Fib</strong>: fibonacci · <strong>Mod</strong>: pertence ao conjunto MODAIS.
      </p>
    </>
  );
}

function DezenaRow({ stat, zebra }: { stat: DezenaStat; zebra: boolean }) {
  const c = stat.classif;
  return (
    <tr className={cn("border-b border-[#F2F6F8] last:border-0", zebra && "bg-[#FBFDFE]")}>
      <td className="px-3 py-2 text-center">
        <span className="inline-block w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-extrabold text-xs flex items-center justify-center">
          {stat.dezena.toString().padStart(2, "0")}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-0.5 font-mono text-[11px]">
          {stat.ocorrencias.map((o, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex w-4 h-4 items-center justify-center rounded font-bold",
                o ? "bg-cyan-500 text-white" : "bg-[#F2F6F8] text-[#C8D4DA]"
              )}
            >
              {o ? "X" : "·"}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-center font-bold tabular-nums">{stat.freq}</td>
      <td className={cn(
        "px-3 py-2 text-center font-bold tabular-nums",
        stat.atraso >= 5 ? "text-orange-600" : stat.atraso >= 3 ? "text-yellow-600" : "text-emerald-600"
      )}>{stat.atraso}</td>
      <td className="px-3 py-2 text-center font-bold tabular-nums text-cyan-700">{stat.coef}</td>
      <td className="px-3 py-2 text-center text-xs font-bold">{c.paridade}</td>
      <td className="px-3 py-2 text-center text-xs font-bold">{c.bordaMiolo}</td>
      <td className="px-3 py-2 text-center text-xs">{c.primo ? "✓" : "·"}</td>
      <td className="px-3 py-2 text-center text-xs">{c.fibonacci ? "✓" : "·"}</td>
      <td className="px-3 py-2 text-center text-xs">{c.modal ? "✓" : "·"}</td>
    </tr>
  );
}
