import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  analiseMultiJanela,
  gerarCarteiraIA,
  PERFIL_TREINADO_IA,
  sugerir,
  TREINAMENTO_OFFLINE_IA,
} from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const historico: { c: number; dez: number[] }[] = body.historico ?? [];
    const historicoLongo: { c: number; dez: number[] }[] = body.historicoLongo ?? historico;
    const alvoJogos = 5;

    if (!Array.isArray(historico) || historico.length === 0) {
      return NextResponse.json({ error: "historico vazio" }, { status: 400 });
    }

    // 1) Perfil calibrado offline. O site não roda backtest a cada clique.
    const treinamento = TREINAMENTO_OFFLINE_IA;
    const perfil = PERFIL_TREINADO_IA;

    // 2) Análise heurística final usando o perfil vencedor do backtest offline
    const sug = sugerir(
      historico,
      alvoJogos,
      perfil.pesoTendencia,
      { larguraFaixa: perfil.larguraFaixa, qtdFormatos: perfil.qtdFormatos }
    );
    const carteira = gerarCarteiraIA(historico, sug, perfil, alvoJogos, historicoLongo);

    // 3) Análise multi-janela sobre todo o histórico longo (valida tendência)
    const mj = analiseMultiJanela(historicoLongo, 30);

    // 4) Chama Claude para narrativa + validação
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        sugestao: sug,
        treinamento,
        carteira,
        fichas: carteira.jogos,
        multiJanela: mj,
        narrativa: "Análise heurística pura (ANTHROPIC_API_KEY não configurada). " +
          "Para narrativa em linguagem natural, configure a chave em Vercel → Settings → Env Vars.",
      });
    }

    const client = new Anthropic({ apiKey });

    const prompt = `Você é um especialista em análise estatística da Lotofácil brasileira. Analisei ${historico.length} concursos recentes e ${historicoLongo.length} concursos para validar tendência. Aqui estão os dados:

ANÁLISE DE SÉRIE (últimos ${historico.length} concursos):
- Linha/SPQ: média ${sug.linha.spq.media.toFixed(1)}, desvio ${sug.linha.spq.desvio.toFixed(1)}, últimos 5 = ${sug.linha.spq.ultimaTendencia.toFixed(1)}, centralidade ${(sug.linha.spq.centralidade*100).toFixed(0)}%
- Linha/CSN: média ${sug.linha.csn.media.toFixed(0)}, desvio ${sug.linha.csn.desvio.toFixed(0)}, últimos 5 = ${sug.linha.csn.ultimaTendencia.toFixed(0)}
- Coluna/SPQ: média ${sug.coluna.spq.media.toFixed(1)}, desvio ${sug.coluna.spq.desvio.toFixed(1)}, últimos 5 = ${sug.coluna.spq.ultimaTendencia.toFixed(1)}, centralidade ${(sug.coluna.spq.centralidade*100).toFixed(0)}%
- Coluna/CSN: média ${sug.coluna.csn.media.toFixed(0)}, desvio ${sug.coluna.csn.desvio.toFixed(0)}, últimos 5 = ${sug.coluna.csn.ultimaTendencia.toFixed(0)}
- Soma: média ${sug.soma.media.toFixed(0)}, desvio ${sug.soma.desvio.toFixed(1)}, últimos 5 = ${sug.soma.ultimaTendencia.toFixed(0)}

VALIDAÇÃO MULTI-JANELA (${mj.janelas.length} janelas de 30 concursos sobre histórico longo):
- SPQ médio das médias: ${mj.spq.mediaDasMedias.toFixed(1)} (centro teórico = 45)
- CSN médio das médias: ${mj.csn.mediaDasMedias.toFixed(0)} (centro teórico = 320)
- Soma média das médias: ${mj.soma.mediaDasMedias.toFixed(0)} (centro teórico = 195)
- Conclusão: ${mj.conclusao}

TREINAMENTO OFFLINE PRÉ-CALCULADO:
- Simulações: ${treinamento?.simulacoes ?? 0} concursos passados (${treinamento?.concursoInicio ?? "-"} a ${treinamento?.concursoFim ?? "-"})
- Regra: para cada concurso passado, foram usados apenas concursos anteriores; depois as 5 fichas foram conferidas contra o resultado real.
- Esse treinamento foi feito offline/localmente e NÃO roda a cada análise do site.
- Perfil vencedor: ${treinamento?.perfilVencedor.nome ?? "sem treinamento"} — ${treinamento?.perfilVencedor.descricao ?? ""}
- Ranking: ${(treinamento?.ranking ?? []).slice(0, 4).map(r =>
  `${r.perfil.nome}: média melhor acerto ${r.mediaMelhorAcerto.toFixed(2)}, máx ${r.maxAcerto}, 11+ ${(r.taxa11Mais*100).toFixed(1)}%, 12+ ${(r.taxa12Mais*100).toFixed(1)}%, 13+ ${(r.taxa13Mais*100).toFixed(1)}%, 15 ${(r.taxa15*100).toFixed(1)}%`
).join(" | ")}
- Observação honesta: o melhor perfil chegou a 13 pontos no período testado; não foi encontrada metodologia com 15 pontos nas 5 fichas.

SUGESTÃO HEURÍSTICA:
- Linha/SPQ: [${sug.linha.spq.sugMin}, ${sug.linha.spq.sugMax}]
- Linha/CSN: [${sug.linha.csn.sugMin}, ${sug.linha.csn.sugMax}]
- Coluna/SPQ: [${sug.coluna.spq.sugMin}, ${sug.coluna.spq.sugMax}]
- Coluna/CSN: [${sug.coluna.csn.sugMin}, ${sug.coluna.csn.sugMax}]
- Soma: [${sug.soma.sugMin}, ${sug.soma.sugMax}]
- Top formatos linha: ${sug.topLinhas.map(f=>f.fmt).join(", ")}
- Top formatos coluna: ${sug.topColunas.map(f=>f.fmt).join(", ")}
- Dezenas mais atrasadas: ${sug.dezenasAtrasadas.map(d=>`${d.dezena.toString().padStart(2,"0")}(atr ${d.atraso})`).join(", ")}
- Dezenas mais quentes: ${sug.dezenasQuentes.slice(0,5).map(d=>`${d.dezena.toString().padStart(2,"0")}(${d.freq}x)`).join(", ")}

TAREFA:
1. Em até 5 frases curtas em PORTUGUÊS, explique a tomada de decisão de forma clara e segura, falando como um analista experiente.
2. Explique que a metodologia vencedora foi escolhida por simulação no passado, não por palpite.
3. Mencione se a tendência ao centro foi CONFIRMADA pela análise multi-janela.
4. Comente se há sinais de "intuição" (atrasos extremos, formatos esquecidos, padrões emergentes que merecem atenção).
5. O programa vai entregar EXATAMENTE 5 fichas finais; não sugira que o usuário escolha quantidade manualmente.
6. Seja honesto: não prometa acerto perfeito nem 15 pontos garantidos.

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
      treinamento,
      carteira,
      fichas: carteira.jogos,
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
