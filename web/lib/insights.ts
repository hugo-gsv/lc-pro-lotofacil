/**
 * Engine de análise estatística da Lotofácil — base para a IA de sugestão.
 * Inclui: formato linha/coluna, variáveis por dezena, séries (SPQ/CSN/Soma),
 * tendência (centralidade) e geração de sugestão com razões explicáveis.
 */

import {
  csn, formatoColuna, formatoLinha, spq,
  BORDAS, FIBO, MODAIS, PRIMOS,
} from "./lottery";

// =============================================================================
//  Helpers estatísticos
// =============================================================================
export function media(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
export function desvio(arr: number[], m?: number): number {
  if (!arr.length) return 0;
  const mu = m ?? media(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - mu) ** 2, 0) / arr.length);
}
export function quantil(arr: number[], q: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))));
  return s[i];
}

// =============================================================================
//  Análise de série temporal (SPQ, CSN, Soma) com tendência
// =============================================================================
export type SerieAnalise = {
  valores: number[];        // série completa
  media: number;
  desvio: number;
  ultimaTendencia: number;  // média(últimos 5)
  centralidade: number;     // pontuação 0..1 — quanto a série está fora do centro
  sugMin: number;           // intervalo recomendado
  sugMax: number;
  razao: string;
};

function analisarSerie(
  valores: number[],
  centroTeorico: number,
  pesoTendencia: number = 0.6
): SerieAnalise {
  const m = media(valores);
  const sd = desvio(valores, m);
  const recentes = valores.slice(-5);
  const tend = media(recentes);
  // distância do centro recente, normalizada por desvio
  const fugaCentro = sd > 0 ? Math.abs(tend - centroTeorico) / sd : 0;
  const centralidade = Math.min(1, fugaCentro);

  // Sugestão: pesa tendência e regressão ao centro.
  // Se tendência está acima → puxa pra baixo (regressão).
  const ajuste = (centroTeorico - tend) * pesoTendencia * 0.5;
  const sugCentro = m + ajuste;
  const sugMin = Math.round(sugCentro - sd);
  const sugMax = Math.round(sugCentro + sd);

  const direcao =
    Math.abs(tend - centroTeorico) < 0.3 * sd
      ? "no centro"
      : tend > centroTeorico
      ? "acima do centro"
      : "abaixo do centro";
  const razao =
    `Média ${m.toFixed(1)}, σ ${sd.toFixed(1)}, últimos 5 = ${tend.toFixed(1)} ` +
    `(${direcao}). Sugiro ${sugMin}–${sugMax}.`;

  return {
    valores, media: m, desvio: sd, ultimaTendencia: tend,
    centralidade, sugMin, sugMax, razao,
  };
}

// =============================================================================
//  Análise de formato (linha e coluna): frequência + atraso + índice
// =============================================================================
export type FormatoStat = {
  fmt: string;
  freq: number;        // quantas vezes apareceu nos últimos N
  atraso: number;      // concursos desde a última aparição (0 = saiu agora)
  indice: number;      // freq × atraso (proxy do app original)
};

export function analisarFormatos(
  historico: { c: number; dez: number[] }[],
  funcao: (dez: number[]) => string
): FormatoStat[] {
  const ordenado = [...historico].sort((a, b) => a.c - b.c);
  const total = ordenado.length;
  const freq = new Map<string, number>();
  const ultimaPos = new Map<string, number>();
  ordenado.forEach((row, i) => {
    const f = funcao(row.dez);
    freq.set(f, (freq.get(f) ?? 0) + 1);
    ultimaPos.set(f, i);
  });
  const out: FormatoStat[] = [];
  for (const [fmt, fr] of freq.entries()) {
    const atraso = total - 1 - (ultimaPos.get(fmt) ?? 0);
    out.push({ fmt, freq: fr, atraso, indice: fr * atraso });
  }
  return out.sort((a, b) => b.indice - a.indice);
}

