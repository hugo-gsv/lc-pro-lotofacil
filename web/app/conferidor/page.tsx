import { Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function Conferidor() {
  return (
    <>
      <PageHeader
        icon={<Check size={28} />}
        title="Conferidor"
        subtitle="Confere uma lista de jogos contra qualquer concurso e gera relatório."
      />
      <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl px-5 py-12 text-center">
        <p className="text-[#5C7080]">
          🚧 Em construção — será portado em breve.
        </p>
      </div>
    </>
  );
}
