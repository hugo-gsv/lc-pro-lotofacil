import { NextRequest, NextResponse } from "next/server";
import { gerarCarteiraIA, sugerir, treinarMetodologiaIA } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const historico: { c: number; dez: number[] }[] = body.historico ?? [];
    const historicoLongo: { c: number; dez: number[] }[] = body.historicoLongo ?? historico;
    const alvoJogos = 5;
    const pesoTendencia = body.pesoTendencia ?? 0.6;

    if (!Array.isArray(historico) || historico.length === 0) {
      return NextResponse.json(
        { error: "historico vazio" },
        { status: 400 }
      );
    }
    const treinamento = treinarMetodologiaIA(historicoLongo, historico.length, alvoJogos);
    const perfil = treinamento?.perfilVencedor;
    const sug = sugerir(
      historico,
      alvoJogos,
      perfil?.pesoTendencia ?? pesoTendencia,
      perfil ? { larguraFaixa: perfil.larguraFaixa, qtdFormatos: perfil.qtdFormatos } : {}
    );
    const carteira = gerarCarteiraIA(historico, sug, perfil, alvoJogos);

    return NextResponse.json({
      sugestao: sug,
      treinamento,
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
