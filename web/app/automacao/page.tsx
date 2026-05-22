"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, RadioTower, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";

type Job = {
  id: number;
  nome: string;
  dt_criacao: string;
  n_jogos: number;
  params_json: {
    status?: string;
    status_at?: string;
    mensagem?: string;
    origem?: string;
    concurso_alvo?: number;
  } | null;
};

const statusClass: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  rodando: "bg-cyan-100 text-cyan-800 border-cyan-200",
  concluido: "bg-emerald-100 text-emerald-800 border-emerald-200",
  erro: "bg-red-100 text-red-800 border-red-200",
  cancelado: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function AutomacaoCaixaPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://lc-pro-lotofacil.vercel.app");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const comando = useMemo(
    () => `LC_PRO_URL="${origin}" python3 tools/caixa_automacao_local.py --bridge --keep-open`,
    [origin]
  );

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/automacao/jobs?limit=30", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "erro");
      setErro(null);
      setJobs(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não consegui carregar a fila";
      setErro(msg.includes("fetch failed") ? "Não consegui consultar a fila neste ambiente. Tente atualizar em instantes." : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const id = window.setInterval(carregar, 8000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <PageHeader
        icon={<ShoppingCart size={28} />}
        title="Automação Caixa"
        subtitle="Fila das fichas enviadas pelo LC Pro para preenchimento local no site da Caixa."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 mb-6">
        <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <SectionTitle>Fila de automação</SectionTitle>
            <button
              onClick={carregar}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DDE8EC] bg-white px-4 py-2 text-xs font-extrabold text-[#1A2A3A] hover:border-cyan-300 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Atualizar
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DDE8EC]">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F8FA]">
                <tr>
                  {["ID", "Nome", "Fichas", "Concurso", "Status", "Atualização"].map((h) => (
                    <th key={h} className="px-3 py-3 text-[10px] uppercase tracking-wider font-extrabold text-[#5C7080] text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const status = job.params_json?.status ?? "pendente";
                  return (
                    <tr key={job.id} className="border-t border-[#F2F6F8]">
                      <td className="px-3 py-3 font-mono text-xs text-[#5C7080]">#{job.id}</td>
                      <td className="px-3 py-3 font-bold text-[#1A2A3A]">{job.nome}</td>
                      <td className="px-3 py-3 tabular-nums">{job.n_jogos}</td>
                      <td className="px-3 py-3 tabular-nums">{job.params_json?.concurso_alvo ?? "-"}</td>
                      <td className="px-3 py-3">
                        <span className={cn(
                          "inline-flex rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider",
                          statusClass[status] ?? statusClass.pendente
                        )}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#5C7080]">
                        {(job.params_json?.status_at ?? job.dt_criacao).replace("T", " ").slice(0, 19)}
                      </td>
                    </tr>
                  );
                })}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-[#5C7080]">
                      Nenhuma ficha enviada para automação.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {erro && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
              {erro}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#DDE8EC] rounded-2xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-3">
            <RadioTower size={17} className="text-cyan-600" />
            <strong className="text-sm">Assistente local</strong>
          </div>
          <p className="text-sm text-[#1A2A3A] leading-relaxed">
            Deixe o assistente aberto no Mac. O botão da IA envia as fichas direto para ele,
            ele abre a Caixa, preenche os jogos e para no carrinho para conferência.
          </p>
          <div className="mt-4 rounded-xl bg-[#0F1B2D] p-4 text-[11px] font-mono text-cyan-50 overflow-x-auto">
            {comando}
          </div>
          <p className="mt-3 text-[11px] text-[#5C7080] leading-relaxed">
            As credenciais ficam só no Mac, via prompt ou variáveis de ambiente. O site não recebe senha da Caixa,
            senha de e-mail, código de validação nem dados de cartão.
          </p>
        </div>
      </div>
    </>
  );
}
