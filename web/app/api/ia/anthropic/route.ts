import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sugerir, analiseMultiJanela } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const historico: { c: number; dez: number[] }[] = body.historico ?? [];
    const historicoLongo: { c: number; dez: number[] }[] = body.historicoLongo ?? historico;
    const alvoJogos = body.alvoJogos ?? 10;
    const pesoTendencia = body.pesoTendencia ?? 0.6;

    if (!Array.isArray(historico) || historico.length === 0) {
      return NextResponse.json({ error: "historico vazio" }, { status: 400 });
    }

    // 1) Análise heurística (TS puro)
    const sug = sugerir(historico, alvoJogos, pesoTendencia);

    // 2) Análise multi-janela sobre todo o histórico longo (valida tendência)
    const mj = analiseMultiJanela(historicoLongo, 30);

    // 3) Chama Claude para narrativa + validação
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        sugestao: sug,
        multiJanela: mj,
        narrativa: "Análise heurística pura (ANTHROPIC_API_KEY não configurada). " +
          "Para narrativa em linguagem natural, configure a chave em Vercel → Settings → Env Vars.",
      });
    }

    const client = new Anthropic({ apiKey });

    const prompt = `Você é um especialista em análise estatística da Lotofácil brasileira. Analisei ${historico.length} concursos recentes e ${historicoLongo.length} concursos para validar tendência. Aqui estão os dados:

ANÁLISE DE SÉRIE (últimos ${historico.length} concursos):
- SPQ: média ${sug.spq.media.toFixed(1)}, desvio ${sug.spq.desvio.toFixed(1)}, últimos 5 = ${sug.spq.ultimaTendencia.toFixed(1)}, centralidade ${(sug.spq.centralidade*100).toFixed(0)}%
- CSN: média ${sug.csn.media.toFixed(0)}, desvio ${sug.csn.desvio.toFixed(0)}, últimos 5 = ${sug.csn.ultimaTendencia.toFixed(0)}
- Soma: média ${sug.soma.media.toFixed(0)}, desvio ${sug.soma.desvio.toFixed(1)}, últimos 5 = ${sug.soma.ultimaTendencia.toFixed(0)}

VALIDAÇÃO MULTI-JANELA (${mj.janelas.length} janelas de 30 concursos sobre histórico longo):
- SPQ médio das médias: ${mj.spq.mediaDasMedias.toFixed(1)} (centro teórico = 45)
- CSN médio das médias: ${mj.csn.mediaDasMedias.toFixed(0)} (centro teórico = 320)
- Soma média das médias: ${mj.soma.mediaDasMedias.toFixed(0)} (centro teórico = 195)
- Conclusão: ${mj.conclusao}

SUGESTÃO HEURÍSTICA:
- SPQ: [${sug.spq.sugMin}, ${sug.spq.sugMax}]
- CSN: [${sug.csn.sugMin}, ${sug.csn.sugMax}]
- Soma: [${sug.soma.sugMin}, ${sug.soma.sugMax}]
- Top formatos linha: ${sug.topLinhas.map(f=>f.fmt).join(", ")}
- Top formatos coluna: ${sug.topColunas.map(f=>f.fmt).join(", ")}
- Dezenas mais atrasadas: ${sug.dezenasAtrasadas.map(d=>`${d.dezena.toString().padStart(2,"0")}(atr ${d.atraso})`).join(", ")}
- Dezenas mais quentes: ${sug.dezenasQuentes.slice(0,5).map(d=>`${d.dezena.toString().padStart(2,"0")}(${d.freq}x)`).join(", ")}

TAREFA:
1. Em até 5 frases curtas em PORTUGUÊS, explique a tomada de decisão de forma clara e segura, falando como um analista experiente.
2. Mencione se a tendência ao centro foi CONFIRMADA pela análise multi-janela.
3. Comente se há sinais de "intuição" (atrasos extremos, formatos esquecidos, padrões emergentes que merecem atenção).
4. Confirme ou ajuste levemente a sugestão (ex: "vale apertar SPQ para 43–47") — mas SEMPRE seja honesto: se for puramente probabilidade independente, diga.

Responda em JSON:
{
  "narrativa": "texto em português, 4-6 frases",
  "ajustesSugeridos": { "spq": [min,max] | null, "csn": [min,max] | null, "soma": [min,max] | null },
  "confianca": "alta" | "media" | "baixa",
  "intuicao": "string ou null"
}`;

    const completion = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const txt = completion.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    let parsed: {
      narrativa: string;
      ajustesSugeridos?: {
        spq?: [number, number] | null;
        csn?: [number, number] | null;
        soma?: [number, number] | null;
      };
      confianca?: string;
      intuicao?: string | null;
    } = { narrativa: txt };

    try {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { /* keep raw */ }

    return NextResponse.json({
      sugestao: sug,
      multiJanela: mj,
      narrativa: parsed.narrativa ?? txt,
      ajustesSugeridos: parsed.ajustesSugeridos ?? null,
      confianca: parsed.confianca ?? null,
      intuicao: parsed.intuicao ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro" },
      { status: 500 }
    );
  }
}