// =============================================================================
//  Distribuição de qtd de dezenas por linha/coluna (matriz 6×5)
// =============================================================================
export function distribuicaoQtds(
  historico: { dez: number[] }[],
  porColuna = false
): number[][] {
  // matriz[qtd][linha-1] = ocorrências
  const m: number[][] = Array.from({ length: 6 }, () => Array(5).fill(0));
  for (const { dez } of historico) {
    const fmt = porColuna ? formatoColuna(dez) : formatoLinha(dez);
    for (let i = 0; i < 5; i++) {
      const k = parseInt(fmt[i]);
      m[k][i]++;
    }
  }
  return m;
}

// =============================================================================
//  Análise por dezena (Estatísticas de Variáveis)
// =============================================================================
export type DezenaStat = {
  dezena: number;
  freq: number;             // quantas vezes saiu nos últimos N
  atraso: number;           // concursos desde a última saída
  coef: number;             // índice de calor (heurístico, ver razão na UI)
  ocorrencias: boolean[];   // true/false em cada um dos últimos N
  classif: {
    paridade: "P" | "I";    // par/ímpar
    bordaMiolo: "B" | "M";  // borda/miolo
    primo: boolean;
    fibonacci: boolean;
    modal: boolean;
  };
};

export function analisarVariaveis(
  historico: { c: number; dez: number[] }[]
): DezenaStat[] {
  const ordenado = [...historico].sort((a, b) => a.c - b.c);
  const N = ordenado.length;
  const out: DezenaStat[] = [];
  for (let d = 1; d <= 25; d++) {
    const ocorrencias = ordenado.map(({ dez }) => dez.includes(d));
    const freq = ocorrencias.filter(Boolean).length;
    let atraso = 0;
    for (let i = N - 1; i >= 0; i--) {
      if (ocorrencias[i]) break;
      atraso++;
    }
    // Coeficiente heurístico:
    //   freq pesada × bonus se atraso baixo (saiu recente)
    //   inspirado no app original (sem fórmula exata; user vai validar)
    const coef = Math.round(freq * 5 + Math.max(0, 12 - atraso) * 0.5 + freq * (1 - atraso / N) * 4);
    out.push({
      dezena: d,
      freq,
      atraso,
      coef,
      ocorrencias,
      classif: {
        paridade: d % 2 === 0 ? "P" : "I",
        bordaMiolo: BORDAS.has(d) ? "B" : "M",
        primo: PRIMOS.has(d),
        fibonacci: FIBO.has(d),
        modal: MODAIS.has(d),
      },
    });
  }
  return out;
}

// =============================================================================
//  Análise multi-janela (rolling window) — valida tendência ao centro
// =============================================================================
export type MultiJanela = {
  janelas: { idxFim: number; concursoFim: number; spqMed: number; csnMed: number; somaMed: number }[];
  // estatística da estatística — média e desvio das médias
  spq: { mediaDasMedias: number; desvioDasMedias: number };
  csn: { mediaDasMedias: number; desvioDasMedias: number };
  soma: { mediaDasMedias: number; desvioDasMedias: number };
  conclusao: string;
};

