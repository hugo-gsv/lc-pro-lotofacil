#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const RESULTADOS_PADRAO =
  "/Users/mac/Documents/Claude/Projects/Apps loteria/macOS/LTF Resultados/resltf.txt";

const MODAIS = new Set([1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 18, 20, 22, 24, 25]);
const BORDAS = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);
const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
const FIBO = new Set([1, 2, 3, 5, 8, 13, 21]);

function arg(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  return raw ? raw.split("=").slice(1).join("=") : fallback;
}

function parseResultados(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const nums = line.match(/\d+/g)?.map(Number) ?? [];
      return { c: nums[0], dez: nums.slice(1).sort((a, b) => a - b) };
    })
    .filter((r) => Number.isFinite(r.c) && r.dez.length === 15)
    .sort((a, b) => a.c - b.c);
}

function buildCsnMap() {
  const fmts = [];
  for (let a = 0; a <= 5; a++)
    for (let b = 0; b <= 5; b++)
      for (let c = 0; c <= 5; c++)
        for (let d = 0; d <= 5; d++) {
          const e = 15 - a - b - c - d;
          if (e >= 0 && e <= 5) fmts.push(`${a}${b}${c}${d}${e}`);
        }
  fmts.sort((x, y) => parseInt(x) - parseInt(y));
  return new Map(fmts.map((f, i) => [f, i + 1]));
}

const CSN_MAP = buildCsnMap();
const TODOS_FORMATOS = [...CSN_MAP.keys()];
const csn = (fmt) => CSN_MAP.get(fmt) ?? 0;
const spq = (fmt) => fmt.split("").reduce((s, d, i) => s + parseInt(d) * (i + 1), 0);

function formatoLinha(dez) {
  const cnt = [0, 0, 0, 0, 0];
  for (const d of dez) cnt[Math.floor((d - 1) / 5)]++;
  return cnt.join("");
}

function formatoColuna(dez) {
  const cnt = [0, 0, 0, 0, 0];
  for (const d of dez) cnt[(d - 1) % 5]++;
  return cnt.join("");
}

function media(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function desvio(arr, m = media(arr)) {
  return arr.length ? Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length) : 0;
}

function analisarSerie(valores, centro, pesoTendencia, larguraFaixa) {
  const m = media(valores);
  const sd = desvio(valores, m);
  const tend = media(valores.slice(-5));
  const ajuste = (centro - tend) * pesoTendencia * 0.5;
  const sugCentro = m + ajuste;
  return {
    media: m,
    desvio: sd,
    ultimaTendencia: tend,
    sugMin: Math.round(sugCentro - sd * larguraFaixa),
    sugMax: Math.round(sugCentro + sd * larguraFaixa),
  };
}

function analisarFormatos(historico, funcao) {
  const freq = new Map();
  const ultima = new Map();
  historico.forEach((r, i) => {
    const f = funcao(r.dez);
    freq.set(f, (freq.get(f) ?? 0) + 1);
    ultima.set(f, i);
  });
  return TODOS_FORMATOS.map((fmt) => {
    const fr = freq.get(fmt) ?? 0;
    const last = ultima.has(fmt) ? ultima.get(fmt) : -1;
    const atraso = historico.length - 1 - last;
    return { fmt, freq: fr, atraso, indice: fr * atraso };
  });
}

function scoreFormato(f, spqRange, csnRange, perfil) {
  const s = spq(f.fmt);
  const c = csn(f.fmt);
  const inSpq = s >= spqRange.sugMin && s <= spqRange.sugMax;
  const inCsn = c >= csnRange.sugMin && c <= csnRange.sugMax;
  return f.freq * perfil.fmtFreq +
    f.atraso * perfil.fmtAtraso +
    f.indice * perfil.fmtIndice +
    (inSpq ? perfil.bonusSpq : -perfil.penSpq) +
    (inCsn ? perfil.bonusCsn : -perfil.penCsn) -
    Math.abs(s - 45) * perfil.distSpq -
    Math.abs(c - 320) / 20 * perfil.distCsn;
}

