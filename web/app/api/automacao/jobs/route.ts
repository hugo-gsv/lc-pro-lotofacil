import { NextRequest, NextResponse } from "next/server";
import {
  criarJobAutomacao,
  listarJobsAutomacao,
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

function normalizarJogos(input: unknown): number[][] {
  if (!Array.isArray(input)) throw new Error("jogos obrigatório");
  if (input.length === 0) throw new Error("informe pelo menos um jogo");
  if (input.length > 200) throw new Error("limite de 200 jogos por automação");

  return input.map((jogo, idx) => {
    if (!Array.isArray(jogo)) throw new Error(`jogo ${idx + 1} inválido`);
    const dezenas = jogo.map((d) => Number(d)).filter((d) => Number.isInteger(d));
    const unicas = [...new Set(dezenas)].sort((a, b) => a - b);
    if (unicas.length !== 15 || unicas.some((d) => d < 1 || d > 25)) {
      throw new Error(`jogo ${idx + 1} precisa ter 15 dezenas únicas entre 1 e 25`);
    }
    return unicas;
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jogos = normalizarJogos(body.jogos);
    const id = await criarJobAutomacao({
      nome: body.nome || `Automação Caixa ${new Date().toISOString()}`,
      params: typeof body.params === "object" && body.params ? body.params : {},
      jogos,
    });
    return NextResponse.json({ id, status: "pendente", n_jogos: jogos.length });
  } catch (e) {
    return NextResponse.json(
      { error: erroMensagem(e) },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const statusParam = req.nextUrl.searchParams.get("status") as AutomacaoStatus | null;
    const status = statusParam && STATUS_VALIDOS.has(statusParam) ? statusParam : undefined;
    if (statusParam && !status) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 20, 50));
    const data = await listarJobsAutomacao(limit, status);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: erroMensagem(e) },
      { status: 500 }
    );
  }
}