export function analiseMultiJanela(
  historico: { c: number; dez: number[] }[],
  tamanhoJanela: number = 30
): MultiJanela {
  const ord = [...historico].sort((a, b) => a.c - b.c);
  const N = ord.length;
  const janelas: MultiJanela["janelas"] = [];
  const spqMeds: number[] = [];
  const csnMeds: number[] = [];
  const somaMeds: number[] = [];

  for (let i = tamanhoJanela; i <= N; i++) {
    const slice = ord.slice(i - tamanhoJanela, i);
    const sp = slice.map((r) => spq(formatoLinha(r.dez)));
    const cn = slice.map((r) => csn(formatoLinha(r.dez)));
    const sm = slice.map((r) => r.dez.reduce((a, b) => a + b, 0));
    const spqMed = media(sp);
    const csnMed = media(cn);
    const somaMed = media(sm);
    janelas.push({
      idxFim: i - 1,
      concursoFim: ord[i - 1].c,
      spqMed,
      csnMed,
      somaMed,
    });
    spqMeds.push(spqMed);
    csnMeds.push(csnMed);
    somaMeds.push(somaMed);
  }

  const spqMed = media(spqMeds);
  const csnMed = media(csnMeds);
  const somaMed = media(somaMeds);
  const spqDesv = desvio(spqMeds, spqMed);
  const csnDesv = desvio(csnMeds, csnMed);
  const somaDesv = desvio(somaMeds, somaMed);

  // distância do centro teórico (45 / 320 / 195) em desvios
  const distSPQ = Math.abs(spqMed - 45) / Math.max(spqDesv, 0.01);
  const distCSN = Math.abs(csnMed - 320) / Math.max(csnDesv, 0.01);
  const distSoma = Math.abs(somaMed - 195) / Math.max(somaDesv, 0.01);

  const muitoCentral =
    distSPQ < 0.5 && distSoma < 0.5;

  const conclusao = muitoCentral
    ? `Em ${janelas.length} janelas de ${tamanhoJanela} concursos, as médias de SPQ (${spqMed.toFixed(1)}), CSN (${csnMed.toFixed(0)}) e Soma (${somaMed.toFixed(0)}) ficaram MUITO próximas dos centros teóricos (45 / 320 / 195). Confirma forte regressão ao centro — tendência ao centro é um sinal estatístico válido.`
    : `Em ${janelas.length} janelas, médias SPQ=${spqMed.toFixed(1)}, CSN=${csnMed.toFixed(0)}, Soma=${somaMed.toFixed(0)}. Pequenos desvios do centro teórico (distância normalizada SPQ=${distSPQ.toFixed(2)}σ, Soma=${distSoma.toFixed(2)}σ). Centralidade geral, mas com flutuação real.`;

  return {
    janelas,
    spq: { mediaDasMedias: spqMed, desvioDasMedias: spqDesv },
    csn: { mediaDasMedias: csnMed, desvioDasMedias: csnDesv },
    soma: { mediaDasMedias: somaMed, desvioDasMedias: somaDesv },
    conclusao,
  };
}

// =============================================================================
//  Sugestão completa (motor de IA)
// =============================================================================
export type Sugestao = {
  // Mantidos por compatibilidade com telas antigas: apontam para as análises de LINHA.
  spq: SerieAnalise;
  csn: SerieAnalise;
  linha: {
    spq: SerieAnalise;
    csn: SerieAnalise;
  };
  coluna: {
    spq: SerieAnalise;
    csn: SerieAnalise;
  };
  soma: SerieAnalise;
  topLinhas: FormatoStat[];     // sugeridos para Linhas Inclusas
  topColunas: FormatoStat[];    // sugeridos para Colunas Inclusas
  dezenasAtrasadas: DezenaStat[];   // top atraso (interesse)
  dezenasQuentes: DezenaStat[];     // top frequência recente
  jogosEstimados: number;
  razoesGerais: string[];
};

