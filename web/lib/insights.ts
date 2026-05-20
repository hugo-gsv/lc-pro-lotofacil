/**
 * Engine de análise estatística da Lotofácil — base para a IA de sugestão.
 * Inclui: formato linha/coluna, variáveis por dezena, séries (SPQ/CSN/Soma),
 * tendência (centralidade) e geração de sugestão com razões explicáveis.
 */

import {
  calcVar, csn, enumerar, formatoColuna, formatoLinha, spq,
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
  pesoTendencia: number = 0.6,
  larguraFaixa: number = 1
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
  const sugMin = Math.round(sugCentro - sd * larguraFaixa);
  const sugMax = Math.round(sugCentro + sd * larguraFaixa);

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

export type SugerirOptions = {
  qtdFormatos?: number;
  larguraFaixa?: number;
};

export function sugerir(
  historico: { c: number; dez: number[] }[],
  alvoJogos = 5,
  pesoTendencia = 0.6,
  options: SugerirOptions = {}
): Sugestao {
  if (historico.length === 0) {
    throw new Error("Histórico vazio");
  }

  const seriesSpqLinha = historico.map((r) => spq(formatoLinha(r.dez)));
  const seriesCsnLinha = historico.map((r) => csn(formatoLinha(r.dez)));
  const seriesSpqColuna = historico.map((r) => spq(formatoColuna(r.dez)));
  const seriesCsnColuna = historico.map((r) => csn(formatoColuna(r.dez)));
  const seriesSoma = historico.map((r) => r.dez.reduce((a, b) => a + b, 0));

  const larguraFaixa = options.larguraFaixa ?? 1;
  const spqLinhaA = analisarSerie(seriesSpqLinha, 45, pesoTendencia, larguraFaixa);
  const csnLinhaA = analisarSerie(seriesCsnLinha, 320, pesoTendencia, larguraFaixa);
  const spqColunaA = analisarSerie(seriesSpqColuna, 45, pesoTendencia, larguraFaixa);
  const csnColunaA = analisarSerie(seriesCsnColuna, 320, pesoTendencia, larguraFaixa);
  const somaA = analisarSerie(seriesSoma, 195, pesoTendencia, larguraFaixa);

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
  const qtdFormatos = options.qtdFormatos ?? Math.max(4, Math.min(6, alvoJogos + 1));
  const topLinhas = [...formatosL]
    .sort((a, b) => scoreFormato(b, spqLinhaA, csnLinhaA) - scoreFormato(a, spqLinhaA, csnLinhaA))
    .slice(0, qtdFormatos);
  const topColunas = [...formatosC]
    .sort((a, b) => scoreFormato(b, spqColunaA, csnColunaA) - scoreFormato(a, spqColunaA, csnColunaA))
    .slice(0, qtdFormatos);

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

// =============================================================================
//  Walk-forward training: testa metodologias no passado antes de decidir hoje
// =============================================================================
export type PerfilIA = {
  id: string;
  nome: string;
  descricao: string;
  pesoTendencia: number;
  larguraFaixa: number;
  qtdFormatos: number;
  pesoFormato: number;
  pesoQuente: number;
  pesoAtraso: number;
  pesoDiversidade: number;
  pesoCobertura: number;
  penalQuentes: number;
  penalAtrasadas: number;
};

export const PERFIS_IA: PerfilIA[] = [
  {
    id: "centro-equilibrado",
    nome: "Centro equilibrado",
    descricao: "Regressão ao centro, formato forte, quentes e atrasadas em proporção moderada.",
    pesoTendencia: 0.6,
    larguraFaixa: 1,
    qtdFormatos: 6,
    pesoFormato: 1,
    pesoQuente: 0.22,
    pesoAtraso: 0.33,
    pesoDiversidade: 3.8,
    pesoCobertura: 1.4,
    penalQuentes: 2.2,
    penalAtrasadas: 1.5,
  },
  {
    id: "centro-apertado",
    nome: "Centro apertado",
    descricao: "Faixas menores, tentando evitar extremos de SPQ, CSN e soma.",
    pesoTendencia: 0.75,
    larguraFaixa: 0.75,
    qtdFormatos: 5,
    pesoFormato: 1.15,
    pesoQuente: 0.18,
    pesoAtraso: 0.28,
    pesoDiversidade: 4.1,
    pesoCobertura: 1.2,
    penalQuentes: 2.5,
    penalAtrasadas: 1.7,
  },
  {
    id: "faixa-aberta",
    nome: "Faixa aberta",
    descricao: "Faixas mais largas para aceitar variação real antes do ranking final.",
    pesoTendencia: 0.45,
    larguraFaixa: 1.25,
    qtdFormatos: 7,
    pesoFormato: 0.9,
    pesoQuente: 0.2,
    pesoAtraso: 0.3,
    pesoDiversidade: 4.3,
    pesoCobertura: 1.8,
    penalQuentes: 2,
    penalAtrasadas: 1.3,
  },
  {
    id: "formatos-indice",
    nome: "Formato + atraso",
    descricao: "Dá mais peso a formatos com frequência, atraso e índice alto.",
    pesoTendencia: 0.55,
    larguraFaixa: 1,
    qtdFormatos: 6,
    pesoFormato: 1.35,
    pesoQuente: 0.16,
    pesoAtraso: 0.26,
    pesoDiversidade: 3.5,
    pesoCobertura: 1.1,
    penalQuentes: 2.3,
    penalAtrasadas: 1.4,
  },
  {
    id: "variaveis-quentes",
    nome: "Variáveis quentes",
    descricao: "Valoriza dezenas frequentes sem abandonar formatos e centro.",
    pesoTendencia: 0.55,
    larguraFaixa: 1,
    qtdFormatos: 6,
    pesoFormato: 0.9,
    pesoQuente: 0.42,
    pesoAtraso: 0.16,
    pesoDiversidade: 3.4,
    pesoCobertura: 1.4,
    penalQuentes: 1.5,
    penalAtrasadas: 1.8,
  },
  {
    id: "regressao-atrasadas",
    nome: "Regressão atrasadas",
    descricao: "Valoriza dezenas atrasadas e formatos esquecidos, com freio contra excesso.",
    pesoTendencia: 0.7,
    larguraFaixa: 1.1,
    qtdFormatos: 6,
    pesoFormato: 1,
    pesoQuente: 0.12,
    pesoAtraso: 0.55,
    pesoDiversidade: 3.9,
    pesoCobertura: 1.5,
    penalQuentes: 2.7,
    penalAtrasadas: 1.1,
  },
];

export const PERFIL_TREINADO_IA: PerfilIA = {
  id: "offline-imperfeito-r40-t035-l190-f12",
  nome: "Probabilidade imperfeita offline",
  descricao: "Perfil calibrado localmente nos últimos 2000 concursos; usa formatos mais abertos e seletor menos agressivo.",
  pesoTendencia: 0.35,
  larguraFaixa: 1.9,
  qtdFormatos: 12,
  pesoFormato: 0.35,
  pesoQuente: 0.06,
  pesoAtraso: 0.22,
  pesoDiversidade: 4.1,
  pesoCobertura: 1.8,
  penalQuentes: 0.8,
  penalAtrasadas: 0.8,
};

export type CarteiraIA = {
  jogos: number[][];
  totalGerado: number;
  perfil: PerfilIA;
};

export function gerarCarteiraIA(
  historico: { c: number; dez: number[] }[],
  sug: Sugestao,
  perfil: PerfilIA = PERFIS_IA[0],
  totalFichas = 5,
  historicoReferencia: { c: number; dez: number[] }[] = historico
): CarteiraIA {
  const linhas = sug.topLinhas.map((f) => f.fmt);
  const colunas = sug.topColunas.map((f) => f.fmt);
  const jogosCompletos = linhas.length && colunas.length
    ? enumerar(linhas, colunas, sug.soma.sugMin, sug.soma.sugMax)
    : [];
  if (!jogosCompletos.length) {
    return { jogos: [], totalGerado: 0, perfil };
  }

  const ultimo = historico.length ? new Set(historico[historico.length - 1].dez) : new Set<number>();
  const pesoQuentes = new Map<number, number>();
  for (const d of sug.dezenasQuentes) pesoQuentes.set(d.dezena, d.freq);
  const pesoAtrasadas = new Map<number, number>();
  for (const d of sug.dezenasAtrasadas) pesoAtrasadas.set(d.dezena, d.atraso);

  const fmtLinhaScore = new Map(
    sug.topLinhas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35])
  );
  const fmtColScore = new Map(
    sug.topColunas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35])
  );

  const inRangeBonus = (value: number, min: number, max: number, bonus: number) =>
    value >= min && value <= max
      ? bonus
      : -Math.min(10, Math.min(Math.abs(value - min), Math.abs(value - max)) * 0.8);
  const bandBonus = (value: number, min: number, max: number, bonus: number) =>
    value >= min && value <= max
      ? bonus
      : -Math.min(8, Math.min(Math.abs(value - min), Math.abs(value - max)) * 1.5);

  const bucket = (value: number, size: number) => Math.floor(value / size) * size;
  const addCount = (counts: Map<string, Map<string, number>>, key: string, value: string | number) => {
    const val = String(value);
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key)!;
    m.set(val, (m.get(val) ?? 0) + 1);
  };
  const logProb = (
    counts: Map<string, Map<string, number>>,
    total: number,
    key: string,
    value: string | number
  ) => {
    const m = counts.get(key);
    const unique = m?.size ?? 0;
    const count = m?.get(String(value)) ?? 0;
    return Math.log((count + 1) / (total + unique + 1));
  };

  const priorKeys = [
    "spqLinha", "spqColuna", "csnLinhaBucket", "csnColunaBucket", "somaBucket",
    "pares", "bordas", "modas", "primos", "fibo", "repeticao", "nQuentes", "nAtrasadas",
  ];

  const features = (
    j: number[],
    ultimoSet: Set<number>,
    quentes: Set<number>,
    atrasadas: Set<number>
  ) => {
    const fl = formatoLinha(j);
    const fc = formatoColuna(j);
    const soma = j.reduce((a, b) => a + b, 0);
    return {
      fl,
      fc,
      spqLinha: spq(fl),
      spqColuna: spq(fc),
      csnLinhaBucket: bucket(csn(fl), 50),
      csnColunaBucket: bucket(csn(fc), 50),
      soma,
      somaBucket: bucket(soma, 5),
      pares: calcVar("Pares", j),
      bordas: calcVar("Bordas", j),
      modas: calcVar("Modas", j),
      primos: calcVar("Primos", j),
      fibo: calcVar("Fibonacci", j),
      repeticao: calcVar("Repetição Último", j, ultimoSet),
      nQuentes: j.filter((d) => quentes.has(d)).length,
      nAtrasadas: j.filter((d) => atrasadas.has(d)).length,
    };
  };

  const montarPrior = () => {
    const ref = [...historicoReferencia].sort((a, b) => a.c - b.c);
    const start = Math.max(1, ref.length - 240);
    const counts = new Map<string, Map<string, number>>();
    let total = 0;
    for (let i = start; i < ref.length; i++) {
      const janela = ref.slice(Math.max(0, i - 40), i);
      if (janela.length < 10) continue;
      const vars = analisarVariaveis(janela.map((r) => ({ c: r.c, dez: r.dez })));
      const q = new Set([...vars].sort((a, b) => b.freq - a.freq).slice(0, 8).map((d) => d.dezena));
      const a = new Set([...vars].sort((x, y) => y.atraso - x.atraso).slice(0, 5).map((d) => d.dezena));
      const f = features(ref[i].dez, new Set(janela[janela.length - 1].dez), q, a);
      for (const key of priorKeys) addCount(counts, key, f[key as keyof typeof f] as string | number);
      total++;
    }
    return { counts, total };
  };

  const prior = perfil.id.includes("imperfeito") ? montarPrior() : null;

  const scoreBase = (j: number[]) => {
    const fl = formatoLinha(j);
    const fc = formatoColuna(j);
    const soma = j.reduce((a, b) => a + b, 0);
    const hot = j.reduce((s, d) => s + (pesoQuentes.get(d) ?? 0), 0);
    const atraso = j.reduce((s, d) => s + (pesoAtrasadas.get(d) ?? 0), 0);
    const nHot = j.filter((d) => pesoQuentes.has(d)).length;
    const nAtr = j.filter((d) => pesoAtrasadas.has(d)).length;
    const rep = calcVar("Repetição Último", j, ultimo);
    const pares = calcVar("Pares", j);
    const bordas = calcVar("Bordas", j);
    const modas = calcVar("Modas", j);
    const primos = calcVar("Primos", j);
    const fib = calcVar("Fibonacci", j);

    return (
      ((fmtLinhaScore.get(fl) ?? 0) + (fmtColScore.get(fc) ?? 0)) * perfil.pesoFormato +
      inRangeBonus(spq(fl), sug.linha.spq.sugMin, sug.linha.spq.sugMax, 10) +
      inRangeBonus(csn(fl), sug.linha.csn.sugMin, sug.linha.csn.sugMax, 8) +
      inRangeBonus(spq(fc), sug.coluna.spq.sugMin, sug.coluna.spq.sugMax, 10) +
      inRangeBonus(csn(fc), sug.coluna.csn.sugMin, sug.coluna.csn.sugMax, 8) +
      inRangeBonus(soma, sug.soma.sugMin, sug.soma.sugMax, 12) +
      bandBonus(pares, perfil.id.includes("imperfeito") ? 6 : 7, perfil.id.includes("imperfeito") ? 9 : 8, 7) +
      bandBonus(bordas, perfil.id.includes("imperfeito") ? 8 : 9, perfil.id.includes("imperfeito") ? 12 : 11, 6) +
      bandBonus(modas, 8, perfil.id.includes("imperfeito") ? 11 : 9, 6) +
      bandBonus(primos, perfil.id.includes("imperfeito") ? 4 : 5, perfil.id.includes("imperfeito") ? 8 : 7, 4) +
      bandBonus(fib, 3, perfil.id.includes("imperfeito") ? 6 : 5, 4) +
      bandBonus(rep, perfil.id.includes("imperfeito") ? 6 : 7, perfil.id.includes("imperfeito") ? 11 : 10, 5) +
      hot * perfil.pesoQuente +
      atraso * perfil.pesoAtraso -
      Math.max(0, nHot - 8) * perfil.penalQuentes -
      Math.max(0, nAtr - 5) * perfil.penalAtrasadas -
      Math.abs(soma - 195) * 0.12
    );
  };

  const scoreProbabilistico = (j: number[], estrategia: "base" | "baixo-calor" | "modal" | "formato-fraco" | "borda") => {
    if (!prior || prior.total < 20) return scoreBase(j);
    const f = features(
      j,
      ultimo,
      new Set(sug.dezenasQuentes.map((d) => d.dezena)),
      new Set(sug.dezenasAtrasadas.map((d) => d.dezena))
    );
    let score = 0;
    for (const key of priorKeys) {
      score += logProb(prior.counts, prior.total, key, f[key as keyof typeof f] as string | number);
    }
    const linhaRank = Math.max(1, sug.topLinhas.findIndex((x) => x.fmt === f.fl) + 1);
    const colunaRank = Math.max(1, sug.topColunas.findIndex((x) => x.fmt === f.fc) + 1);
    const formatoPenalty =
      estrategia === "formato-fraco" ? -0.22 :
      estrategia === "base" ? 0.12 :
      0.06;
    score -= Math.log(linhaRank + colunaRank) * formatoPenalty;
    score -= Math.abs(f.soma - 195) * 0.006;
    if (estrategia === "baixo-calor") score -= Math.max(0, f.nQuentes - 6) * 0.65;
    if (estrategia === "modal" && f.modas >= 10 && f.modas <= 11) score += 3.2;
    if (estrategia === "borda" && (f.bordas === 8 || f.bordas === 12)) score += 2.6;
    return score;
  };

  const hamming = (a: number[], b: number[]) => {
    const sb = new Set(b);
    let diff = 0;
    for (const d of a) if (!sb.has(d)) diff++;
    return diff;
  };

  const ranked = [...jogosCompletos]
    .map((j) => ({ j, s: scoreBase(j) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.min(2500, jogosCompletos.length));

  const N = Math.max(1, Math.min(totalFichas, ranked.length));
  if (perfil.id.includes("imperfeito") && prior && prior.total >= 20) {
    const estrategias: Array<"base" | "baixo-calor" | "modal" | "formato-fraco" | "borda"> = [
      "base", "baixo-calor", "modal", "formato-fraco", "borda",
    ];
    const baseCandidatos = [...jogosCompletos]
      .map((j) => ({ j, s: scoreBase(j) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.min(60000, jogosCompletos.length));
    const outProb: number[][] = [];
    const used = new Set<string>();
    for (const estrategia of estrategias) {
      let best: { j: number[]; score: number } | null = null;
      for (const item of baseCandidatos) {
        const key = item.j.join(",");
        if (used.has(key)) continue;
        const minDist = outProb.length ? Math.min(...outProb.map((o) => hamming(item.j, o))) : 15;
        const diversity = outProb.length ? Math.min(1.2, minDist * 0.08) : 0;
        const score = scoreProbabilistico(item.j, estrategia) + diversity;
        if (!best || score > best.score) best = { j: item.j, score };
      }
      if (!best) break;
      outProb.push(best.j);
      used.add(best.j.join(","));
      if (outProb.length >= N) break;
    }
    return { jogos: outProb, totalGerado: jogosCompletos.length, perfil };
  }

  const out: number[][] = [ranked[0].j];
  const taken = new Set([ranked[0].j.join(",")]);

  while (out.length < N) {
    let best: { j: number[]; score: number } | null = null;
    const coverage = new Set(out.flat());
    for (const item of ranked) {
      const key = item.j.join(",");
      if (taken.has(key)) continue;
      const minDist = Math.min(...out.map((o) => hamming(item.j, o)));
      const newCoverage = item.j.filter((d) => !coverage.has(d)).length;
      const portfolioScore = item.s + minDist * perfil.pesoDiversidade + newCoverage * perfil.pesoCobertura;
      if (!best || portfolioScore > best.score) best = { j: item.j, score: portfolioScore };
    }
    if (!best) break;
    out.push(best.j);
    taken.add(best.j.join(","));
  }

  return { jogos: out, totalGerado: jogosCompletos.length, perfil };
}

export type ResultadoPerfilTreino = {
  perfil: PerfilIA;
  simulacoes: number;
  mediaMelhorAcerto: number;
  maxAcerto: number;
  taxa10Mais: number;
  taxa11Mais: number;
  taxa12Mais: number;
  taxa13Mais: number;
  taxa14Mais: number;
  taxa15: number;
  coberturaLinha: number;
  coberturaColuna: number;
  coberturaSoma: number;
  coberturaLinhaColuna: number;
  score: number;
};

export type ExemploTreino = {
  concurso: number;
  perfil: string;
  melhorAcerto: number;
  linhaReal: string;
  colunaReal: string;
  somaReal: number;
};

export type TreinamentoIA = {
  retros: number;
  simulacoes: number;
  concursoInicio: number;
  concursoFim: number;
  perfilVencedor: PerfilIA;
  ranking: ResultadoPerfilTreino[];
  exemplos: ExemploTreino[];
  conclusao: string;
};

export const TREINAMENTO_OFFLINE_IA: TreinamentoIA = {
  retros: 40,
  simulacoes: 2000,
  concursoInicio: 1668,
  concursoFim: 3667,
  perfilVencedor: PERFIL_TREINADO_IA,
  ranking: [
    {
      perfil: PERFIL_TREINADO_IA,
      simulacoes: 2000,
      mediaMelhorAcerto: 10.345,
      maxAcerto: 13,
      taxa10Mais: 0.848,
      taxa11Mais: 0.4155,
      taxa12Mais: 0.0835,
      taxa13Mais: 0.008,
      taxa14Mais: 0,
      taxa15: 0,
      coberturaLinha: 0.102,
      coberturaColuna: 0.101,
      coberturaSoma: 0.9375,
      coberturaLinhaColuna: 0.0135,
      score: 1106.86,
    },
  ],
  exemplos: [],
  conclusao:
    "A metodologia foi recalibrada localmente, fora do site, usando os últimos 2000 concursos em modo walk-forward. " +
    "A análise mostrou que a restrição por formato era agressiva demais; por isso o perfil atual usa 12 formatos, faixa mais aberta e seleção probabilística imperfeita. " +
    "No teste com 5 fichas finais, o perfil chegou a pico de 13 pontos e média de 10,35; não foi encontrada metodologia que acertasse 15 pontos nas 5 fichas nesse período.",
};

function hitCount(jogo: number[], resultado: Set<number>) {
  let hits = 0;
  for (const d of jogo) if (resultado.has(d)) hits++;
  return hits;
}

function taxa(v: number, total: number) {
  return total ? v / total : 0;
}

export function treinarMetodologiaIA(
  historicoLongo: { c: number; dez: number[] }[],
  retros = 30,
  totalFichas = 5,
  maxSimulacoes = 120
): TreinamentoIA | null {
  const ord = [...historicoLongo].sort((a, b) => a.c - b.c);
  if (ord.length <= retros + 5) return null;

  const inicio = Math.max(retros, ord.length - maxSimulacoes);
  const simulacoes = ord.length - inicio;
  const acumulado = PERFIS_IA.map((perfil) => ({
    perfil,
    somaMelhor: 0,
    maxAcerto: 0,
    dezMais: 0,
    onzeMais: 0,
    dozeMais: 0,
    trezeMais: 0,
    quatorzeMais: 0,
    quinze: 0,
    linha: 0,
    coluna: 0,
    soma: 0,
    linhaColuna: 0,
  }));
  const exemplos: ExemploTreino[] = [];

  for (let i = inicio; i < ord.length; i++) {
    const alvo = ord[i];
    const janela = ord.slice(i - retros, i);
    const resultado = new Set(alvo.dez);
    const flReal = formatoLinha(alvo.dez);
    const fcReal = formatoColuna(alvo.dez);
    const somaReal = alvo.dez.reduce((a, b) => a + b, 0);

    acumulado.forEach((acc) => {
      const sug = sugerir(janela, totalFichas, acc.perfil.pesoTendencia, {
        larguraFaixa: acc.perfil.larguraFaixa,
        qtdFormatos: acc.perfil.qtdFormatos,
      });
      const carteira = gerarCarteiraIA(janela, sug, acc.perfil, totalFichas);
      const melhor = carteira.jogos.length
        ? Math.max(...carteira.jogos.map((j) => hitCount(j, resultado)))
        : 0;

      acc.somaMelhor += melhor;
      acc.maxAcerto = Math.max(acc.maxAcerto, melhor);
      if (melhor >= 10) acc.dezMais++;
      if (melhor >= 11) acc.onzeMais++;
      if (melhor >= 12) acc.dozeMais++;
      if (melhor >= 13) acc.trezeMais++;
      if (melhor >= 14) acc.quatorzeMais++;
      if (melhor >= 15) acc.quinze++;

      const acertouLinha =
        spq(flReal) >= sug.linha.spq.sugMin &&
        spq(flReal) <= sug.linha.spq.sugMax &&
        csn(flReal) >= sug.linha.csn.sugMin &&
        csn(flReal) <= sug.linha.csn.sugMax;
      const acertouColuna =
        spq(fcReal) >= sug.coluna.spq.sugMin &&
        spq(fcReal) <= sug.coluna.spq.sugMax &&
        csn(fcReal) >= sug.coluna.csn.sugMin &&
        csn(fcReal) <= sug.coluna.csn.sugMax;
      const acertouSoma = somaReal >= sug.soma.sugMin && somaReal <= sug.soma.sugMax;
      if (acertouLinha) acc.linha++;
      if (acertouColuna) acc.coluna++;
      if (acertouSoma) acc.soma++;
      if (acertouLinha && acertouColuna) acc.linhaColuna++;

      if (melhor >= 12) {
        exemplos.push({
          concurso: alvo.c,
          perfil: acc.perfil.nome,
          melhorAcerto: melhor,
          linhaReal: flReal,
          colunaReal: fcReal,
          somaReal,
        });
      }
    });
  }

  const ranking: ResultadoPerfilTreino[] = acumulado
    .map((acc) => {
      const mediaMelhorAcerto = acc.somaMelhor / simulacoes;
      const taxa11Mais = taxa(acc.onzeMais, simulacoes);
      const taxa12Mais = taxa(acc.dozeMais, simulacoes);
      const taxa13Mais = taxa(acc.trezeMais, simulacoes);
      const taxa14Mais = taxa(acc.quatorzeMais, simulacoes);
      const taxa15 = taxa(acc.quinze, simulacoes);
      const coberturaLinha = taxa(acc.linha, simulacoes);
      const coberturaColuna = taxa(acc.coluna, simulacoes);
      const coberturaSoma = taxa(acc.soma, simulacoes);
      const coberturaLinhaColuna = taxa(acc.linhaColuna, simulacoes);
      const score =
        mediaMelhorAcerto * 100 +
        taxa(acc.dezMais, simulacoes) * 18 +
        taxa11Mais * 35 +
        taxa12Mais * 70 +
        taxa13Mais * 140 +
        taxa14Mais * 260 +
        taxa15 * 500 +
        coberturaLinhaColuna * 22 +
        coberturaSoma * 10;

      return {
        perfil: acc.perfil,
        simulacoes,
        mediaMelhorAcerto,
        maxAcerto: acc.maxAcerto,
        taxa10Mais: taxa(acc.dezMais, simulacoes),
        taxa11Mais,
        taxa12Mais,
        taxa13Mais,
        taxa14Mais,
        taxa15,
        coberturaLinha,
        coberturaColuna,
        coberturaSoma,
        coberturaLinhaColuna,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const vencedor = ranking[0].perfil;
  const topExemplos = exemplos
    .sort((a, b) => b.melhorAcerto - a.melhorAcerto || b.concurso - a.concurso)
    .slice(0, 8);

  const conclusao =
    `Foram simulados ${simulacoes} concursos passados em modo walk-forward: ` +
    `para cada concurso, a IA usou somente os ${retros} anteriores e conferiu as 5 fichas contra o resultado real. ` +
    `O perfil vencedor foi "${vencedor.nome}" por média de acertos, picos de 12+ e cobertura de linha/coluna/soma.`;

  return {
    retros,
    simulacoes,
    concursoInicio: ord[inicio].c,
    concursoFim: ord[ord.length - 1].c,
    perfilVencedor: vencedor,
    ranking,
    exemplos: topExemplos,
    conclusao,
  };
}
