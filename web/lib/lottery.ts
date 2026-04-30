/**
 * Núcleo do LC Pro — fórmulas SPQ, CSN, MODAIS, geometria 5×5.
 * Validado byte-a-byte contra os arquivos do app Liberty BASIC original.
 */

// ===== Conjuntos canônicos =====
export const MODAIS = new Set([
  1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 18, 20, 22, 24, 25,
]);
export const BORDAS = new Set([
  1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25,
]);
export const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
export const FIBO = new Set([1, 2, 3, 5, 8, 13, 21]);

export const linhaDe = (d: number) => Math.floor((d - 1) / 5) + 1;
export const colunaDe = (d: number) => ((d - 1) % 5) + 1;

export function formatoLinha(dez: number[]): string {
  const cnt = [0, 0, 0, 0, 0];
  for (const d of dez) cnt[Math.floor((d - 1) / 5)]++;
  return cnt.join("");
}

export function formatoColuna(dez: number[]): string {
  const cnt = [0, 0, 0, 0, 0];
  for (const d of dez) cnt[(d - 1) % 5]++;
  return cnt.join("");
}

// ===== SPQ — soma ponderada por posição =====
export function spq(fmt: string): number {
  if (fmt.length !== 5) return 0;
  let sum = 0;
  for (let i = 0; i < 5; i++) sum += parseInt(fmt[i]) * (i + 1);
  return sum;
}

// ===== CSN — Combination Sequence Number =====
function buildCsnMap(): Map<string, number> {
  const fmts: string[] = [];
  for (let a = 0; a <= 5; a++)
    for (let b = 0; b <= 5; b++)
      for (let c = 0; c <= 5; c++)
        for (let d = 0; d <= 5; d++) {
          const e = 15 - a - b - c - d;
          if (e >= 0 && e <= 5) fmts.push(`${a}${b}${c}${d}${e}`);
        }
  fmts.sort((x, y) => parseInt(x) - parseInt(y));
  const map = new Map<string, number>();
  fmts.forEach((f, i) => map.set(f, i + 1));
  return map;
}

const _CSN_MAP = buildCsnMap();
export function csn(fmt: string): number {
  return _CSN_MAP.get(fmt) ?? 0;
}
export function todosFormatos(): string[] {
  return [..._CSN_MAP.keys()];
}

// ===== Filtros =====
export function seqMax(dez: number[]): number {
  const s = [...dez].sort((a, b) => a - b);
  let best = 1, cur = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1] + 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

export type FilterName =
  | "Pares" | "Bordas" | "Modas" | "Primos" | "Fibonacci"
  | "Repetição Último" | "Posição 4" | "Posição 8" | "Posição 12"
  | "Soma" | "Sequência máxima";

export function calcVar(
  nome: FilterName,
  dez: number[],
  retroSet: Set<number> = new Set()
): number {
  const sd = new Set(dez);
  const inter = (S: Set<number>) => [...sd].filter((x) => S.has(x)).length;
  switch (nome) {
    case "Pares": return dez.filter((d) => d % 2 === 0).length;
    case "Bordas": return inter(BORDAS);
    case "Modas": return inter(MODAIS);
    case "Primos": return inter(PRIMOS);
    case "Fibonacci": return inter(FIBO);
    case "Repetição Último": return inter(retroSet);
    case "Posição 4": return dez[3] ?? 0;
    case "Posição 8": return dez[7] ?? 0;
    case "Posição 12": return dez[11] ?? 0;
    case "Soma": return dez.reduce((a, b) => a + b, 0);
    case "Sequência máxima": return seqMax(dez);
  }
}

// ===== API Caixa =====
const CAIXA = "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil";

export async function fetchConcurso(
  numero?: number,
  signal?: AbortSignal
): Promise<{ numero: number; dataApuracao: string; listaDezenas: string[] }> {
  const url = numero ? `${CAIXA}/${numero}` : CAIXA;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 lc-pro-lotofacil/2.0" },
    signal,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Caixa API ${r.status}`);
  return r.json();
}

export async function fetchRange(start: number, end: number, concurrency = 10) {
  const results = new Map<number, number[]>();
  const queue = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  async function worker() {
    while (queue.length) {
      const n = queue.shift()!;
      try {
        const d = await fetchConcurso(n);
        results.set(n, d.listaDezenas.map((x) => parseInt(x)).sort((a, b) => a - b));
      } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

export function dezenasDe(api: { listaDezenas: string[] }): number[] {
  return api.listaDezenas.map((x) => parseInt(x)).sort((a, b) => a - b);
}

// ===== Geração de combinações =====
function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return; }
  if (k > arr.length) return;
  for (let i = 0; i <= arr.length - k; i++) {
    for (const tail of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...tail];
    }
  }
}

export function enumerar(
  linhas: string[],
  colunas: string[],
  somaMin = 120,
  somaMax = 270
): number[][] {
  const out: number[][] = [];
  const ls = linhas.length ? linhas : ["33333"];
  const cs = colunas.length ? colunas : ["33333"];
  const colSet = new Set(cs);
  for (const fl of ls) {
    if (fl.split("").reduce((a, b) => a + parseInt(b), 0) !== 15) continue;
    const escolhas: number[][][] = [];
    for (let i = 0; i < 5; i++) {
      const k = parseInt(fl[i]);
      const dezsLinha = [1, 2, 3, 4, 5].map((j) => 5 * i + j);
      escolhas.push([...combinations(dezsLinha, k)]);
    }
    function* product(idx: number, acc: number[]): Generator<number[]> {
      if (idx === 5) { yield acc; return; }
      for (const c of escolhas[idx]) yield* product(idx + 1, [...acc, ...c]);
    }
    for (const jogo of product(0, [])) {
      const soma = jogo.reduce((a, b) => a + b, 0);
      if (soma < somaMin || soma > somaMax) continue;
      const cc = [0, 0, 0, 0, 0];
      for (const d of jogo) cc[(d - 1) % 5]++;
      if (!colSet.has(cc.join(""))) continue;
      out.push([...jogo].sort((a, b) => a - b));
    }
  }
  return out;
}
