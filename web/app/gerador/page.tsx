"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Sparkles, X, Download, Loader2, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { Sparkline } from "@/components/ui/sparkline";
import {
  csn, spq, formatoLinha, formatoColuna, todosFormatos, enumerar, dezenasDe,
} from "@/lib/lottery";
import { cn } from "@/lib/utils";

type Tipo = "Linhas" | "Colunas" | "LinhaXColuna";
type Graf = "SPQ" | "CSN";

export default function Gerador() {
  const [target, setTarget] = useState(3674);
  const [retros, setRetros] = useState(10);
  const [tipo, setTipo] = useState<Tipo>("Linhas");
  const [graf, setGraf] = useState<Graf>("SPQ");
  const [hist, setHist] = useState<{ c: number; dez: number[] }[]>([]);
  const [loading, setLoading] = useState(false);

  // Carrega último concurso
  useEffect(() => {
    fetch("https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
      { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTarget(d.numero + 1))
      .catch(() => {});
  }, []);

  // Carrega histórico
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const start = Math.max(1, target - retros);
    const end = target - 1;
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
  }, [target, retros]);

  // Tabela do histórico
  const rows = useMemo(() => {
    return hist.map(({ c, dez }) => {
      const fl = formatoLinha(dez);
      const fc = formatoColuna(dez);
      const soma = dez.reduce((a, b) => a + b, 0);
      const csnUse = tipo === "Colunas" ? csn(fc) : csn(fl);
      const spqUse = tipo === "Colunas" ? spq(fc) : spq(fl);
      return { c, fl, fc, csn: csnUse, spq: spqUse, soma };
    });
  }, [hist, tipo]);

  const grafConfig = useMemo(() => {
    if (tipo === "LinhaXColuna") return { name: "Soma", min: 120, max: 270 };
    if (graf === "SPQ") return { name: "SPQ", min: 30, max: 60 };
    return { name: "CSN", min: 10, max: 629 };
  }, [tipo, graf]);

  // Estimativas
  const [spqMin, setSpqMin] = useState(44);
  const [spqMax, setSpqMax] = useState(47);
  const [csnMin, setCsnMin] = useState(200);
  const [csnMax, setCsnMax] = useState(500);
  const [formatosAceitos, setFormatosAceitos] = useState<string[]>([]);
  const [formatoSel, setFormatoSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [linhasInc, setLinhasInc] = useState<string[]>([]);
  const [colunasInc, setColunasInc] = useState<string[]>([]);

  const formatosFiltrados = useMemo(() => {
    const q = busca.trim();
    if (!q) return formatosAceitos;
    return formatosAceitos.filter((f) => f.includes(q));
  }, [formatosAceitos, busca]);

  const mostrarFormatos = () => {
    setFormatoSel(null);
    setFormatosAceitos(
      todosFormatos().filter((f) => {
        const s = spq(f); const c = csn(f);
        return s >= spqMin && s <= spqMax && c >= csnMin && c <= csnMax;
      })
    );
  };

  // Geração
  const [somaMin, setSomaMin] = useState(120);
  const [somaMax, setSomaMax] = useState(270);
  const [nomeArq, setNomeArq] = useState("");
  const [pending, startTransition] = useTransition();
  const [gerados, setGerados] = useState<number[][] | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    setNomeArq(`${target}A.txt`);
  }, [target]);

  const gerar = () => {
    setSavedId(null);
    startTransition(async () => {
      const jogos = enumerar(linhasInc, colunasInc, somaMin, somaMax);
      setGerados(jogos);
      // Salva no Supabase via API route
      if (jogos.length > 0) {
        try {
          const r = await fetch("/api/jogos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: nomeArq,
              tipo: "gerador",
              params: {
                concurso_alvo: target, retros, tipo_dados: tipo,
                linhas: linhasInc, colunas: colunasInc, soma_min: somaMin, soma_max: somaMax,
              },
              jogos,
            }),
          });
          const data = await r.json();
          if (data.id) setSavedId(data.id);
        } catch { /* ignora erro de save */ }
      }
    });
  };

  const baixar = () => {
    if (!gerados) return;
    const blob = new Blob(
      [gerados.map((j) => j.map((d) => d.toString().padStart(2, "0")).join(" ") + " \r\n").join("")],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeArq; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        icon={<Sparkles size={28} />}
        title="Gerador"
        subtitle="Cruzamento matricial Linha × Coluna com filtros SPQ, CSN e Soma."
      />

      {/* Parâmetros */}
      <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Para Concurso</label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Retros</label>
            <input
              type="number"
              value={retros}
              onChange={(e) => setRetros(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1.5">Dados de</label>
            <div className="flex gap-2 flex-wrap">
              {(["Linhas", "Colunas", "LinhaXColuna"] as Tipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                    tipo === t
                      ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md shadow-cyan-200"
                      : "bg-white border border-[#DDE8EC] text-[#5C7080] hover:border-cyan-300"
                  )}
                >
                  {t === "LinhaXColuna" ? "Linha × Coluna" : t}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1.5">Gráfico</label>
            <div className="flex gap-2">
              {(["SPQ", "CSN"] as Graf[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGraf(g)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                    graf === g
                      ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md shadow-cyan-200"
                      : "bg-white border border-[#DDE8EC] text-[#5C7080] hover:border-cyan-300"
                  )}
                >
                  {g === "SPQ" ? "SPQ (30 a 60)" : "CSN (10 a 629)"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>Histórico — Gráfico {grafConfig.name}</SectionTitle>

      {/* Tabela do histórico */}
      <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden mb-6">
        {loading ? (
          <div className="p-12 text-center text-[#5C7080]">
            <Loader2 className="inline animate-spin mr-2" size={18} />
            Buscando concursos...
          </div>
        ) : (
          <table className="w-full text-sm">
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "45%" }} />
            </colgroup>
            <thead className="bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA] sticky top-0">
              <tr>
                {["Concurso", "Linha", "Coluna", "CSN", "SPQ", "Soma", "Gráfico"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const v = tipo === "LinhaXColuna" ? r.soma : graf === "SPQ" ? r.spq : r.csn;
                return (
                  <tr
                    key={r.c}
                    className={cn(
                      "border-b border-[#F2F6F8] hover:bg-cyan-50/40 transition",
                      i % 2 === 1 && "bg-[#FBFDFE]"
                    )}
                  >
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.c.toString().padStart(4, "0")}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-cyan-700 tracking-wider">{r.fl}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-cyan-700 tracking-wider">{r.fc}</td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.csn}</td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.spq}</td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.soma}</td>
                    <td className="px-4 py-2">
                      <Sparkline value={v} vmin={grafConfig.min} vmax={grafConfig.max} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SectionTitle>Estimativas para escolher Formatos</SectionTitle>

      {/* Estimativas */}
      <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">SPQ mín</label>
            <input type="number" value={spqMin} onChange={(e) => setSpqMin(parseInt(e.target.value))} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">SPQ máx</label>
            <input type="number" value={spqMax} onChange={(e) => setSpqMax(parseInt(e.target.value))} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">CSN mín</label>
            <input type="number" value={csnMin} onChange={(e) => setCsnMin(parseInt(e.target.value))} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">CSN máx</label>
            <input type="number" value={csnMax} onChange={(e) => setCsnMax(parseInt(e.target.value))} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <button
            onClick={mostrarFormatos}
            className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-bold rounded-lg px-4 py-2 text-sm shadow-md shadow-cyan-200 hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            🔍 Mostrar formatos
          </button>
        </div>
      </div>

      {/* Formatos + Inclusos */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
        <div className="md:col-span-3">
          <SectionTitle>Formatos Aceitos</SectionTitle>
          {formatosAceitos.length === 0 ? (
            <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl px-5 py-4 text-sm text-[#5C7080]">
              Defina SPQ/CSN e clique em <strong>Mostrar formatos</strong> acima.
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar formato (ex: 33 ou 24333)…"
                  className="w-full bg-white border border-[#DDE8EC] rounded-lg pl-9 pr-9 py-2 text-sm font-mono font-semibold tracking-wider focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-cyan-300"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9DABB5] text-sm">🔍</span>
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[#9DABB5] hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition"
                    aria-label="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="text-xs text-[#5C7080] mb-2">
                {formatosFiltrados.length} de {formatosAceitos.length} formato(s)
                {busca && <span> • filtro: <code className="font-mono text-cyan-700">{busca}</code></span>}
                {" — clique para selecionar"}
              </p>
              <div className="bg-white border border-[#DDE8EC] rounded-2xl overflow-hidden shadow-sm max-h-[360px] overflow-y-auto scrollbar-thin">
                {formatosFiltrados.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-[#5C7080]">
                    Nenhum formato corresponde a <code className="font-mono text-cyan-700">{busca}</code>.
                  </div>
                ) : (
                  formatosFiltrados.map((f) => {
                    const isSel = f === formatoSel;
                    return (
                      <button
                        key={f}
                        onClick={() => setFormatoSel(isSel ? null : f)}
                        className={cn(
                          "w-full px-5 py-3 text-center font-mono font-bold text-[15px] tracking-[1.5px] transition-all border-b border-[#F2F6F8] last:border-0",
                          isSel
                            ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-inner border-l-4 border-l-orange-500"
                            : "text-cyan-700 hover:bg-cyan-50"
                        )}
                      >
                        {f}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="md:col-span-2">
          <SectionTitle>Inclusos</SectionTitle>
          <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-2 bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA] border-b border-[#DDE8EC]">
              {["Linhas", "Colunas"].map((h) => (
                <div key={h} className="px-3 py-2 text-center text-[11px] uppercase tracking-wider font-extrabold text-[#0095B6]">
                  {h}
                </div>
              ))}
            </div>
            {(() => {
              const max = Math.max(linhasInc.length, colunasInc.length, 1);
              return Array.from({ length: max }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 border-b border-[#F2F6F8] last:border-0">
                  <Cell
                    value={linhasInc[i]}
                    onRemove={() => setLinhasInc((arr) => arr.filter((_, j) => j !== i))}
                  />
                  <Cell
                    value={colunasInc[i]}
                    onRemove={() => setColunasInc((arr) => arr.filter((_, j) => j !== i))}
                    border="left"
                  />
                </div>
              ));
            })()}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              disabled={!formatoSel}
              onClick={() => {
                if (formatoSel && !linhasInc.includes(formatoSel)) {
                  setLinhasInc([...linhasInc, formatoSel]);
                }
                setFormatoSel(null);
              }}
              className={cn(
                "px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all",
                formatoSel
                  ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md hover:-translate-y-0.5"
                  : "bg-[#F4F8FA] text-[#9DABB5] cursor-not-allowed"
              )}
            >
              <ArrowLeft size={14} />
              {formatoSel ? `${formatoSel} → Linhas` : "Adicionar a Linhas"}
            </button>
            <button
              disabled={!formatoSel}
              onClick={() => {
                if (formatoSel && !colunasInc.includes(formatoSel)) {
                  setColunasInc([...colunasInc, formatoSel]);
                }
                setFormatoSel(null);
              }}
              className={cn(
                "px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all",
                formatoSel
                  ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md hover:-translate-y-0.5"
                  : "bg-[#F4F8FA] text-[#9DABB5] cursor-not-allowed"
              )}
            >
              {formatoSel ? `${formatoSel} → Colunas` : "Adicionar a Colunas"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <SectionTitle>Geração das Combinações</SectionTitle>

      <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-[#5C7080] mb-3">
          Soma das dezenas — intervalo permitido: 120 a 270
        </p>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Soma mín</label>
            <input type="number" value={somaMin} onChange={(e) => setSomaMin(parseInt(e.target.value))} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Soma máx</label>
            <input type="number" value={somaMax} onChange={(e) => setSomaMax(parseInt(e.target.value))} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">Nome do arquivo</label>
            <input type="text" value={nomeArq} onChange={(e) => setNomeArq(e.target.value)} className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div className="md:col-span-2">
            <button
              disabled={pending}
              onClick={gerar}
              className="w-full bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-extrabold rounded-lg px-3 py-2.5 text-sm shadow-md shadow-cyan-200 hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pending ? <Loader2 className="animate-spin" size={16} /> : "🎯"} Gerar
            </button>
          </div>
        </div>
      </div>

      {gerados && (
        <div className="mt-6 bg-white border border-[#DDE8EC] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-lg">
                ✅ {gerados.length} combinações geradas
              </p>
              {savedId && (
                <p className="text-xs text-[#5C7080] mt-1">
                  Salvo no histórico — ID #{savedId}
                </p>
              )}
            </div>
            <button
              onClick={baixar}
              className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-bold rounded-lg px-4 py-2 text-sm shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              <Download size={16} /> Baixar .txt
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Cell({
  value,
  onRemove,
  border,
}: {
  value: string | undefined;
  onRemove: () => void;
  border?: "left";
}) {
  if (!value) {
    return (
      <div
        className={cn(
          "px-3 py-2.5 text-center text-[#C8D4DA]",
          border === "left" && "border-l border-[#DDE8EC]"
        )}
      >
        —
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-2.5",
        border === "left" && "border-l border-[#DDE8EC]"
      )}
    >
      <span className="font-mono font-bold text-cyan-700 tracking-wider text-sm">
        {value}
      </span>
      <button
        onClick={onRemove}
        className="w-5 h-5 rounded-full flex items-center justify-center text-[#C8D4DA] hover:bg-red-50 hover:text-red-500 transition"
        aria-label="Remover"
      >
        <X size={12} />
      </button>
    </div>
  );
}
