import { NextRequest, NextResponse } from "next/server";
import { salvarJogos, listarJogos, excluirJogo } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = await salvarJogos({
      nome: body.nome,
      tipo: body.tipo,
      params: body.params,
      jogos: body.jogos,
    });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const tipo = req.nextUrl.searchParams.get("tipo") || undefined;
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const data = await listarJogos(limit, tipo || undefined);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = parseInt(req.nextUrl.searchParams.get("id") || "0");
    if (!id) throw new Error("id obrigatório");
    await excluirJogo(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}
