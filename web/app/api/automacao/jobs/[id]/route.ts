import { NextRequest, NextResponse } from "next/server";
import {
  atualizarJobAutomacao,
  carregarJogo,
  type AutomacaoStatus,
} from "@/lib/supabase";

const STATUS_VALIDOS = new Set<AutomacaoStatus>([
  "pendente",
  "rodando",
  "concluido",
  "erro",
  "cancelado",
]);

function erroMensagem(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e && "message" in e) {
    return String((e as { message?: unknown }).message);
  }
  return "erro";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await carregarJogo(parseInt(id, 10));
    if (!data || data.tipo !== "automacao_caixa") {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: erroMensagem(e) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const status = body.status as AutomacaoStatus | undefined;
    if (!status || !STATUS_VALIDOS.has(status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    const detalhes = typeof body.detalhes === "object" && body.detalhes
      ? body.detalhes
      : {};
    await atualizarJobAutomacao(parseInt(id, 10), status, detalhes);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json(
      { error: erroMensagem(e) },
      { status: 500 }
    );
  }
}
