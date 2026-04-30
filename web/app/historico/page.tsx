"use client";

import { useEffect, useState } from "react";
import { Archive, Trash2, Download, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Item = {
  id: number; nome: string; tipo: string | null;
  dt_criacao: string; n_jogos: number;
  params_json: Record<string, unknown> | null;
};

export default function Historico() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jogos?limit=200")
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const remover = async (id: number) => {
    if (!confirm("Excluir este lote?")) return;
    await fetch(`/api/jogos?id=${id}`, { method: "DELETE" });
    setItems((arr) => arr.filter((x) => x.id !== id));
  };

  return (
    <>
      <PageHeader
        icon={<Archive size={28} />}
        title="Histórico"
        subtitle="Todos os jogos gerados ficam salvos no servidor — acesse de qualquer dispositivo."
      />
      {loading ? (
        <div className="text-center py-16 text-[#5C7080]">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl px-5 py-12 text-center">
          <p className="text-[#5C7080]">
            Nenhum jogo gerado ainda. Vá ao <a className="text-cyan-700 font-bold" href="/gerador">Gerador</a> para criar seu primeiro lote.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#DDE8EC] rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-b from-[#FBFDFE] to-[#F4F8FA]">
              <tr>
                {["#", "Nome", "Quando", "Jogos", "Tipo", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[10.5px] uppercase tracking-wider font-extrabold text-[#0F1B2D] text-center border-b border-[#DDE8EC]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className={i % 2 === 1 ? "bg-[#FBFDFE]" : ""}>
                  <td className="px-4 py-3 text-center font-mono text-xs text-[#5C7080]">#{it.id}</td>
                  <td className="px-4 py-3 font-bold text-[#0F1B2D]">{it.nome}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#5C7080]">
                    {it.dt_criacao.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3 text-center font-bold tabular-nums">{it.n_jogos}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#5C7080]">{it.tipo}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => remover(it.id)}
                        className="p-2 rounded-lg text-[#5C7080] hover:bg-red-50 hover:text-red-500 transition"
                        aria-label="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
