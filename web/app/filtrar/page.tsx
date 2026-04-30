"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Download, X, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { MetricCard } from "@/components/ui/metric-card";
import { calcVar, dezenasDe, type FilterName } from "@/lib/lottery";
import { cn } from "@/lib/utils";

type HistItem = {
  id: number; nome: string; tipo: string | null;
  dt_criacao: string; n_jogos: number;
  params_json: Record<string, unknown> | null;
};

const FILTROS: { name: FilterName; min: number; max: number }[] = [
  { name: "Pares",            min: 8,  max: 8 },
  { name: "Bordas",           min: 9,  max: 11 },
  { name: "Modas",            min: 8,  max: 9 },
  { name: "Primos",           min: 6,  max: 7 },
  { name: "Fibonacci",        min: 5,  max: 6 },
  { name: "Repetição Último", min: 7,  max: 10 },
  { name: "Posição 4",        min: 0,  max: 25 },
  { name: "Posição 8",        min: 0,  max: 25 },
  { name: "Posição 12",       min: 0,  max: 25 },
];

const NOMES_SERIE: FilterName[] = [
  "Pares", "Bordas", "Modas", "Primos", "Fibonacci",
  "Repetição Último", "Posição 4", "Posição 8", "Posição 12",
];

function parseGameLine(s: string): number[] | null {
  let str = s;
  if (str.includes(">")) str = str.split(">", 2)[1];
  if (str.includes("=")) str = str.split("=", 2)[0];
  const tokens = str.replace(/,/g, " ").split(/\s+/).filter((x) => /^\d+$/.test(x));
  const nums = tokens.map((x) => parseInt(x)).filter((n) => n >= 1 && n <= 25);
  if (nums.length >= 15) {
    const cand = nums.slice(-15);
    if (new Set(cand).size === 15) return [...cand].sort((a, b) => a - b);
  }
  return null;
}