function analisarVariaveis(historico) {
  const out = [];
  const N = historico.length;
  for (let d = 1; d <= 25; d++) {
    const ocorr = historico.map((r) => r.dez.includes(d));
    const freq = ocorr.filter(Boolean).length;
    let atraso = 0;
    for (let i = N - 1; i >= 0; i--) {
      if (ocorr[i]) break;
      atraso++;
    }
    out.push({ dezena: d, freq, atraso });
  }
  return out;
}

function sugerir(historico, perfil) {
  const linhaSpq = analisarSerie(historico.map((r) => spq(formatoLinha(r.dez))), 45, perfil.pesoTendencia, perfil.larguraFaixa);
  const linhaCsn = analisarSerie(historico.map((r) => csn(formatoLinha(r.dez))), 320, perfil.pesoTendencia, perfil.larguraFaixa);
  const colunaSpq = analisarSerie(historico.map((r) => spq(formatoColuna(r.dez))), 45, perfil.pesoTendencia, perfil.larguraFaixa);
  const colunaCsn = analisarSerie(historico.map((r) => csn(formatoColuna(r.dez))), 320, perfil.pesoTendencia, perfil.larguraFaixa);
  const soma = analisarSerie(historico.map((r) => r.dez.reduce((a, b) => a + b, 0)), 195, perfil.pesoTendencia, perfil.larguraFaixa);

  const linhaRank = analisarFormatos(historico, formatoLinha)
    .map((f) => ({ ...f, score: scoreFormato(f, linhaSpq, linhaCsn, perfil) }))
    .sort((a, b) => b.score - a.score);
  const colunaRank = analisarFormatos(historico, formatoColuna)
    .map((f) => ({ ...f, score: scoreFormato(f, colunaSpq, colunaCsn, perfil) }))
    .sort((a, b) => b.score - a.score);
  const variaveis = analisarVariaveis(historico);

  return {
    linha: { spq: linhaSpq, csn: linhaCsn },
    coluna: { spq: colunaSpq, csn: colunaCsn },
    soma,
    linhaRank,
    colunaRank,
    topLinhas: linhaRank.slice(0, perfil.qtdFormatos),
    topColunas: colunaRank.slice(0, perfil.qtdFormatos),
    dezenasQuentes: [...variaveis].sort((a, b) => b.freq - a.freq).slice(0, perfil.nQuentes),
    dezenasAtrasadas: [...variaveis].sort((a, b) => b.atraso - a.atraso).slice(0, perfil.nAtrasadas),
  };
}

function* combinations(arr, k) {
  if (k === 0) {
    yield [];
    return;
  }
  if (k > arr.length) return;
  for (let i = 0; i <= arr.length - k; i++) {
    for (const tail of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...tail];
    }
  }
}

function enumerar(linhas, colunas, somaMin, somaMax, maxOut = 60000) {
  const out = [];
  const colSet = new Set(colunas);
  for (const fl of linhas) {
    const escolhas = [];
    for (let i = 0; i < 5; i++) {
      const k = parseInt(fl[i]);
      const dezsLinha = [1, 2, 3, 4, 5].map((j) => 5 * i + j);
      escolhas.push([...combinations(dezsLinha, k)]);
    }
    function* product(idx, acc) {
      if (idx === 5) {
        yield acc;
        return;
      }
      for (const c of escolhas[idx]) yield* product(idx + 1, [...acc, ...c]);
    }
    for (const jogo of product(0, [])) {
      const soma = jogo.reduce((a, b) => a + b, 0);
      if (soma < somaMin || soma > somaMax) continue;
      const cc = [0, 0, 0, 0, 0];
      for (const d of jogo) cc[(d - 1) % 5]++;
      if (!colSet.has(cc.join(""))) continue;
      out.push([...jogo].sort((a, b) => a - b));
      if (out.length >= maxOut) return out;
    }
  }
  return out;
}

function calcVar(nome, dez, retroSet = new Set()) {
  const sd = new Set(dez);
  const inter = (S) => [...sd].filter((x) => S.has(x)).length;
  switch (nome) {
    case "Pares": return dez.filter((d) => d % 2 === 0).length;
    case "Bordas": return inter(BORDAS);
    case "Modas": return inter(MODAIS);
    case "Primos": return inter(PRIMOS);
    case "Fibonacci": return inter(FIBO);
    case "Repetição Último": return inter(retroSet);
    case "Soma": return dez.reduce((a, b) => a + b, 0);
    default: return 0;
  }
}

