"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { MetricCard } from "@/components/ui/metric-card";
import {
  analisarFormatos, distribuicaoQtds,
} from "@/lib/insights";
import { dezenasDe, formatoColuna, formatoLinha } from "@/lib/lottery";
import { cn } from "@/lib/utils";

export default function EstatisticasFormato() {
  const [conc, setConc] = useState(3674);
  const [retros, setRetros] = useState(30);
  const [hist, setHist] = useState<{ c: number; dez: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

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

  const formatosL = useMemo(() => analisarFormatos(hist, formatoLinha), [hist]);
  const formatosC = useMemo(() => analisarFormatos(hist, formatoColuna), [hist]);
  const distL = useMemo(() => distribuicaoQtds(hist, false), [hist]);
  const distC = useMemo(() => distribuicaoQtds(hist, true), [hist]);

  const dentro234L = hist.filter(({ dez }) => {
    const fmt = formatoLinha(dez);
    return fmt.split("").every((c) => ["2","3","4"].includes(c));
  }).length;
  const dentro234C = hist.filter(({ dez }) => {
    const fmt = formatoColuna(dez);
    return fmt.split("").every((c) => ["2","3","4"].includes(c));
  }).length;
  const dentro234Ambos = hist.filter(({ dez }) => {
    const fl = formatoLinha(dez);
    const fc = formatoColuna(dez);
    return [...fl, ...fc].every((c) => ["2","3","4"].includes(c));
  }).length;

  return (
    <>
      <PageHeader
        icon={<BarChart3 size={28} />}
        title="Estatísticas de Formato"
        subtitle="Frequência, atraso e índice dos formatos linha e coluna nos últimos N concursos."
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
          <div className="md:col-span-7 text-xs text-[#5C7080] md:text-right">
            {loading
              ? <span className="flex items-center gap-2 justify-end"><Loader2 className="animate-spin" size={14}/> Buscando...</span>
              : <>Analisando <strong>{hist.length}</strong> concursos ({hist[0]?.c}–{hist[hist.length - 1]?.c})</>}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="Resultados pesquisados" value={hist.length} />
        <MetricCard
          label="Dentro 2/3/4 em ambas"
          value={dentro234Ambos}
          sub={`${(dentro234Ambos/Math.max(1,hist.length)*100).toFixed(0)}% dos casos`}
        />
        <MetricCard
          label="Linhas / Colunas"
          value={`${dentro234L} / ${dentro234C}`}
          sub="dentro 2/3/4"
        />
      </div>

      {/* Distribuição por linha */}
      <SectionTitle>Frequência absoluta — Qtd dezenas por Linha</SectionTitle>
      <DistribTable matriz={distL} prefixo="L" />

      {/* Distribuição por coluna */}
      <SectionTitle>Frequência absoluta — Qtd dezenas por Coluna</SectionTitle>
      <DistribTable matriz={distC} prefixo="C" />

      {/* Top formatos linha */}
      <SectionTitle>Estatística de Formatos Linha</SectionTitle>
      <FormatosTable items={formatosL} />

      {/* Top formatos coluna */}
      <SectionTitle>Estatística de Formatos Coluna</SectionTitle>
      <FormatosTable items={formatosC} />
    </>
  );
}

function DistribTable({ matriz, prefixo }: { matriz: number[][]; prefixo: "L" | "C" }) {
  return (
    <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden mb-6">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA]">
          <tr>
            <th className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-left border-b border-[#DDE8EC]">
              Qtd dezenas
            </th>
            {[1,2,3,4,5].map((i) => (
              <th key={i} className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">
                {prefixo}{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matriz.map((linha, k) => (
            <tr
              key={k}
              className={cn(
                "border-b border-[#F2F6F8] last:border-0",
                k % 2 === 1 && "bg-[#FBFDFE]"
              )}
            >
              <td className="px-3 py-2 font-semibold text-cyan-700">{k} dezena{k===1?"":"s"}</td>
              {linha.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-2 text-center tabular-nums font-bold",
                    v === 0 && "text-[#C8D4DA]",
                    v > 0 && "text-[#0F1B2D]"
                  )}
                >
                  {v.toString().padStart(2, "0")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormatosTable({ items }: {
  items: { fmt: string; freq: number; atraso: number; indice: number }[];
}) {
  return (
    <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden mb-6 max-h-[400px] overflow-y-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead className="bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA] sticky top-0">
          <tr>
            <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Formato</th>
            <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Frequência</th>
            <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Atraso</th>
            <th className="px-4 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">Índice</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr
              key={it.fmt}
              className={cn(
                "border-b border-[#F2F6F8] last:border-0",
                i % 2 === 1 && "bg-[#FBFDFE]"
              )}
            >
              <td className="px-4 py-2 text-center font-mono font-bold text-cyan-700 tracking-wider">{it.fmt}</td>
              <td className="px-4 py-2 text-center font-bold tabular-nums">{it.freq}</td>
              <td className="px-4 py-2 text-center tabular-nums text-orange-600 font-bold">{it.atraso}</td>
              <td className="px-4 py-2 text-center font-bold tabular-nums">{it.indice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
