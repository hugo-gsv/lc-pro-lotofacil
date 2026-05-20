import { NextRequest, NextResponse } from "next/server";
import { gerarCarteiraIA, PERFIL_TREINADO_IA, sugerir, TREINAMENTO_OFFLINE_IA } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const historico: { c: number; dez: number[] }[] = body.historico ?? [];
    const alvoJogos = 5;

    if (!Array.isArray(historico) || historico.length === 0) {
      return NextResponse.json(
        { error: "historico vazio" },
        { status: 400 }
      );
    }
    const perfil = PERFIL_TREINADO_IA;
    const sug = sugerir(
      historico,
      alvoJogos,
      perfil.pesoTendencia,
      { larguraFaixa: perfil.larguraFaixa, qtdFormatos: perfil.qtdFormatos }
    );
    const carteira = gerarCarteiraIA(historico, sug, perfil, alvoJogos);

    return NextResponse.json({
      sugestao: sug,
      treinamento: TREINAMENTO_OFFLINE_IA,
      carteira,
      fichas: carteira.jogos,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}