function rankBucket(rank) {
  if (rank <= 1) return "1";
  if (rank <= 3) return "2-3";
  if (rank <= 5) return "4-5";
  if (rank <= 10) return "6-10";
  if (rank <= 20) return "11-20";
  return "21+";
}

function bucket(value, size) {
  return Math.floor(value / size) * size;
}

function features(jogo, historico, sug) {
  const fl = formatoLinha(jogo);
  const fc = formatoColuna(jogo);
  const ultimo = new Set(historico.at(-1)?.dez ?? []);
  const quentes = new Set(sug.dezenasQuentes.map((d) => d.dezena));
  const atrasadas = new Set(sug.dezenasAtrasadas.map((d) => d.dezena));
  const linhaRank = Math.max(1, sug.linhaRank.findIndex((f) => f.fmt === fl) + 1);
  const colunaRank = Math.max(1, sug.colunaRank.findIndex((f) => f.fmt === fc) + 1);
  const soma = calcVar("Soma", jogo);
  return {
    fl,
    fc,
    linhaRank,
    colunaRank,
    linhaRankBucket: rankBucket(linhaRank),
    colunaRankBucket: rankBucket(colunaRank),
    spqLinha: spq(fl),
    spqColuna: spq(fc),
    csnLinhaBucket: bucket(csn(fl), 50),
    csnColunaBucket: bucket(csn(fc), 50),
    soma,
    somaBucket: bucket(soma, 5),
    pares: calcVar("Pares", jogo),
    bordas: calcVar("Bordas", jogo),
    modas: calcVar("Modas", jogo),
    primos: calcVar("Primos", jogo),
    fibo: calcVar("Fibonacci", jogo),
    repeticao: calcVar("Repetição Último", jogo, ultimo),
    nQuentes: jogo.filter((d) => quentes.has(d)).length,
    nAtrasadas: jogo.filter((d) => atrasadas.has(d)).length,
  };
}

function makePerfil(overrides = {}) {
  return {
    id: "base",
    retros: 30,
    pesoTendencia: 0.45,
    larguraFaixa: 1.6,
    qtdFormatos: 7,
    fmtFreq: 12,
    fmtAtraso: 1.4,
    fmtIndice: 0.75,
    bonusSpq: 16,
    bonusCsn: 12,
    penSpq: 12,
    penCsn: 8,
    distSpq: 1.2,
    distCsn: 0.6,
    nQuentes: 8,
    nAtrasadas: 5,
    maxGerados: 60000,
    ...overrides,
  };
}

function coveragePerfis(mode = "grid") {
  const retrosList = mode === "wide" ? [30, 40, 50] : [30, 50];
  const tendenciaList = mode === "wide" ? [0.35, 0.45, 0.6] : [0.45, 0.6];
  const larguraList = mode === "wide" ? [1.35, 1.6, 1.9, 2.2] : [1.6, 1.9, 2.2];
  const formatosList = mode === "wide" ? [5, 7, 10, 12, 20, 30, 50] : [5, 7, 10];
  const out = [];
  for (const retros of retrosList)
    for (const pesoTendencia of tendenciaList)
      for (const larguraFaixa of larguraList)
        for (const qtdFormatos of formatosList) {
          out.push(makePerfil({
            id: `r${retros}-t${pesoTendencia}-l${larguraFaixa}-f${qtdFormatos}`,
            retros,
            pesoTendencia,
            larguraFaixa,
            qtdFormatos,
          }));
        }
  return out;
}

function hitCount(jogo, resultado) {
  const s = new Set(resultado);
  return jogo.reduce((acc, d) => acc + (s.has(d) ? 1 : 0), 0);
}

function addCount(map, key, value) {
  if (!map.has(key)) map.set(key, new Map());
  const m = map.get(key);
  m.set(value, (m.get(value) ?? 0) + 1);
}

function buildPrior(records, keys) {
  const counts = new Map();
  for (const rec of records) {
    for (const k of keys) addCount(counts, k, rec[k]);
  }
  return { counts, total: records.length };
}

function logProb(prior, key, value) {
  const m = prior.counts.get(key);
  const unique = m?.size ?? 0;
  const count = m?.get(value) ?? 0;
  return Math.log((count + 1) / (prior.total + unique + 1));
}