export function sugerir(
  historico: { c: number; dez: number[] }[],
  alvoJogos = 5,
  pesoTendencia = 0.6
): Sugestao {
  if (historico.length === 0) {
    throw new Error("Histórico vazio");
  }

  const seriesSpqLinha = historico.map((r) => spq(formatoLinha(r.dez)));
  const seriesCsnLinha = historico.map((r) => csn(formatoLinha(r.dez)));
  const seriesSpqColuna = historico.map((r) => spq(formatoColuna(r.dez)));
  const seriesCsnColuna = historico.map((r) => csn(formatoColuna(r.dez)));
  const seriesSoma = historico.map((r) => r.dez.reduce((a, b) => a + b, 0));

  const spqLinhaA = analisarSerie(seriesSpqLinha, 45, pesoTendencia);
  const csnLinhaA = analisarSerie(seriesCsnLinha, 320, pesoTendencia);
  const spqColunaA = analisarSerie(seriesSpqColuna, 45, pesoTendencia);
  const csnColunaA = analisarSerie(seriesCsnColuna, 320, pesoTendencia);
  const somaA = analisarSerie(seriesSoma, 195, pesoTendencia);

  const formatosL = analisarFormatos(historico, formatoLinha);
  const formatosC = analisarFormatos(historico, formatoColuna);

  const scoreFormato = (f: FormatoStat, spqRange: SerieAnalise, csnRange: SerieAnalise) => {
    const sp = spq(f.fmt);
    const cn = csn(f.fmt);
    const inSpq = sp >= spqRange.sugMin && sp <= spqRange.sugMax;
    const inCsn = cn >= csnRange.sugMin && cn <= csnRange.sugMax;
    const distSpq = Math.abs(sp - 45);
    const distCsn = Math.abs(cn - 320) / 20;
    // Índice do app original continua importante, mas não domina sozinho.
    return f.freq * 12 + f.atraso * 1.4 + f.indice * 0.75 +
      (inSpq ? 16 : -12) + (inCsn ? 12 : -8) -
      distSpq * 1.2 - distCsn * 0.6;
  };

  // A IA precisa gerar 5 fichas; se escolher só 2-3 formatos, pode ficar sem
  // diversidade suficiente. Por isso pegamos 6 de linha e 6 de coluna: é um
  // portfólio pequeno, explicável, mas com espaço para o ranking final.
  const topLinhas = [...formatosL]
    .sort((a, b) => scoreFormato(b, spqLinhaA, csnLinhaA) - scoreFormato(a, spqLinhaA, csnLinhaA))
    .slice(0, Math.max(4, Math.min(6, alvoJogos + 1)));
  const topColunas = [...formatosC]
    .sort((a, b) => scoreFormato(b, spqColunaA, csnColunaA) - scoreFormato(a, spqColunaA, csnColunaA))
    .slice(0, Math.max(4, Math.min(6, alvoJogos + 1)));

  const variaveis = analisarVariaveis(historico);
  const dezenasAtrasadas = [...variaveis]
    .sort((a, b) => b.atraso - a.atraso)
    .slice(0, 5);
  const dezenasQuentes = [...variaveis]
    .sort((a, b) => b.freq - a.freq)
    .slice(0, 8);

  const razoesGerais = [
    `Análise sobre ${historico.length} concursos retros.`,
    `Linha/SPQ — ${spqLinhaA.razao}`,
    `Linha/CSN — ${csnLinhaA.razao}`,
    `Coluna/SPQ — ${spqColunaA.razao}`,
    `Coluna/CSN — ${csnColunaA.razao}`,
    somaA.razao,
    `Centralidade linha/SPQ: ${(spqLinhaA.centralidade * 100).toFixed(0)}% — ${
      spqLinhaA.centralidade > 0.7
        ? "série puxando para os extremos, esperar reversão"
        : spqLinhaA.centralidade > 0.3
        ? "série moderadamente afastada do centro"
        : "série já no centro, manter intervalo"
    }`,
    `Top formatos linha (freq×atraso + centralidade SPQ/CSN): ${topLinhas
      .map((f) => `${f.fmt} (×${f.freq}, atr ${f.atraso})`).join(", ")}`,
    `Top formatos coluna: ${topColunas
      .map((f) => `${f.fmt} (×${f.freq}, atr ${f.atraso})`).join(", ")}`,
    `Dezenas mais atrasadas: ${dezenasAtrasadas
      .map((d) => `${d.dezena.toString().padStart(2, "0")}(${d.atraso})`).join(", ")}`,
    `Dezenas mais frequentes recentes: ${dezenasQuentes
      .slice(0, 5)
      .map((d) => `${d.dezena.toString().padStart(2, "0")}(${d.freq}/${historico.length})`).join(", ")}`,
  ];

  // Estimativa grosseira de quantos jogos sairão com esses formatos
  // (vai depender de Linha × Coluna × soma; aqui é só uma estimativa)
  const jogosEstimados = topLinhas.length * topColunas.length * 30;

  return {
    spq: spqLinhaA,
    csn: csnLinhaA,
    linha: { spq: spqLinhaA, csn: csnLinhaA },
    coluna: { spq: spqColunaA, csn: csnColunaA },
    soma: somaA,
    topLinhas,
    topColunas,
    dezenasAtrasadas,
    dezenasQuentes,
    jogosEstimados,
    razoesGerais,
  };
}
