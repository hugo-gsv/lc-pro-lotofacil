import Link from "next/link";
import { fetchConcurso, dezenasDe, formatoLinha, formatoColuna, spq, csn } from "@/lib/lottery";
import { Hero } from "@/components/ui/hero";
import { MetricCard } from "@/components/ui/metric-card";
import { LotteryBalls } from "@/components/ui/lottery-balls";
import { SectionTitle } from "@/components/ui/section-title";
import { Sparkles, Filter, Check, ArrowRight } from "lucide-react";

export const revalidate = 300;

export default async function Home() {
  let latest;
  try {
    latest = await fetchConcurso();
  } catch {
    return <div className="text-center py-12 text-red-500">Erro ao conectar à Caixa.</div>;
  }
  const dez = dezenasDe(latest);
  const fl = formatoLinha(dez);
  const fc = formatoColuna(dez);

  const tools = [
    { icon: Sparkles, href: "/gerador", title: "Gerador",
      desc: "Cruzamento Linha × Coluna com SPQ, CSN e Soma. Múltiplos formatos." },
    { icon: Filter, href: "/filtrar", title: "Filtrar Jogo",
      desc: "9 filtros estatísticos validados — Pares, Bordas, MODAIS, Primos, Fibonacci." },
    { icon: Check, href: "/conferidor", title: "Conferidor",
      desc: "Confere lista de jogos contra qualquer concurso e gera relatório." },
  ];

  return (
    <>
      <Hero
        title="LC Pro Lotofácil"
        subtitle="Sistema profissional de análise estatística e geração de jogos."
      />
      <SectionTitle>Último concurso oficial</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <MetricCard label="Concurso" value={`#${latest.numero}`} sub="Oficial Caixa" />
        <MetricCard label="Data" value={latest.dataApuracao} sub="Sorteio" />
        <MetricCard label="SPQ L / C" value={`${spq(fl)} / ${spq(fc)}`} sub={`Fmt ${fl} / ${fc}`} />
        <MetricCard label="CSN L / C" value={`${csn(fl)} / ${csn(fc)}`} sub="Rank entre 651" />
      </div>
      <LotteryBalls dezenas={dez} />
      <SectionTitle>Ferramentas</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {tools.map(({ icon: Icon, href, title, desc }) => (
          <Link key={href} href={href}
            className="group relative bg-white border border-[#DDE8EC] rounded-3xl p-7 transition-all hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-cyan-100 hover:border-cyan-300 overflow-hidden">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-cyan-50/50 to-transparent" />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-4"
              style={{ background: "linear-gradient(135deg, #14C6E4, #0095B6)",
                       boxShadow: "0 8px 20px rgba(20,198,228,.25)" }}>
              <Icon size={28} />
            </div>
            <div className="relative">
              <h3 className="text-xl font-extrabold tracking-tight mb-2">{title}</h3>
              <p className="text-sm text-[#5C7080] font-medium leading-relaxed mb-4">{desc}</p>
              <div className="flex items-center gap-1.5 text-cyan-700 font-bold text-sm">
                Abrir <ArrowRight size={16} />
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-12 text-xs text-[#5C7080] flex items-center gap-2">
        <span>☁️</span><span>Storage: <strong>Supabase</strong></span>
      </div>
    </>
  );
}
