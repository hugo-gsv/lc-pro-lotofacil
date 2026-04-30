"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, Wand2, ArrowRight, TrendingUp, Flame, Snowflake, Sparkle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { MetricCard } from "@/components/ui/metric-card";
import { dezenasDe } from "@/lib/lottery";
import { cn } from "@/lib/utils";
import type { Sugestao } from "@/lib/insights";

export default function IA() {
  const [conc, setConc] = useState(3674);
  const [retros, setRetros] = useState(30);
  const [pesoTendencia, setPeso] = useState(0.6);
  const [alvoJogos, setAlvo] = useState(10);

  const [hist, setHist] = useState<{ c: number; dez: number[] }[]>([]);
  const [histLongo, setHistLongo] = useState<{ c: number; dez: number[] }[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [sug, setSug] = useState<Sugestao | null>(null);
  const [narrativa, setNarrativa] = useState<string | null>(null);
  const [confianca, setConfianca] = useState<string | null>(null);
  const [intuicao, setIntuicao] = useState<string | null>(null);
  const [multiJ, setMultiJ] = useState<{
    spq: { mediaDasMedias: number; desvioDasMedias: number };
    csn: { mediaDasMedias: number; desvioDasMedias: number };
    soma: { mediaDasMedias: number; desvioDasMedias: number };
    conclusao: string;
    janelas: { concursoFim: number; spqMed: number; csnMed: number; somaMed: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [usarLLM, setUsarLLM] = useState(true);

  useEffect(() => {
    fetch("https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
      { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConc(d.numero + 1))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoadingHist(true);
    const startCurto = Math.max(1, conc - retros);
    const startLongo = Math.max(1, conc - 300); // 300 concursos para análise multi-janela
    const end = conc - 1;
    (async () => {
      const promises: Promise<{ c: number; dez: number[] } | null>[] = [];
      for (let n = startLongo; n <= end; n++) {
        promises.push(
          fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${n}`,
            { cache: "force-cache" })
            .then((r) => r.json())
            .then((d) => ({ c: d.numero, dez: dezenasDe(d) }))
            .catch(() => null)
        );
      }
      const all = (await Promise.all(promises)).filter(Boolean) as { c: number; dez: number[] }[];
      if (!cancel) {
        all.sort((a, b) => a.c - b.c);
        setHistLongo(all);
        setHist(all.filter((r) => r.c >= startCurto));
        setLoadingHist(false);
      }
    })();
    return () => { cancel = true; };
  }, [conc, retros]);

  const analisar = async () => {
    if (hist.length === 0) return;
    setLoading(true);
    setSug(null); setNarrativa(null); setConfianca(null); setIntuicao(null); setMultiJ(null);
    try {
      const endpoint = usarLLM ? "/api/ia/anthropic" : "/api/ia/sugestao";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historico: hist, historicoLongo: histLongo, alvoJogos, pesoTendencia,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro");
      if (usarLLM) {
        setSug(data.sugestao);
        setNarrativa(data.narrativa);
        setConfianca(data.confianca);
        setIntuicao(data.intuicao);
        setMultiJ(data.multiJanela);
      } else {
        setSug(data);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao analisar: " + (e instanceof Error ? e.message : "?"));
    } finally {
      setLoading(false);
    }
  };

  const aplicar = () => {
    if (!sug) return;
    const params = new URLSearchParams({
      target: conc.toString(),
      retros: retros.toString(),
      spqMin: sug.spq.sugMin.toString(),
      spqMax: sug.spq.sugMax.toString(),
      csnMin: sug.csn.sugMin.toString(),
      csnMax: sug.csn.sugMax.toString(),
      somaMin: sug.soma.sugMin.toString(),
      somaMax: sug.soma.sugMax.toString(),
      linhas: sug.topLinhas.map((f) => f.fmt).join(","),
      colunas: sug.topColunas.map((f) => f.fmt).join(","),
    });
    window.location.href = `/gerador?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        icon={<Brain size={28} />}
        title="IA Assistant"
        subtitle="Análise estatística automática para escolha de SPQ, CSN, soma e formatos."
      />

      <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Concurso alvo</label>
            <input type="number" value={conc} onChange={(e) => setConc(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Retros</label>
            <input type="number" value={retros} onChange={(e) => setRetros(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              Peso da tendência (centro): {(pesoTendencia * 100).toFixed(0)}%
            </label>
            <input type="range" min="0" max="1" step="0.1" value={pesoTendencia}
              onChange={(e) => setPeso(parseFloat(e.target.value))}
              className="w-full accent-cyan-600" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Alvo de jogos</label>
            <input type="number" value={alvoJogos} onChange={(e) => setAlvo(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300" />
          </div>
          <div className="md:col-span-3">
            <button
              onClick={analisar}
              disabled={loading || loadingHist || hist.length === 0}
              className={cn(
                "w-full py-2.5 rounded-lg text-sm font-extrabold flex items-center justify-center gap-2 transition-all",
                loading || loadingHist
                  ? "bg-[#F4F8FA] text-[#9DABB5] cursor-not-allowed"
                  : "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-lg shadow-cyan-200 hover:-translate-y-0.5"
              )}
            >
              {loading ? <Loader2 className="animate-spin" size={16}/> : <Wand2 size={16}/>}
              {loading ? "Analisando..." : loadingHist ? "Buscando..." : "🧠 Analisar com IA"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[#5C7080]">
          <strong>Tendência ao centro:</strong> 0% = só média histórica · 100% = força regressão ao centro teórico (SPQ 45, CSN 320, Soma 195).
          Recomendado: 60%.
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={usarLLM}
            onChange={(e) => setUsarLLM(e.target.checked)}
            className="w-4 h-4 accent-cyan-600"
          />
          <span>Usar Claude (Anthropic) para narrativa em linguagem natural + validação multi-janela</span>
        </label>
      </div>

      {narrativa && (
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white flex-shrink-0">
              <Sparkle size={20}/>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <strong className="text-cyan-900">Análise Claude</strong>
                {confianca && (
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full",
                    confianca === "alta" ? "bg-emerald-100 text-emerald-700" :
                    confianca === "media" ? "bg-yellow-100 text-yellow-700" :
                    "bg-orange-100 text-orange-700"
                  )}>Confiança {confianca}</span>
                )}
              </div>
              <p className="text-[#1A2A3A] leading-relaxed text-sm">{narrativa}</p>
              {intuicao && (
                <p className="mt-3 text-xs text-cyan-800 italic border-l-2 border-cyan-400 pl-3">
                  <strong>💡 Intuição:</strong> {intuicao}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {multiJ && (
        <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-cyan-600"/>
            <strong className="text-sm">Validação multi-janela</strong>
            <span className="text-[10px] text-[#5C7080]">
              {multiJ.janelas.length} janelas × 30 concursos
            </span>
          </div>
          <p className="text-sm text-[#1A2A3A] leading-relaxed">{multiJ.conclusao}</p>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <div>
              <div className="text-[#5C7080] uppercase font-bold tracking-wider">SPQ μ das μ</div>
              <div className="font-bold tabular-nums">{multiJ.spq.mediaDasMedias.toFixed(2)} <span className="text-[#5C7080] font-normal">(±{multiJ.spq.desvioDasMedias.toFixed(2)})</span></div>
              <div className="text-[10px] text-emerald-600">centro = 45</div>
            </div>
            <div>
              <div className="text-[#5C7080] uppercase font-bold tracking-wider">CSN μ das μ</div>
              <div className="font-bold tabular-nums">{multiJ.csn.mediaDasMedias.toFixed(0)} <span className="text-[#5C7080] font-normal">(±{multiJ.csn.desvioDasMedias.toFixed(0)})</span></div>
              <div className="text-[10px] text-emerald-600">centro = 320</div>
            </div>
            <div>
              <div className="text-[#5C7080] uppercase font-bold tracking-wider">Soma μ das μ</div>
              <div className="font-bold tabular-nums">{multiJ.soma.mediaDasMedias.toFixed(0)} <span className="text-[#5C7080] font-normal">(±{multiJ.soma.desvioDasMedias.toFixed(1)})</span></div>
              <div className="text-[10px] text-emerald-600">centro = 195</div>
            </div>
          </div>
        </div>
      )}

      {sug && (
        <>
          <SectionTitle>Sugestão da IA</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <FaixaCard
              titulo="SPQ"
              min={sug.spq.sugMin} max={sug.spq.sugMax}
              media={sug.spq.media} ultima={sug.spq.ultimaTendencia}
              centralidade={sug.spq.centralidade}
              razao={sug.spq.razao}
            />
            <FaixaCard
              titulo="CSN"
              min={sug.csn.sugMin} max={sug.csn.sugMax}
              media={sug.csn.media} ultima={sug.csn.ultimaTendencia}
              centralidade={sug.csn.centralidade}
              razao={sug.csn.razao}
            />
            <FaixaCard
              titulo="Soma"
              min={sug.soma.sugMin} max={sug.soma.sugMax}
              media={sug.soma.media} ultima={sug.soma.ultimaTendencia}
              centralidade={sug.soma.centralidade}
              razao={sug.soma.razao}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <FormatosBox titulo="Linhas Inclusas (sugeridas)" items={sug.topLinhas} />
            <FormatosBox titulo="Colunas Inclusas (sugeridas)" items={sug.topColunas} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <DezenasBox titulo="Dezenas Quentes" subtitle="Maior frequência nos últimos N" items={sug.dezenasQuentes} icon={<Flame className="text-orange-500" size={16}/>} />
            <DezenasBox titulo="Dezenas Atrasadas" subtitle="Maior atraso (probabilidade de retorno)" items={sug.dezenasAtrasadas} icon={<Snowflake className="text-cyan-500" size={16}/>} />
          </div>

          <SectionTitle>Razões da decisão</SectionTitle>
          <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
            <ul className="space-y-2">
              {sug.razoesGerais.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <TrendingUp size={16} className="text-cyan-600 flex-shrink-0 mt-0.5"/>
                  <span className="text-[#1A2A3A]">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={aplicar}
              className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-extrabold rounded-xl px-6 py-3 text-sm shadow-lg shadow-cyan-200 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              Aplicar e ir ao Gerador <ArrowRight size={16}/>
            </button>
            <Link
              href="/estatisticas-formato"
              className="bg-white border border-[#DDE8EC] text-[#1A2A3A] font-bold rounded-xl px-6 py-3 text-sm hover:border-cyan-300 transition-all flex items-center gap-2"
            >
              Ver estatísticas detalhadas
            </Link>
          </div>
        </>
      )}

      {!sug && !loading && (
        <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl px-5 py-12 text-center">
          <Brain size={48} className="text-cyan-600 mx-auto mb-3"/>
          <p className="text-[#5C7080] max-w-xl mx-auto">
            Clique em <strong>Analisar com IA</strong> para receber sugestões de SPQ, CSN, Soma e formatos
            baseadas em análise estatística dos últimos {retros} concursos.
          </p>
        </div>
      )}
    </>
  );
}

function FaixaCard({ titulo, min, max, media, ultima, centralidade, razao }: {
  titulo: string; min: number; max: number; media: number; ultima: number;
  centralidade: number; razao: string;
}) {
  return (
    <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 shadow-sm">
      <div className="text-[10.5px] uppercase tracking-wider font-extrabold text-[#5C7080] mb-2">
        {titulo}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-extrabold tracking-tight text-[#0F1B2D]">{min}</span>
        <span className="text-[#5C7080] font-bold">—</span>
        <span className="text-3xl font-extrabold tracking-tight text-[#0F1B2D]">{max}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
        <div>
          <div className="text-[#5C7080] uppercase font-bold tracking-wider">Média</div>
          <div className="font-bold tabular-nums">{media.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[#5C7080] uppercase font-bold tracking-wider">Últ. 5</div>
          <div className="font-bold tabular-nums">{ultima.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[#5C7080] uppercase font-bold tracking-wider">Off-center</div>
          <div className={cn(
            "font-bold tabular-nums",
            centralidade > 0.6 ? "text-orange-600" : "text-emerald-600"
          )}>
            {(centralidade * 100).toFixed(0)}%
          </div>
        </div>
      </div>
      <p className="text-xs text-[#5C7080] leading-snug border-t border-[#F2F6F8] pt-3">
        {razao}
      </p>
    </div>
  );
}

function FormatosBox({ titulo, items }: {
  titulo: string;
  items: { fmt: string; freq: number; atraso: number; indice: number }[];
}) {
  return (
    <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[#DDE8EC] bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA]">
        <div className="text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D]">
          {titulo}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#F2F6F8]">
            <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-[#5C7080] text-left">Formato</th>
            <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-[#5C7080] text-center">Freq</th>
            <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-[#5C7080] text-center">Atraso</th>
            <th className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-[#5C7080] text-center">Índice</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f, i) => (
            <tr key={f.fmt} className={cn(
              "border-b border-[#F2F6F8] last:border-0",
              i % 2 === 1 && "bg-[#FBFDFE]"
            )}>
              <td className="px-4 py-2 font-mono font-bold text-cyan-700 tracking-wider">{f.fmt}</td>
              <td className="px-4 py-2 text-center font-bold tabular-nums">{f.freq}</td>
              <td className="px-4 py-2 text-center tabular-nums text-orange-600">{f.atraso}</td>
              <td className="px-4 py-2 text-center font-bold tabular-nums">{f.indice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DezenasBox({ titulo, subtitle, items, icon }: {
  titulo: string;
  subtitle: string;
  items: { dezena: number; freq: number; atraso: number; coef: number }[];
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[#DDE8EC] bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA]">
        <div className="flex items-center gap-2">
          {icon}
          <div className="text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D]">
            {titulo}
          </div>
        </div>
        <div className="text-[10.5px] text-[#5C7080] mt-0.5">{subtitle}</div>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {items.map((d) => (
          <div key={d.dezena}
            className="bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200 rounded-lg px-3 py-2 text-center"
          >
            <div className="font-extrabold text-cyan-800 text-lg leading-none tabular-nums">
              {d.dezena.toString().padStart(2, "0")}
            </div>
            <div className="text-[9px] text-cyan-700 font-bold uppercase tracking-wider mt-1">
              freq {d.freq} · ats {d.atraso}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