const PRIOR_KEYS = [
  "linhaRankBucket", "colunaRankBucket", "spqLinha", "spqColuna",
  "csnLinhaBucket", "csnColunaBucket", "somaBucket",
  "pares", "bordas", "modas", "primos", "fibo", "repeticao",
  "nQuentes", "nAtrasadas",
];

const STRATEGIAS = [
  { id: "probabilidade-imperfeita", formatoPenalty: 0.12, hotPenalty: 0.05, modalFlex: 0, bordaFlex: 0 },
  { id: "baixo-calor", formatoPenalty: 0.06, hotPenalty: 0.65, modalFlex: 0, bordaFlex: 0 },
  { id: "modal-expandido", formatoPenalty: 0.08, hotPenalty: 0.15, modalFlex: 3.2, bordaFlex: 0 },
  { id: "formato-fraco", formatoPenalty: -0.22, hotPenalty: 0.08, modalFlex: 0, bordaFlex: 0 },
  { id: "borda-imperfeita", formatoPenalty: 0.04, hotPenalty: 0.12, modalFlex: 0, bordaFlex: 2.6 },
];

function scoreProb(feat, prior, estrategia) {
  let score = 0;
  for (const k of PRIOR_KEYS) score += logProb(prior, k, feat[k]);
  score -= Math.log(feat.linhaRank + feat.colunaRank) * estrategia.formatoPenalty;
  score -= Math.max(0, feat.nQuentes - 6) * estrategia.hotPenalty;
  if (feat.modas >= 10 && feat.modas <= 11) score += estrategia.modalFlex;
  if (feat.bordas === 8 || feat.bordas === 12) score += estrategia.bordaFlex;
  score -= Math.abs(feat.soma - 195) * 0.006;
  return score;
}

function hamming(a, b) {
  const sb = new Set(b);
  return a.reduce((diff, d) => diff + (sb.has(d) ? 0 : 1), 0);
}

function selectFive(candidatos, prior, historico, sug) {
  const all = candidatos.map((jogo) => {
    const feat = features(jogo, historico, sug);
    return {
      jogo,
      key: jogo.join(","),
      feat,
      scores: Object.fromEntries(STRATEGIAS.map((s) => [s.id, scoreProb(feat, prior, s)])),
    };
  });
  const selected = [];
  const used = new Set();

  for (const estrategia of STRATEGIAS) {
    let best = null;
    for (const item of all) {
      if (used.has(item.key)) continue;
      const minDist = selected.length ? Math.min(...selected.map((s) => hamming(item.jogo, s.jogo))) : 15;
      const diversity = selected.length ? Math.min(1.2, minDist * 0.08) : 0;
      const score = item.scores[estrategia.id] + diversity;
      if (!best || score > best.score) best = { ...item, estrategia: estrategia.id, score };
    }
    if (best) {
      selected.push(best);
      used.add(best.key);
    }
  }

  return { selected, all };
}

function precomputeActualFeatures(resultados, perfil) {
  const out = new Array(resultados.length).fill(null);
  for (let i = perfil.retros; i < resultados.length; i++) {
    const hist = resultados.slice(i - perfil.retros, i);
    const sug = sugerir(hist, perfil);
    out[i] = features(resultados[i].dez, hist, sug);
  }
  return out;
}

