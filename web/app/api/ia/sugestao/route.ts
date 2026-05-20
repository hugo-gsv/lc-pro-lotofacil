import { NextRequest, NextResponse } from "next/server";
import { sugerir } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const historico: { c: number; dez: number[] }[] = body.historico ?? [];
    const alvoJogos = 5;
    const pesoTendencia = body.pesoTendencia ?? 0.6;

    if (!Array.isArray(historico) || historico.length === 0) {
      return NextResponse.json(
        { error: "historico vazio" },
        { status: 400 }
      );
    }
    const sug = sugerir(historico, alvoJogos, pesoTendencia);
    return NextResponse.json(sug);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}
