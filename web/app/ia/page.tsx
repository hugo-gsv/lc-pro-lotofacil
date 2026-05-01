"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Loader2, Wand2, ArrowRight, TrendingUp, Flame, Snowflake, Sparkle, Download, Save, Dices } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { MetricCard } from "@/components/ui/metric-card";
import { dezenasDe, enumerar } from "@/lib/lottery";
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

  // Jogos gerados a partir da sugestão
  const [fichasFinal, setFichasFinal] = useState(10);
  const [modoSelecao, setModoSelecao] = useState<"quentes" | "atrasadas" | "equilibrado" | "diverso">("equilibrado");
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

  // === Geração automática de jogos a partir da sugestão ===
  const jogosCompletos: number[][] = useMemo(() => {
    if (!sug) return [];
    const linhas = sug.topLinhas.map((f) => f.fmt);
    const colunas = sug.topColunas.map((f) => f.fmt);
    if (linhas.length === 0 || colunas.length === 0) return [];
    return enumerar(linhas, colunas, sug.soma.sugMin, sug.soma.sugMax);
  }, [sug]);

  // Ranking conforme modo de seleção escolhido
  const fichasSelecionadas: number[][] = useMemo(() => {
    if (!sug || jogosCompletos.length === 0) return [];
    const N = Math.max(1, Math.min(fichasFinal, jogosCompletos.length));

    // Pesos auxiliares
    const pesoQuentes = new Map<number, number>();
    for (const d of sug.dezenasQuentes) pesoQuentes.set(d.dezena, d.freq);
    const pesoAtrasadas = new Map<number, number>();
    for (const d of sug.dezenasAtrasadas) pesoAtrasadas.set(d.dezena, d.atraso);

    const scoreQuentes = (j: number[]) => j.reduce((s, d) => s + (pesoQuentes.get(d) ?? 0), 0);
    const scoreAtrasadas = (j: number[]) => j.reduce((s, d) => s + (pesoAtrasadas.get(d) ?? 0), 0);
    const scoreEquilibrado = (j: number[]) => scoreQuentes(j) * 0.6 + scoreAtrasadas(j) * 0.4;

    if (modoSelecao === "quentes") {
      return [...jogosCompletos]
        .map((j) => ({ j, s: scoreQuentes(j) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, N).map((x) => x.j);
    }

    if (modoSelecao === "atrasadas") {
      return [...jogosCompletos]
        .map((j) => ({ j, s: scoreAtrasadas(j) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, N).map((x) => x.j);
    }

    if (modoSelecao === "equilibrado") {
      // Equilibrado: 40% top quentes + 40% top atrasadas + 20% aleatório,
      // depois dedup
      const nQ = Math.max(1, Math.round(N * 0.4));
      const nA = Math.max(1, Math.round(N * 0.4));
      const nR = Math.max(0, N - nQ - nA);
      const ordQ = [...jogosCompletos]
        .map((j) => ({ j, s: scoreQuentes(j) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, nQ * 3).map((x) => x.j);
      const ordA = [...jogosCompletos]
        .map((j) => ({ j, s: scoreAtrasadas(j) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, nA * 3).map((x) => x.j);
      const out: number[][] = [];
      const addUnique = (arr: number[][], max: number) => {
        for (const j of arr) {
          if (out.length >= N) break;
          const key = j.join(",");
          if (!out.some((x) => x.join(",") === key)) {
            out.push(j);
            if (max-- <= 0) break;
          }
        }
      };
      addUnique(ordQ, nQ);
      addUnique(ordA, nA);
      // resto: aleatório
      const restantes = jogosCompletos.filter(
        (j) => !out.some((x) => x.join(",") === j.join(","))
      );
      for (let i = restantes.length - 1; i > 0; i--) {
        const r = Math.floor(Math.random() * (i + 1));
        [restantes[i], restantes[r]] = [restantes[r], restantes[i]];
      }
      addUnique(restantes, nR);
      return out.slice(0, N);
    }

    // diverso: greedy max-diversity (Hamming distance)
    if (modoSelecao === "diverso") {
      // Começa com a ficha de maior score equilibrado
      const ranked = [...jogosCompletos]
        .map((j) => ({ j, s: scoreEquilibrado(j) }))
        .sort((a, b) => b.s - a.s);
      const out: number[][] = [ranked[0].j];
      const taken = new Set<string>([ranked[0].j.join(",")]);
      while (out.length < N) {
        let best: number[] | null = null;
        let bestMinDist = -1;
        // amostra para performance
        const sample = ranked.slice(0, Math.min(ranked.length, 1000));
        for (const { j } of sample) {
          const k = j.join(",");
          if (taken.has(k)) continue;
          const setJ = new Set(j);
          // distância mínima para qualquer já escolhida
          let minDist = 99;
          for (const o of out) {
            let dist = 0;
            for (const d of o) if (!setJ.has(d)) dist++;
            if (dist < minDist) minDist = dist;
            if (minDist === 0) break;
          }
          if (minDist > bestMinDist) {
            bestMinDist = minDist;
            best = j;
            if (minDist === 15) break;
          }
        }
        if (!best) break;
        out.push(best);
        taken.add(best.join(","));
      }
      return out;
    }

    return [];
  }, [sug, jogosCompletos, fichasFinal, modoSelecao]);

  // Sincroniza o alvo do início com fichasFinal quando análise termina
  useEffect(() => {
    if (sug) setFichasFinal(alvoJogos);
  }, [sug]); // eslint-disable-line react-hooks/exhaustive-deps

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
            concurso_alvo: conc, retros, peso_tendencia: pesoTendencia,
            spq: [sug?.spq.sugMin, sug?.spq.sugMax],
            csn: [sug?.csn.sugMin, sug?.csn.sugMax],
            soma: [sug?.soma.sugMin, sug?.soma.sugMax],
            linhas: sug?.topLinhas.map((f) => f.fmt) ?? [],
            colunas: sug?.topColunas.map((f) => f.fmt) ?? [],
            n_total_gerado: jogosCompletos.length,
            n_fichas_finais: fichasSelecionadas.length,
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
                        {jogosCompletos.length.toLocaleString("pt-BR")} jogos possíveis
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#5C7080]">
                    {sug.topLinhas.length} formato(s) linha × {sug.topColunas.length} formato(s) coluna<br/>
                    Soma {sug.soma.sugMin}–{sug.soma.sugMax}
                  </div>
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C7080] mb-2">
                  Estratégia de seleção
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {([
                    { v: "equilibrado", label: "⚖️ Equilibrado", desc: "Mistura quentes + atrasadas + aleatório" },
                    { v: "quentes",     label: "🔥 Quentes",     desc: "Prioriza dezenas que mais saíram" },
                    { v: "atrasadas",   label: "❄️ Atrasadas",   desc: "Prioriza dezenas há tempo sem sair" },
                    { v: "diverso",     label: "🎲 Diverso",     desc: "Maximiza variedade entre fichas" },
                  ] as const).map((m) => (
                    <button
                      key={m.v}
                      onClick={() => setModoSelecao(m.v)}
                      title={m.desc}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                        modoSelecao === m.v
                          ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md shadow-cyan-200"
                          : "bg-white border border-[#DDE8EC] hover:border-cyan-300"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#5C7080] mb-2">
                  Quantas fichas você quer?
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[5, 10, 15, 20, 25, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => setFichasFinal(Math.min(n, jogosCompletos.length))}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                        fichasFinal === n
                          ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md shadow-cyan-200"
                          : "bg-white border border-[#DDE8EC] hover:border-cyan-300"
                      )}
                    >
                      {n} fichas
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={jogosCompletos.length}
                    value={fichasFinal}
                    onChange={(e) => setFichasFinal(
                      Math.max(1, Math.min(jogosCompletos.length, parseInt(e.target.value) || 1))
                    )}
                    className="bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 text-sm font-semibold w-24 text-center focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
                <div className="bg-cyan-50/50 border border-cyan-100 rounded-xl px-4 py-3 mb-4 text-[12px] text-[#1A2A3A] leading-relaxed">
                  <div className="font-bold text-cyan-800 mb-1">
                    {fichasSelecionadas.length} fichas de {jogosCompletos.length.toLocaleString("pt-BR")} possíveis
                  </div>
                  {modoSelecao === "equilibrado" && (
                    <>
                      🔄 <strong>Equilibrado:</strong> 40% top quentes + 40% top atrasadas + 20% aleatório.
                      <span className="text-[#5C7080]"> Mistura cobertura e variedade — recomendado para uso geral.</span>
                    </>
                  )}
                  {modoSelecao === "quentes" && (
                    <>
                      🔥 <strong>Quentes:</strong> top fichas com maior soma de dezenas que mais saíram nos últimos {retros}.
                      <span className="text-[#5C7080]"> Tendência: dezenas em sequência costumam concentrar.</span>
                    </>
                  )}
                  {modoSelecao === "atrasadas" && (
                    <>
                      ❄️ <strong>Atrasadas:</strong> top fichas com maior soma de atrasos das dezenas presentes.
                      <span className="text-[#5C7080]"> Aposta na regressão à média — &quot;dezenas devem voltar&quot;.</span>
                    </>
                  )}
                  {modoSelecao === "diverso" && (
                    <>
                      🎲 <strong>Diverso:</strong> algoritmo greedy de máxima diversidade (Hamming).
                      <span className="text-[#5C7080]"> Cada nova ficha é a mais diferente possível das já escolhidas — máxima cobertura.</span>
                    </>
                  )}
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
                  {fichasSelecionadas.map((j, i) => (
                    <div
                      key={i}
                      className={cn(
                        "px-5 py-3 border-b border-[#F2F6F8] last:border-0",
                        i % 2 === 1 && "bg-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#5C7080] uppercase tracking-wider w-10">
                          #{(i + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {j.map((d) => (
                            <span
                              key={d}
                              className={cn(
                                "inline-flex w-8 h-8 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums",
                                sug.dezenasQuentes.find((q) => q.dezena === d)
                                  ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm"
                                  : sug.dezenasAtrasadas.find((q) => q.dezena === d)
                                  ? "bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-sm"
                                  : "bg-white border border-[#DDE8EC] text-cyan-700"
                              )}
                            >
                              {d.toString().padStart(2, "0")}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    onClick={baixarTxt}
                    className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-extrabold rounded-xl px-6 py-3 text-sm shadow-lg shadow-cyan-200 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    <Download size={16}/> Baixar {fichasFinal} fichas (.txt)
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
                  <Link
                    href="/historico"
                    className="bg-white border border-[#DDE8EC] text-[#1A2A3A] font-bold rounded-xl px-6 py-3 text-sm hover:border-cyan-300 transition-all flex items-center gap-2"
                  >
                    Ver histórico
                  </Link>
                </div>

                <details className="mt-5">
                  <summary className="cursor-pointer text-xs text-[#5C7080] font-semibold hover:text-cyan-700">
                    Avançado: ajustar parâmetros manualmente no Gerador
                  </summary>
                  <button
                    onClick={aplicar}
                    className="mt-3 bg-white border border-[#DDE8EC] text-[#1A2A3A] font-bold rounded-xl px-4 py-2 text-xs hover:border-cyan-300 transition-all flex items-center gap-2"
                  >
                    Aplicar e ir ao Gerador <ArrowRight size={14}/>
                  </button>
                </details>
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