function coverageMode(resultados, from, to, mode) {
  const perfis = coveragePerfis(mode);
  const ranking = [];
  for (const perfil of perfis) {
    const acc = {
      perfil,
      simulacoes: 0,
      universo15: 0,
      linhaFmt: 0,
      colFmt: 0,
      soma: 0,
      faixaLinha: 0,
      faixaColuna: 0,
    };
    for (let i = 0; i < resultados.length; i++) {
      const alvo = resultados[i];
      if (alvo.c < from || alvo.c > to || i < perfil.retros) continue;
      const hist = resultados.slice(i - perfil.retros, i);
      const sug = sugerir(hist, perfil);
      const fl = formatoLinha(alvo.dez);
      const fc = formatoColuna(alvo.dez);
      const soma = alvo.dez.reduce((a, b) => a + b, 0);
      const linhaFmt = sug.topLinhas.some((f) => f.fmt === fl);
      const colFmt = sug.topColunas.some((f) => f.fmt === fc);
      const faixaLinha =
        spq(fl) >= sug.linha.spq.sugMin && spq(fl) <= sug.linha.spq.sugMax &&
        csn(fl) >= sug.linha.csn.sugMin && csn(fl) <= sug.linha.csn.sugMax;
      const faixaColuna =
        spq(fc) >= sug.coluna.spq.sugMin && spq(fc) <= sug.coluna.spq.sugMax &&
        csn(fc) >= sug.coluna.csn.sugMin && csn(fc) <= sug.coluna.csn.sugMax;
      const somaOk = soma >= sug.soma.sugMin && soma <= sug.soma.sugMax;
      acc.simulacoes++;
      if (linhaFmt) acc.linhaFmt++;
      if (colFmt) acc.colFmt++;
      if (faixaLinha) acc.faixaLinha++;
      if (faixaColuna) acc.faixaColuna++;
      if (somaOk) acc.soma++;
      if (linhaFmt && colFmt && faixaLinha && faixaColuna && somaOk) acc.universo15++;
    }
    const n = Math.max(1, acc.simulacoes);
    ranking.push({
      id: perfil.id,
      perfil,
      simulacoes: acc.simulacoes,
      taxaUniverso15: acc.universo15 / n,
      taxaLinhaFmt: acc.linhaFmt / n,
      taxaColFmt: acc.colFmt / n,
      taxaSoma: acc.soma / n,
      taxaFaixaLinha: acc.faixaLinha / n,
      taxaFaixaColuna: acc.faixaColuna / n,
      score:
        (acc.universo15 / n) * 1000 +
        (acc.linhaFmt / n) * 80 +
        (acc.colFmt / n) * 80 +
        (acc.soma / n) * 20 -
        perfil.qtdFormatos * 2 -
        perfil.larguraFaixa,
    });
  }
  return ranking.sort((a, b) => b.score - a.score);
}

function ticketsMode(resultados, from, to, perfil, priorJanela = 240) {
  const pre = precomputeActualFeatures(resultados, perfil);
  const acc = {
    simulacoes: 0,
    universo15: 0,
    somaMelhor: 0,
    max: 0,
    h10: 0,
    h11: 0,
    h12: 0,
    h13: 0,
    h14: 0,
    h15: 0,
    rankTop5: 0,
    rankTop50: 0,
    rankTop500: 0,
    rankTop2500: 0,
    totalGerados: 0,
    exemplos15: [],
  };
  for (let i = 0; i < resultados.length; i++) {
    const alvo = resultados[i];
    if (alvo.c < from || alvo.c > to || i < perfil.retros + priorJanela) continue;
    const hist = resultados.slice(i - perfil.retros, i);
    const sug = sugerir(hist, perfil);
    const candidatos = enumerar(
      sug.topLinhas.map((f) => f.fmt),
      sug.topColunas.map((f) => f.fmt),
      sug.soma.sugMin,
      sug.soma.sugMax,
      perfil.maxGerados
    );
    if (!candidatos.length) continue;

    const priorRecords = pre.slice(Math.max(0, i - priorJanela), i).filter(Boolean);
    const prior = buildPrior(priorRecords, PRIOR_KEYS);
    const { selected, all } = selectFive(candidatos, prior, hist, sug);
    const targetKey = alvo.dez.join(",");
    const targetRows = all.map((item) => ({
      key: item.key,
      bestScore: Math.max(...Object.values(item.scores)),
    })).sort((a, b) => b.bestScore - a.bestScore);
    const targetRank = targetRows.findIndex((r) => r.key === targetKey) + 1;
    const selectedKeys = new Set(selected.map((s) => s.key));
    const best = Math.max(...selected.map((s) => hitCount(s.jogo, alvo.dez)));

    acc.simulacoes++;
    acc.totalGerados += candidatos.length;
    if (targetRank > 0) {
      acc.universo15++;
      if (targetRank <= 5) acc.rankTop5++;
      if (targetRank <= 50) acc.rankTop50++;
      if (targetRank <= 500) acc.rankTop500++;
      if (targetRank <= 2500) acc.rankTop2500++;
    }
    acc.somaMelhor += best;
    acc.max = Math.max(acc.max, best);
    if (best >= 10) acc.h10++;
    if (best >= 11) acc.h11++;
    if (best >= 12) acc.h12++;
    if (best >= 13) acc.h13++;
    if (best >= 14) acc.h14++;
    if (best >= 15 || selectedKeys.has(targetKey)) {
      acc.h15++;
      acc.exemplos15.push(alvo.c);
    }
  }
  const n = Math.max(1, acc.simulacoes);
  return {
    perfil,
    priorJanela,
    simulacoes: acc.simulacoes,
    mediaMelhor: acc.somaMelhor / n,
    max: acc.max,
    taxa10: acc.h10 / n,
    taxa11: acc.h11 / n,
    taxa12: acc.h12 / n,
    taxa13: acc.h13 / n,
    taxa14: acc.h14 / n,
    taxa15: acc.h15 / n,
    coberturaUniverso15: acc.universo15 / n,
    targetTop5: acc.rankTop5 / n,
    targetTop50: acc.rankTop50 / n,
    targetTop500: acc.rankTop500 / n,
    targetTop2500: acc.rankTop2500 / n,
    geradosMedio: acc.totalGerados / n,
    exemplos15: acc.exemplos15.slice(0, 20),
  };
}