export default function Filtrar() {
  const [conc, setConc] = useState(3674);
  const [hist, setHist] = useState<HistItem[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [selId, setSelId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [jogos, setJogos] = useState<number[][]>([]);
  const [nomeLote, setNomeLote] = useState("filtrado.txt");
  const [fonte, setFonte] = useState<string>("");
  const [serie, setSerie] = useState<number[][]>([]);
  const [loadingSerie, setLoadingSerie] = useState(false);

  // Filter config
  const [cfg, setCfg] = useState(() =>
    Object.fromEntries(
      FILTROS.map((f) => [f.name, { on: false, min: f.min, max: f.max }])
    ) as Record<FilterName, { on: boolean; min: number; max: number }>
  );

  // Resultado
  const [aprovados, setAprovados] = useState<number[][] | null>(null);
  const [elimCounts, setElimCounts] = useState<Record<string, number>>({});
  const [lidas, setLidas] = useState(0);

  // Carrega último concurso
  useEffect(() => {
    fetch("https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
      { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConc(d.numero + 1))
      .catch(() => {});
  }, []);

  // Carrega histórico do Supabase
  useEffect(() => {
    fetch("/api/jogos?tipo=gerador&limit=50")
      .then((r) => r.json())
      .then((d) => { setHist(Array.isArray(d) ? d : []); setLoadingHist(false); })
      .catch(() => setLoadingHist(false));
  }, []);

  // Carrega últimos 10 concursos
  useEffect(() => {
    let cancel = false;
    setLoadingSerie(true);
    const start = Math.max(1, conc - 10);
    const end = conc - 1;
    (async () => {
      const promises: Promise<number[] | null>[] = [];
      for (let n = start; n <= end; n++) {
        promises.push(
          fetch(`https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${n}`,
            { cache: "force-cache" })
            .then((r) => r.json())
            .then((d) => dezenasDe(d))
            .catch(() => null)
        );
      }
      const results = (await Promise.all(promises)).filter(Boolean) as number[][];
      if (!cancel) {
        setSerie(results);
        setLoadingSerie(false);
      }
    })();
    return () => { cancel = true; };
  }, [conc]);

  // Carrega lote selecionado
  useEffect(() => {
    if (!selId) return;
    fetch(`/api/jogos/${selId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.jogos_json) {
          setJogos(d.jogos_json);
          setFonte(`#${d.id} · ${d.nome}`);
          setNomeLote(d.nome.replace(/\.txt$/, "F.txt"));
        }
      })
      .catch(() => {});
  }, [selId]);

  // Carrega upload
  useEffect(() => {
    if (!uploadFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = reader.result as string;
      const lines = txt.split(/\r?\n/);
      const parsed = lines.map(parseGameLine).filter(Boolean) as number[][];
      setJogos(parsed);
      setFonte(`upload: ${uploadFile.name}`);
      setNomeLote(uploadFile.name.replace(/\.txt$/, "F.txt"));
      setSelId(null);
    };
    reader.readAsText(uploadFile);
  }, [uploadFile]);

  // Tabela de série
  const serieRows = useMemo(() => {
    if (serie.length === 0) return null;
    const out: Record<FilterName, number[]> = Object.fromEntries(
      NOMES_SERIE.map((n) => [n, [] as number[]])
    ) as Record<FilterName, number[]>;
    let prev = new Set<number>();
    for (const d of serie) {
      for (const n of NOMES_SERIE) out[n].push(calcVar(n, d, prev));
      prev = new Set(d);
    }
    return out;
  }, [serie]);

  const aplicarFiltros = () => {
    if (jogos.length === 0) return;
    const retro = serie.length > 0 ? new Set(serie[serie.length - 1]) : new Set<number>();
    const aprov: number[][] = [];
    const elim: Record<string, number> = {};
    for (const f of FILTROS) elim[f.name] = 0;
    for (const j of jogos) {
      let ok = true;
      for (const f of FILTROS) {
        const c = cfg[f.name];
        if (!c.on) continue;
        const v = calcVar(f.name, j, retro);
        if (v < c.min || v > c.max) {
          elim[f.name]++;
          ok = false;
        }
      }
      if (ok) aprov.push(j);
    }
    setAprovados(aprov);
    setElimCounts(elim);
    setLidas(jogos.length);
  };

  const baixar = () => {
    if (!aprovados) return;
    const txt = aprovados
      .map((j) => j.map((d) => d.toString().padStart(2, "0")).join(" ") + " \r\n")
      .join("");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeLote; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        icon={<Filter size={28} />}
        title="Filtrar Jogo"
        subtitle="9 filtros estatísticos validados — Pares, Bordas, MODAIS, Primos, Fibonacci, Posições."
      />

      {/* Topo: concurso + lote */}
      <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              Concurso a conferir
            </label>
            <input
              type="number"
              value={conc}
              onChange={(e) => setConc(parseInt(e.target.value))}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
          <div className="md:col-span-7">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              Lote de jogos (do histórico)
            </label>
            <select
              value={selId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelId(v ? parseInt(v) : null);
                setUploadFile(null);
              }}
              disabled={loadingHist}
              className="w-full bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="">— Carregar do histórico —</option>
              {hist.map((h) => (
                <option key={h.id} value={h.id}>
                  #{h.id} · {h.nome} · {h.n_jogos} jogos
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5C7080] mb-1">
              ou upload manual
            </label>
            <label className="flex items-center justify-center gap-2 bg-white border border-[#DDE8EC] rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer hover:border-cyan-300 transition">
              <Upload size={14} />
              <span className="truncate">{uploadFile ? uploadFile.name : "Escolher .txt"}</span>
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>

        {jogos.length > 0 && (
          <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5 text-sm">
            📥 <strong>{jogos.length} jogos carregados</strong>{" "}
            <span className="text-[#5C7080]">({fonte})</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Esquerda: Ocorridos nos últimos 10 */}
        <div>
          <SectionTitle>Ocorridos nos últimos 10 resultados</SectionTitle>
          <p className="text-xs text-[#5C7080] mb-2">
            Esquerda = mais antigo · Direita = mais recente
          </p>

          <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
            {loadingSerie ? (
              <div className="p-12 text-center text-[#5C7080]">
                <Loader2 className="inline animate-spin mr-2" size={18} />
                Buscando últimos 10...
              </div>
            ) : serieRows ? (
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] border-b border-[#DDE8EC]">
                      Variável
                    </th>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <th
                        key={i}
                        className="px-1.5 py-2.5 text-center text-[10.5px] font-extrabold text-[#0F1B2D] border-b border-[#DDE8EC]"
                      >
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NOMES_SERIE.map((n, i) => (
                    <tr
                      key={n}
                      className={cn(
                        "border-b border-[#F2F6F8] last:border-0",
                        i % 2 === 1 && "bg-[#FBFDFE]"
                      )}
                    >
                      <td className="px-3 py-2 font-mono font-bold text-cyan-700 tracking-wide text-xs whitespace-nowrap">
                        {n}
                      </td>
                      {serieRows[n].map((v, j) => (
                        <td
                          key={j}
                          className="px-1.5 py-2 text-center font-bold tabular-nums text-cyan-700 text-xs"
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-[#5C7080]">Sem histórico disponível.</p>
            )}
          </div>
        </div>

        {/* Direita: Filtros */}
        <div>
          <SectionTitle>Filtros</SectionTitle>

          <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA] border-b border-[#DDE8EC]">
              <div className="col-span-2 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center">✓</div>
              <div className="col-span-5 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D]">Filtro</div>
              <div className="col-span-2 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center">Mín</div>
              <div className="col-span-2 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center">Máx</div>
              <div className="col-span-1 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center">Elim</div>
            </div>
            {FILTROS.map((f, i) => (
              <div
                key={f.name}
                className={cn(
                  "grid grid-cols-12 gap-3 px-4 py-2.5 items-center border-b border-[#F2F6F8] last:border-0",
                  i % 2 === 1 && "bg-[#FBFDFE]"
                )}
              >
                <div className="col-span-2 flex justify-center">
                  <input
                    type="checkbox"
                    checked={cfg[f.name].on}
                    onChange={(e) => setCfg((c) => ({
                      ...c,
                      [f.name]: { ...c[f.name], on: e.target.checked },
                    }))}
                    className="w-4 h-4 accent-cyan-600 cursor-pointer"
                  />
                </div>
                <div className="col-span-5 text-sm font-semibold">{f.name}</div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={cfg[f.name].min}
                    onChange={(e) => setCfg((c) => ({
                      ...c,
                      [f.name]: { ...c[f.name], min: parseInt(e.target.value) || 0 },
                    }))}
                    className="w-full bg-white border border-[#DDE8EC] rounded px-2 py-1 text-xs font-semibold text-center focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={cfg[f.name].max}
                    onChange={(e) => setCfg((c) => ({
                      ...c,
                      [f.name]: { ...c[f.name], max: parseInt(e.target.value) || 0 },
                    }))}
                    className="w-full bg-white border border-[#DDE8EC] rounded px-2 py-1 text-xs font-semibold text-center focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
                <div className="col-span-1 text-center text-xs font-bold tabular-nums text-orange-600">
                  {cfg[f.name].on && elimCounts[f.name] !== undefined
                    ? elimCounts[f.name]
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          disabled={jogos.length === 0}
          onClick={aplicarFiltros}
          className={cn(
            "px-6 py-3 rounded-xl text-sm font-extrabold flex items-center gap-2 transition-all",
            jogos.length > 0
              ? "bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-lg shadow-cyan-200 hover:-translate-y-0.5 hover:shadow-xl"
              : "bg-[#F4F8FA] text-[#9DABB5] cursor-not-allowed"
          )}
        >
          🎯 Aplicar Filtros
        </button>
      </div>

      {aprovados !== null && (
        <>
          <SectionTitle>Resultado</SectionTitle>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Lidas" value={lidas} sub="Total no lote" />
            <MetricCard
              label="Aceitas"
              value={aprovados.length}
              sub={`${lidas > 0 ? ((aprovados.length / lidas) * 100).toFixed(1) : 0}% passaram`}
            />
            <MetricCard
              label="Eliminadas"
              value={lidas - aprovados.length}
              sub="Por todos os filtros"
            />
          </div>

          {aprovados.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={baixar}
                className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-bold rounded-lg px-4 py-2 text-sm shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2"
              >
                <Download size={16} /> Baixar {nomeLote}
              </button>
            </div>
          )}

          {aprovados.length > 0 && (
            <details className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
              <summary className="px-5 py-3 font-bold text-sm cursor-pointer hover:bg-cyan-50 transition">
                Ver {aprovados.length} jogos aprovados
              </summary>
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin border-t border-[#DDE8EC]">
                {aprovados.slice(0, 500).map((j, i) => (
                  <div
                    key={i}
                    className={cn(
                      "px-5 py-2 font-mono text-sm border-b border-[#F2F6F8] last:border-0",
                      i % 2 === 1 && "bg-[#FBFDFE]"
                    )}
                  >
                    <span className="text-[#5C7080] mr-3">{(i + 1).toString().padStart(5, "0")}</span>
                    <span className="text-cyan-700 font-semibold tracking-wider">
                      {j.map((d) => d.toString().padStart(2, "0")).join("  ")}
                    </span>
                  </div>
                ))}
                {aprovados.length > 500 && (
                  <p className="px-5 py-3 text-xs text-[#5C7080] text-center">
                    Mostrando 500 de {aprovados.length}.
                  </p>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
