"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Loader2, Wand2, TrendingUp, Flame, Snowflake, Sparkle, Download, Save, Dices, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import {
  calcVar, csn, dezenasDe, enumerar, formatoColuna, formatoLinha, spq,
} from "@/lib/lottery";
import { cn } from "@/lib/utils";
import type { Sugestao, TreinamentoIA } from "@/lib/insights";

const FICHAS_FIXAS = 5;

export default function IA() {
  const [conc, setConc] = useState(3674);
  const [retros, setRetros] = useState(30);

  const [hist, setHist] = useState<{ c: number; dez: number[] }[]>([]);
  const [histLongo, setHistLongo] = useState<{ c: number; dez: number[] }[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [sug, setSug] = useState<Sugestao | null>(null);
  const [narrativa, setNarrativa] = useState<string | null>(null);
  const [confianca, setConfianca] = useState<string | null>(null);
  const [intuicao, setIntuicao] = useState<string | null>(null);
  const [treinamento, setTreinamento] = useState<TreinamentoIA | null>(null);
  const [multiJ, setMultiJ] = useState<{
    spq: { mediaDasMedias: number; desvioDasMedias: number };
    csn: { mediaDasMedias: number; desvioDasMedias: number };
    soma: { mediaDasMedias: number; desvioDasMedias: number };
    conclusao: string;
    janelas: { concursoFim: number; spqMed: number; csnMed: number; somaMed: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [usarLLM, setUsarLLM] = useState(true);

  // Jogos gerados a partir da sugestão
  const [fichasIA, setFichasIA] = useState<number[][]>([]);
  const [totalGeradoIA, setTotalGeradoIA] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [saveOk, setSaveOk] = useState<number | null>(null);

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
    setSug(null);
    setNarrativa(null);
    setConfianca(null);
    setIntuicao(null);
    setTreinamento(null);
    setMultiJ(null);
    setFichasIA([]);
    setTotalGeradoIA(null);
    try {
      const endpoint = usarLLM ? "/api/ia/anthropic" : "/api/ia/sugestao";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historico: hist, historicoLongo: histLongo, fichasFinais: FICHAS_FIXAS,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro");
      const sugestao = data.sugestao ?? data;
      setSug(sugestao);
      setTreinamento(data.treinamento ?? null);
      setFichasIA(data.carteira?.jogos ?? data.fichas ?? []);
      setTotalGeradoIA(data.carteira?.totalGerado ?? null);
      if (usarLLM) {
        setNarrativa(data.narrativa);
        setConfianca(data.confianca);
        setIntuicao(data.intuicao);
        setMultiJ(data.multiJanela);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao analisar: " + (e instanceof Error ? e.message : "?"));
    } finally {
      setLoading(false);
    }
  };

  // === Geração automática de jogos a partir da sugestão ===
  const jogosCompletos: number[][] = useMemo(() => {
    if (!sug) return [];
    const linhas = sug.topLinhas.map((f) => f.fmt);
    const colunas = sug.topColunas.map((f) => f.fmt);
    if (linhas.length === 0 || colunas.length === 0) return [];
    return enumerar(linhas, colunas, sug.soma.sugMin, sug.soma.sugMax);
  }, [sug]);

  // Ranking automático: 5 fichas finais. A seleção combina ajuste estatístico,
  // variáveis clássicas, quentes/atrasadas e diversidade entre fichas.
  const fichasSelecionadas: number[][] = useMemo(() => {
    if (fichasIA.length > 0) return fichasIA;
    if (!sug || jogosCompletos.length === 0) return [];
    const N = Math.max(1, Math.min(FICHAS_FIXAS, jogosCompletos.length));
    const ultimo = hist.length ? new Set(hist[hist.length - 1].dez) : new Set<number>();

    // Pesos auxiliares
    const pesoQuentes = new Map<number, number>();
    for (const d of sug.dezenasQuentes) pesoQuentes.set(d.dezena, d.freq);
    const pesoAtrasadas = new Map<number, number>();
    for (const d of sug.dezenasAtrasadas) pesoAtrasadas.set(d.dezena, d.atraso);

    const fmtLinhaScore = new Map(sug.topLinhas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35]));
    const fmtColScore = new Map(sug.topColunas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35]));

    const inRangeBonus = (value: number, min: number, max: number, bonus: number) =>
      value >= min && value <= max ? bonus : -Math.min(10, Math.min(Math.abs(value - min), Math.abs(value - max)) * 0.8);
    const bandBonus = (value: number, min: number, max: number, bonus: number) =>
      value >= min && value <= max ? bonus : -Math.min(8, Math.min(Math.abs(value - min), Math.abs(value - max)) * 1.5);

    const scoreBase = (j: number[]) => {
      const fl = formatoLinha(j);
      const fc = formatoColuna(j);
      const soma = j.reduce((a, b) => a + b, 0);
      const hot = j.reduce((s, d) => s + (pesoQuentes.get(d) ?? 0), 0);
      const atraso = j.reduce((s, d) => s + (pesoAtrasadas.get(d) ?? 0), 0);
      const nHot = j.filter((d) => pesoQuentes.has(d)).length;
      const nAtr = j.filter((d) => pesoAtrasadas.has(d)).length;
      const rep = calcVar("Repetição Último", j, ultimo);
      const pares = calcVar("Pares", j);
      const bordas = calcVar("Bordas", j);
      const modas = calcVar("Modas", j);
      const primos = calcVar("Primos", j);
      const fib = calcVar("Fibonacci", j);

      return (
        (fmtLinhaScore.get(fl) ?? 0) +
        (fmtColScore.get(fc) ?? 0) +
        inRangeBonus(spq(fl), sug.linha?.spq.sugMin ?? sug.spq.sugMin, sug.linha?.spq.sugMax ?? sug.spq.sugMax, 10) +
        inRangeBonus(csn(fl), sug.linha?.csn.sugMin ?? sug.csn.sugMin, sug.linha?.csn.sugMax ?? sug.csn.sugMax, 8) +
        inRangeBonus(spq(fc), sug.coluna?.spq.sugMin ?? sug.spq.sugMin, sug.coluna?.spq.sugMax ?? sug.spq.sugMax, 10) +
        inRangeBonus(csn(fc), sug.coluna?.csn.sugMin ?? sug.csn.sugMin, sug.coluna?.csn.sugMax ?? sug.csn.sugMax, 8) +
        inRangeBonus(soma, sug.soma.sugMin, sug.soma.sugMax, 12) +
        bandBonus(pares, 7, 8, 7) +
        bandBonus(bordas, 9, 11, 6) +
        bandBonus(modas, 8, 9, 6) +
        bandBonus(primos, 5, 7, 4) +
        bandBonus(fib, 3, 5, 4) +
        bandBonus(rep, 7, 10, 5) +
        hot * 0.22 +
        atraso * 0.33 -
        Math.max(0, nHot - 8) * 2.2 -
        Math.max(0, nAtr - 5) * 1.5 -
        Math.abs(soma - 195) * 0.12
      );
    };

    const hamming = (a: number[], b: number[]) => {
      const sb = new Set(b);
      let diff = 0;
      for (const d of a) if (!sb.has(d)) diff++;
      return diff;
    };

    const ranked = [...jogosCompletos]
      .map((j) => ({ j, s: scoreBase(j) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.min(2500, jogosCompletos.length));

    if (!ranked.length) return [];
    const out: number[][] = [ranked[0].j];
    const taken = new Set([ranked[0].j.join(",")]);

    while (out.length < N) {
      let best: { j: number[]; score: number } | null = null;
      const coverage = new Set(out.flat());
      for (const item of ranked) {
        const key = item.j.join(",");
        if (taken.has(key)) continue;
        const minDist = Math.min(...out.map((o) => hamming(item.j, o)));
        const newCoverage = item.j.filter((d) => !coverage.has(d)).length;
        const portfolioScore = item.s + minDist * 3.8 + newCoverage * 1.4;
        if (!best || portfolioScore > best.score) best = { j: item.j, score: portfolioScore };
      }
      if (!best) break;
      out.push(best.j);
      taken.add(best.j.join(","));
    }

    return out;
  }, [fichasIA, sug, jogosCompletos, hist]);

  const totalJogosPossiveis = totalGeradoIA ?? jogosCompletos.length;

  const baixarTxt = () => {
    if (fichasSelecionadas.length === 0) return;
    const txt = fichasSelecionadas
      .map((j) => j.map((d) => d.toString().padStart(2, "0")).join(" ") + " \r\n")
      .join("");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${conc}A-IA.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const salvarHistorico = async () => {
    if (fichasSelecionadas.length === 0) return;
    setSalvando(true); setSaveOk(null);
    try {
      const r = await fetch("/api/jogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: `${conc}A-IA.txt`,
          tipo: "gerador",
          params: {
            origem: "IA Assistant",
            concurso_alvo: conc, retros,
            perfil_ia: treinamento?.perfilVencedor.nome ?? "offline",
            spq: [sug?.spq.sugMin, sug?.spq.sugMax],
            csn: [sug?.csn.sugMin, sug?.csn.sugMax],
            soma: [sug?.soma.sugMin, sug?.soma.sugMax],
            faixa_linha_spq: [sug?.linha?.spq.sugMin, sug?.linha?.spq.sugMax],
            faixa_linha_csn: [sug?.linha?.csn.sugMin, sug?.linha?.csn.sugMax],
            faixa_coluna_spq: [sug?.coluna?.spq.sugMin, sug?.coluna?.spq.sugMax],
            faixa_coluna_csn: [sug?.coluna?.csn.sugMin, sug?.coluna?.csn.sugMax],
            linhas: sug?.topLinhas.map((f) => f.fmt) ?? [],
            colunas: sug?.topColunas.map((f) => f.fmt) ?? [],
            n_total_gerado: totalJogosPossiveis,
            n_fichas_finais: FICHAS_FIXAS,
            treinamento: treinamento ? {
              simulacoes: treinamento.simulacoes,
              concurso_inicio: treinamento.concursoInicio,
              concurso_fim: treinamento.concursoFim,
              perfil_vencedor: treinamento.perfilVencedor.nome,
              media_melhor_acerto: treinamento.ranking[0]?.mediaMelhorAcerto,
              max_acerto: treinamento.ranking[0]?.maxAcerto,
            } : null,
            criterio: "IA automática: score estatístico composto + diversidade de portfólio",
          },
          jogos: fichasSelecionadas,
        }),
      });
      const data = await r.json();
      if (data.id) setSaveOk(data.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSalvando(false);
    }
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
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700">Metodologia</div>
              <div className="mt-0.5 text-sm font-extrabold text-cyan-950">Perfil offline calibrado</div>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Saída final</div>
              <div className="mt-0.5 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                <ShieldCheck size={15} />
                5 fichas fixas
              </div>
            </div>
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
          <strong>IA:</strong> o backtest fica pré-calibrado no código. Ao analisar, o site só aplica o perfil treinado offline e entrega exatamente 5 fichas.
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

      {treinamento && (
        <>
          <SectionTitle>Treinamento offline</SectionTitle>
          <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider font-extrabold text-[#5C7080]">
                  Pré-treinamento local
                </div>
                <div className="mt-1 text-sm text-[#1A2A3A] leading-relaxed max-w-3xl">
                  {treinamento.conclusao}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 min-w-[210px]">
                <div className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700">Perfil vencedor</div>
                <div className="font-extrabold text-emerald-900">{treinamento.perfilVencedor.nome}</div>
                <div className="text-[11px] text-emerald-800 mt-1">{treinamento.perfilVencedor.descricao}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <TreinoMetric label="Simulações" value={treinamento.simulacoes.toString()} sub={`${treinamento.concursoInicio} a ${treinamento.concursoFim}`} />
              <TreinoMetric label="Média melhor acerto" value={treinamento.ranking[0]?.mediaMelhorAcerto.toFixed(2) ?? "0"} sub="nas 5 fichas" />
              <TreinoMetric label="Máximo" value={(treinamento.ranking[0]?.maxAcerto ?? 0).toString()} sub="melhor pico" />
              <TreinoMetric label="11+ pontos" value={`${((treinamento.ranking[0]?.taxa11Mais ?? 0) * 100).toFixed(1)}%`} sub="simulações" />
              <TreinoMetric label="12+ pontos" value={`${((treinamento.ranking[0]?.taxa12Mais ?? 0) * 100).toFixed(1)}%`} sub="simulações" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#DDE8EC]">
              <table className="w-full text-sm">
                <thead className="bg-[#F4F8FA]">
                  <tr>
                    {["Perfil", "Média", "Máx", "10+", "11+", "12+", "Linha+Coluna"].map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-extrabold text-[#5C7080] text-center">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {treinamento.ranking.slice(0, 5).map((r, i) => (
                    <tr key={r.perfil.id} className={cn("border-t border-[#F2F6F8]", i === 0 && "bg-emerald-50/60")}>
                      <td className="px-3 py-2 font-bold text-[#1A2A3A]">{r.perfil.nome}</td>
                      <td className="px-3 py-2 text-center tabular-nums font-bold">{r.mediaMelhorAcerto.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{r.maxAcerto}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{(r.taxa10Mais * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center tabular-nums">{(r.taxa11Mais * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center tabular-nums">{(r.taxa12Mais * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center tabular-nums">{(r.coberturaLinhaColuna * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {sug && (
        <>
          <SectionTitle>Sugestão da IA</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <FaixaCard
              titulo="Linha SPQ"
              min={sug.linha?.spq.sugMin ?? sug.spq.sugMin}
              max={sug.linha?.spq.sugMax ?? sug.spq.sugMax}
              media={sug.linha?.spq.media ?? sug.spq.media}
              ultima={sug.linha?.spq.ultimaTendencia ?? sug.spq.ultimaTendencia}
              centralidade={sug.linha?.spq.centralidade ?? sug.spq.centralidade}
              razao={sug.linha?.spq.razao ?? sug.spq.razao}
            />
            <FaixaCard
              titulo="Linha CSN"
              min={sug.linha?.csn.sugMin ?? sug.csn.sugMin}
              max={sug.linha?.csn.sugMax ?? sug.csn.sugMax}
              media={sug.linha?.csn.media ?? sug.csn.media}
              ultima={sug.linha?.csn.ultimaTendencia ?? sug.csn.ultimaTendencia}
              centralidade={sug.linha?.csn.centralidade ?? sug.csn.centralidade}
              razao={sug.linha?.csn.razao ?? sug.csn.razao}
            />
            <FaixaCard
              titulo="Coluna SPQ"
              min={sug.coluna?.spq.sugMin ?? sug.spq.sugMin}
              max={sug.coluna?.spq.sugMax ?? sug.spq.sugMax}
              media={sug.coluna?.spq.media ?? sug.spq.media}
              ultima={sug.coluna?.spq.ultimaTendencia ?? sug.spq.ultimaTendencia}
              centralidade={sug.coluna?.spq.centralidade ?? sug.spq.centralidade}
              razao={sug.coluna?.spq.razao ?? sug.spq.razao}
            />
            <FaixaCard
              titulo="Coluna CSN"
              min={sug.coluna?.csn.sugMin ?? sug.csn.sugMin}
              max={sug.coluna?.csn.sugMax ?? sug.csn.sugMax}
              media={sug.coluna?.csn.media ?? sug.csn.media}
              ultima={sug.coluna?.csn.ultimaTendencia ?? sug.csn.ultimaTendencia}
              centralidade={sug.coluna?.csn.centralidade ?? sug.csn.centralidade}
              razao={sug.coluna?.csn.razao ?? sug.csn.razao}
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

          {/* Geração automática a partir da sugestão */}
          {jogosCompletos.length > 0 && (
            <>
              <SectionTitle>Jogos gerados</SectionTitle>
              <div className="bg-white border border-[#DDE8EC] rounded-2xl p-6 mb-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white">
                      <Dices size={22}/>
                    </div>
                      <div>
                        <div className="text-sm text-[#5C7080]">Combinações geradas com sua sugestão</div>
                        <div className="text-2xl font-extrabold tabular-nums">
                        {totalJogosPossiveis.toLocaleString("pt-BR")} jogos possíveis
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#5C7080]">
                    {sug.topLinhas.length} formato(s) linha × {sug.topColunas.length} formato(s) coluna<br/>
                    Soma {sug.soma.sugMin}–{sug.soma.sugMax}
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-[12px] text-[#1A2A3A] leading-relaxed">
                  <div className="flex items-center gap-2 font-extrabold text-emerald-800 mb-1">
                    <ShieldCheck size={15} />
                    {fichasSelecionadas.length} melhores fichas finais
                  </div>
                  A seleção é automática: o site aplica o perfil pré-treinado offline e ranqueia os jogos atuais por Linha/SPQ,
                  Linha/CSN, Coluna/SPQ, Coluna/CSN, Soma, variáveis clássicas, dezenas quentes/atrasadas e diversidade entre fichas.
                </div>

                {/* Legenda */}
                <div className="flex flex-wrap gap-3 mb-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded bg-gradient-to-br from-orange-400 to-orange-600"></span>
                    Quente
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded bg-gradient-to-br from-cyan-400 to-cyan-600"></span>
                    Atrasada
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded bg-white border border-[#DDE8EC]"></span>
                    Outra
                  </span>
                </div>

                {/* Lista das fichas selecionadas */}
                <div className="bg-[#FBFDFE] border border-[#DDE8EC] rounded-xl max-h-[420px] overflow-y-auto scrollbar-thin">
                  {fichasSelecionadas.map((j, i) => {
                    const quentes = new Set(sug.dezenasQuentes.map((q) => q.dezena));
                    const atrasadas = new Set(sug.dezenasAtrasadas.map((q) => q.dezena));
                    const qtdQuentes = j.filter((d) => quentes.has(d)).length;
                    const qtdAtrasadas = j.filter((d) => atrasadas.has(d)).length;
                    const fl = formatoLinha(j);
                    const fc = formatoColuna(j);
                    const somaJogo = calcVar("Soma", j);
                    const modas = calcVar("Modas", j);
                    const pares = calcVar("Pares", j);

                    return (
                      <div
                        key={i}
                        className={cn(
                          "px-5 py-3 border-b border-[#F2F6F8] last:border-0",
                          i % 2 === 1 && "bg-white"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-bold text-[#5C7080] uppercase tracking-wider w-10 pt-2">
                            #{(i + 1).toString().padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1.5">
                              {j.map((d) => (
                                <span
                                  key={d}
                                  className={cn(
                                    "inline-flex w-8 h-8 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums",
                                    quentes.has(d)
                                      ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm"
                                      : atrasadas.has(d)
                                      ? "bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-sm"
                                      : "bg-white border border-[#DDE8EC] text-cyan-700"
                                  )}
                                >
                                  {d.toString().padStart(2, "0")}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] font-bold text-[#5C7080]">
                              <span>Linha <code className="font-mono text-cyan-700">{fl}</code></span>
                              <span>Coluna <code className="font-mono text-cyan-700">{fc}</code></span>
                              <span>Soma {somaJogo}</span>
                              <span>Pares {pares}</span>
                              <span>Modas {modas}</span>
                              <span>Quentes {qtdQuentes}</span>
                              <span>Atrasadas {qtdAtrasadas}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    onClick={baixarTxt}
                    className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-extrabold rounded-xl px-6 py-3 text-sm shadow-lg shadow-cyan-200 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    <Download size={16}/> Baixar 5 fichas (.txt)
                  </button>
                  <button
                    onClick={salvarHistorico}
                    disabled={salvando || saveOk !== null}
                    className={cn(
                      "rounded-xl px-6 py-3 text-sm font-extrabold transition-all flex items-center gap-2",
                      saveOk !== null
                        ? "bg-emerald-100 text-emerald-700 cursor-default"
                        : salvando
                        ? "bg-[#F4F8FA] text-[#9DABB5] cursor-wait"
                        : "bg-white border border-[#DDE8EC] hover:border-cyan-300 hover:-translate-y-0.5"
                    )}
                  >
                    {salvando ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                    {saveOk !== null ? `✅ Salvo no histórico (#${saveOk})` : salvando ? "Salvando…" : "Salvar no histórico"}
                  </button>
                  <a
                    href="/historico"
                    className="bg-white border border-[#DDE8EC] text-[#1A2A3A] font-bold rounded-xl px-6 py-3 text-sm hover:border-cyan-300 transition-all flex items-center gap-2"
                  >
                    Ver histórico
                  </a>
                </div>
              </div>
            </>
          )}

          {jogosCompletos.length === 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-sm text-orange-800 mb-6">
              ⚠️ Nenhuma combinação atende aos critérios sugeridos. Ajuste o peso da tendência (mais baixo) ou aumente Retros e tente novamente.
            </div>
          )}
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

function TreinoMetric({ label, value, sub }: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[#DDE8EC] bg-[#FBFDFE] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#5C7080]">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums text-[#0F1B2D]">{value}</div>
      <div className="text-[10px] font-semibold text-[#5C7080]">{sub}</div>
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