async function main() {
  const resultados = parseResultados(await readFile(arg("file", RESULTADOS_PADRAO), "utf8"));
  const mode = arg("mode", "coverage");
  const last = parseInt(arg("last", "2000"));
  const to = parseInt(arg("to", `${resultados.at(-1).c}`));
  const from = parseInt(arg("from", `${Math.max(1, to - last + 1)}`));

  if (mode === "coverage") {
    let ranking = coverageMode(resultados, from, to, arg("grid", "grid"));
    if (arg("sortBy", "score") === "coverage") {
      ranking = ranking.sort((a, b) => b.taxaUniverso15 - a.taxaUniverso15 || b.taxaLinhaFmt - a.taxaLinhaFmt);
    }
    console.log(JSON.stringify({
      periodo: { from, to, last },
      top: ranking.slice(0, parseInt(arg("top", "12"))).map((r) => ({
        id: r.id,
        simulacoes: r.simulacoes,
        taxaUniverso15: Number((r.taxaUniverso15 * 100).toFixed(2)),
        linhaFmt: Number((r.taxaLinhaFmt * 100).toFixed(2)),
        colFmt: Number((r.taxaColFmt * 100).toFixed(2)),
        soma: Number((r.taxaSoma * 100).toFixed(2)),
        faixaLinha: Number((r.taxaFaixaLinha * 100).toFixed(2)),
        faixaColuna: Number((r.taxaFaixaColuna * 100).toFixed(2)),
        perfil: r.perfil,
      })),
    }, null, 2));
    return;
  }

  const perfil = makePerfil({
    id: arg("id", "imperfeito-r30-l1.9-f10"),
    retros: parseInt(arg("retros", "30")),
    pesoTendencia: parseFloat(arg("t", "0.45")),
    larguraFaixa: parseFloat(arg("largura", "1.9")),
    qtdFormatos: parseInt(arg("formatos", "10")),
    maxGerados: parseInt(arg("maxGerados", "60000")),
  });
  const out = ticketsMode(resultados, from, to, perfil, parseInt(arg("prior", "240")));
  console.log(JSON.stringify({
    periodo: { from, to, last },
    resultado: {
      ...out,
      mediaMelhor: Number(out.mediaMelhor.toFixed(3)),
      taxa10: Number((out.taxa10 * 100).toFixed(2)),
      taxa11: Number((out.taxa11 * 100).toFixed(2)),
      taxa12: Number((out.taxa12 * 100).toFixed(2)),
      taxa13: Number((out.taxa13 * 100).toFixed(2)),
      taxa14: Number((out.taxa14 * 100).toFixed(2)),
      taxa15: Number((out.taxa15 * 100).toFixed(2)),
      coberturaUniverso15: Number((out.coberturaUniverso15 * 100).toFixed(2)),
      targetTop5: Number((out.targetTop5 * 100).toFixed(2)),
      targetTop50: Number((out.targetTop50 * 100).toFixed(2)),
      targetTop500: Number((out.targetTop500 * 100).toFixed(2)),
      targetTop2500: Number((out.targetTop2500 * 100).toFixed(2)),
      geradosMedio: Number(out.geradosMedio.toFixed(0)),
    },
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
