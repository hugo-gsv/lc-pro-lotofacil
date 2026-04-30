import { Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function Filtrar() {
  return (
    <>
      <PageHeader
        icon={<Filter size={28} />}
        title="Filtrar Jogo"
        subtitle="9 filtros estatísticos validados — Pares, Bordas, MODAIS, Primos, Fibonacci, Posições."
      />
      <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl px-5 py-12 text-center">
        <p className="text-[#5C7080]">
          🚧 Em construção — será portado em breve.
        </p>
      </div>
    </>
  );
}
