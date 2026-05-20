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
    .filter((r) => Number.isFinite(r.c) && r.dez.length === 15);
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
    centralidade: sd > 0 ? Math.min(1, Math.abs(tend - centro) / sd) : 0,
    sugMin: Math.round(sugCentro - sd * larguraFaixa),
    sugMax: Math.round(sugCentro + sd * larguraFaixa),
  };
}

function analisarFormatos(historico, fn) {
  const freq = new Map();
  const ultima = new Map();
  historico.forEach((r, i) => {
    const f = fn(r.dez);
    freq.set(f, (freq.get(f) ?? 0) + 1);
    ultima.set(f, i);
  });
  return [...freq.entries()]
    .map(([fmt, fr]) => ({
      fmt,
      freq: fr,
      atraso: historico.length - 1 - (ultima.get(fmt) ?? 0),
      indice: fr * (historico.length - 1 - (ultima.get(fmt) ?? 0)),
    }))
    .sort((a, b) => b.indice - a.indice);
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

function enumerar(linhas, colunas, somaMin, somaMax, maxOut = 30000) {
  const out = [];
  const colSet = new Set(colunas);
  for (const fl of linhas) {
    if (fl.split("").reduce((a, b) => a + parseInt(b), 0) !== 15) continue;
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
    default: return 0;
  }
}

function sugerir(historico, perfil) {
  const linhaSpq = analisarSerie(historico.map((r) => spq(formatoLinha(r.dez))), 45, perfil.pesoTendencia, perfil.larguraFaixa);
  const linhaCsn = analisarSerie(historico.map((r) => csn(formatoLinha(r.dez))), 320, perfil.pesoTendencia, perfil.larguraFaixa);
  const colunaSpq = analisarSerie(historico.map((r) => spq(formatoColuna(r.dez))), 45, perfil.pesoTendencia, perfil.larguraFaixa);
  const colunaCsn = analisarSerie(historico.map((r) => csn(formatoColuna(r.dez))), 320, perfil.pesoTendencia, perfil.larguraFaixa);
  const soma = analisarSerie(historico.map((r) => r.dez.reduce((a, b) => a + b, 0)), 195, perfil.pesoTendencia, perfil.larguraFaixa);

  const scoreFormato = (f, spqRange, csnRange) => {
    const s = spq(f.fmt);
    const c = csn(f.fmt);
    const inSpq = s >= spqRange.sugMin && s <= spqRange.sugMax;
    const inCsn = c >= csnRange.sugMin && c <= csnRange.sugMax;
    return f.freq * perfil.fmtFreq + f.atraso * perfil.fmtAtraso + f.indice * perfil.fmtIndice +
      (inSpq ? perfil.bonusSpq : -perfil.penSpq) +
      (inCsn ? perfil.bonusCsn : -perfil.penCsn) -
      Math.abs(s - 45) * perfil.distSpq -
      Math.abs(c - 320) / 20 * perfil.distCsn;
  };

  const topLinhas = analisarFormatos(historico, formatoLinha)
    .sort((a, b) => scoreFormato(b, linhaSpq, linhaCsn) - scoreFormato(a, linhaSpq, linhaCsn))
    .slice(0, perfil.qtdFormatos);
  const topColunas = analisarFormatos(historico, formatoColuna)
    .sort((a, b) => scoreFormato(b, colunaSpq, colunaCsn) - scoreFormato(a, colunaSpq, colunaCsn))
    .slice(0, perfil.qtdFormatos);

  const vars = analisarVariaveis(historico);
  return {
    linha: { spq: linhaSpq, csn: linhaCsn },
    coluna: { spq: colunaSpq, csn: colunaCsn },
    soma,
    topLinhas,
    topColunas,
    dezenasQuentes: [...vars].sort((a, b) => b.freq - a.freq).slice(0, perfil.nQuentes),
    dezenasAtrasadas: [...vars].sort((a, b) => b.atraso - a.atraso).slice(0, perfil.nAtrasadas),
  };
}

function gerarCarteira(historico, sug, perfil, nFichas = 5) {
  const jogos = enumerar(
    sug.topLinhas.map((f) => f.fmt),
    sug.topColunas.map((f) => f.fmt),
    sug.soma.sugMin,
    sug.soma.sugMax,
    perfil.maxGerados
  );
  if (!jogos.length) return { jogos: [], totalGerado: 0 };

  const ultimo = new Set(historico.at(-1)?.dez ?? []);
  const quentes = new Map(sug.dezenasQuentes.map((d) => [d.dezena, d.freq]));
  const atrasadas = new Map(sug.dezenasAtrasadas.map((d) => [d.dezena, d.atraso]));
  const fmtLinhaScore = new Map(sug.topLinhas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35]));
  const fmtColScore = new Map(sug.topColunas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35]));
  const inRange = (v, min, max, bonus) => v >= min && v <= max
    ? bonus
    : -Math.min(10, Math.min(Math.abs(v - min), Math.abs(v - max)) * 0.8);
  const band = (v, min, max, bonus) => v >= min && v <= max
    ? bonus
    : -Math.min(8, Math.min(Math.abs(v - min), Math.abs(v - max)) * 1.5);

  const score = (j) => {
    const fl = formatoLinha(j);
    const fc = formatoColuna(j);
    const somaJ = j.reduce((a, b) => a + b, 0);
    const hot = j.reduce((s, d) => s + (quentes.get(d) ?? 0), 0);
    const atr = j.reduce((s, d) => s + (atrasadas.get(d) ?? 0), 0);
    const nHot = j.filter((d) => quentes.has(d)).length;
    const nAtr = j.filter((d) => atrasadas.has(d)).length;
    return (
      ((fmtLinhaScore.get(fl) ?? 0) + (fmtColScore.get(fc) ?? 0)) * perfil.pesoFormato +
      inRange(spq(fl), sug.linha.spq.sugMin, sug.linha.spq.sugMax, 10) +
      inRange(csn(fl), sug.linha.csn.sugMin, sug.linha.csn.sugMax, 8) +
      inRange(spq(fc), sug.coluna.spq.sugMin, sug.coluna.spq.sugMax, 10) +
      inRange(csn(fc), sug.coluna.csn.sugMin, sug.coluna.csn.sugMax, 8) +
      inRange(somaJ, sug.soma.sugMin, sug.soma.sugMax, 12) +
      band(calcVar("Pares", j), perfil.paresMin, perfil.paresMax, 7) +
      band(calcVar("Bordas", j), perfil.bordasMin, perfil.bordasMax, 6) +
      band(calcVar("Modas", j), perfil.modasMin, perfil.modasMax, 6) +
      band(calcVar("Primos", j), perfil.primosMin, perfil.primosMax, 4) +
      band(calcVar("Fibonacci", j), perfil.fiboMin, perfil.fiboMax, 4) +
      band(calcVar("Repetição Último", j, ultimo), perfil.repMin, perfil.repMax, 5) +
      hot * perfil.pesoQuente +
      atr * perfil.pesoAtraso -
      Math.max(0, nHot - perfil.maxQuentes) * perfil.penalQuentes -
      Math.max(0, nAtr - perfil.maxAtrasadas) * perfil.penalAtrasadas -
      Math.abs(somaJ - 195) * perfil.penalSomaCentro
    );
  };

  const ranked = jogos.map((j) => ({ j, s: score(j) })).sort((a, b) => b.s - a.s).slice(0, perfil.topRank);
  const hamming = (a, b) => {
    const sb = new Set(b);
    return a.reduce((diff, d) => diff + (sb.has(d) ? 0 : 1), 0);
  };
  const out = [ranked[0].j];
  const taken = new Set([ranked[0].j.join(",")]);
  while (out.length < nFichas && out.length < ranked.length) {
    let best = null;
    const coverage = new Set(out.flat());
    for (const item of ranked) {
      const key = item.j.join(",");
      if (taken.has(key)) continue;
      const minDist = Math.min(...out.map((o) => hamming(item.j, o)));
      const newCoverage = item.j.filter((d) => !coverage.has(d)).length;
      const portfolio = item.s + minDist * perfil.pesoDiversidade + newCoverage * perfil.pesoCobertura;
      if (!best || portfolio > best.score) best = { j: item.j, score: portfolio };
    }
    if (!best) break;
    out.push(best.j);
    taken.add(best.j.join(","));
  }
  return { jogos: out, totalGerado: jogos.length };
}

function basePerfil(overrides) {
  return {
    id: "",
    retros: 30,
    pesoTendencia: 0.6,
    larguraFaixa: 1,
    qtdFormatos: 6,
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
    pesoFormato: 1,
    pesoQuente: 0.22,
    pesoAtraso: 0.33,
    pesoDiversidade: 3.8,
    pesoCobertura: 1.4,
    penalQuentes: 2.2,
    penalAtrasadas: 1.5,
    penalSomaCentro: 0.12,
    maxQuentes: 8,
    maxAtrasadas: 5,
    paresMin: 7,
    paresMax: 8,
    bordasMin: 9,
    bordasMax: 11,
    modasMin: 8,
    modasMax: 9,
    primosMin: 5,
    primosMax: 7,
    fiboMin: 3,
    fiboMax: 5,
    repMin: 7,
    repMax: 10,
    maxGerados: 12000,
    topRank: 1200,
    ...overrides,
  };
}

function gerarPerfis(mode = "quick") {
  const archetypes = [
    { nome: "centro", pesoFormato: 1, pesoQuente: 0.22, pesoAtraso: 0.33, pesoDiversidade: 3.8, pesoCobertura: 1.4 },
    { nome: "aberto", pesoFormato: 0.9, pesoQuente: 0.2, pesoAtraso: 0.3, pesoDiversidade: 4.3, pesoCobertura: 1.8 },
    { nome: "formato", pesoFormato: 1.35, pesoQuente: 0.16, pesoAtraso: 0.26, pesoDiversidade: 3.5, pesoCobertura: 1.1 },
    { nome: "quentes", pesoFormato: 0.9, pesoQuente: 0.42, pesoAtraso: 0.16, pesoDiversidade: 3.4, pesoCobertura: 1.4, maxQuentes: 9 },
    { nome: "atrasadas", pesoFormato: 1, pesoQuente: 0.12, pesoAtraso: 0.55, pesoDiversidade: 3.9, pesoCobertura: 1.5, maxAtrasadas: 6 },
    { nome: "modal", pesoFormato: 1.05, pesoQuente: 0.2, pesoAtraso: 0.32, pesoDiversidade: 3.7, pesoCobertura: 1.3, modasMin: 9, modasMax: 10 },
  ];
  const retrosList = mode === "full" ? [30, 40, 50] : [30, 50];
  const tendenciaList = mode === "full" ? [0.35, 0.45, 0.55, 0.65, 0.75] : [0.45, 0.6, 0.75];
  const larguraList = mode === "full" ? [0.8, 0.95, 1.1, 1.25, 1.4, 1.6] : [1.15, 1.35, 1.6];
  const formatosList = mode === "full" ? [5, 6, 7, 8, 10] : [5, 7, 10];
  const perfis = [];
  for (const retros of retrosList) {
    for (const pesoTendencia of tendenciaList) {
      for (const larguraFaixa of larguraList) {
        for (const qtdFormatos of formatosList) {
          for (const a of archetypes) {
            const p = basePerfil({ ...a, retros, pesoTendencia, larguraFaixa, qtdFormatos });
            p.id = `${a.nome}-r${retros}-t${pesoTendencia}-l${larguraFaixa}-f${qtdFormatos}`;
            perfis.push(p);
          }
        }
      }
    }
  }
  return perfis;
}

function hits(jogo, resultSet) {
  return jogo.reduce((s, d) => s + (resultSet.has(d) ? 1 : 0), 0);
}

function avaliarPerfil(resultados, perfil, from, to) {
  const rows = resultados.filter((r) => r.c >= from && r.c <= to);
  const acc = {
    perfil,
    simulacoes: 0,
    somaMelhor: 0,
    maxAcerto: 0,
    h10: 0,
    h11: 0,
    h12: 0,
    h13: 0,
    h14: 0,
    h15: 0,
    coberturaLinha: 0,
    coberturaColuna: 0,
    coberturaSoma: 0,
    coberturaLinhaColuna: 0,
    totalGerados: 0,
    exemplo15: [],
  };
  for (const alvo of rows) {
    const idx = resultados.findIndex((r) => r.c === alvo.c);
    if (idx < perfil.retros) continue;
    const hist = resultados.slice(idx - perfil.retros, idx);
    const sug = sugerir(hist, perfil);
    const carteira = gerarCarteira(hist, sug, perfil, 5);
    if (!carteira.jogos.length) continue;

    const set = new Set(alvo.dez);
    const best = Math.max(...carteira.jogos.map((j) => hits(j, set)));
    const fl = formatoLinha(alvo.dez);
    const fc = formatoColuna(alvo.dez);
    const soma = alvo.dez.reduce((a, b) => a + b, 0);
    const lineOk = spq(fl) >= sug.linha.spq.sugMin && spq(fl) <= sug.linha.spq.sugMax &&
      csn(fl) >= sug.linha.csn.sugMin && csn(fl) <= sug.linha.csn.sugMax;
    const colOk = spq(fc) >= sug.coluna.spq.sugMin && spq(fc) <= sug.coluna.spq.sugMax &&
      csn(fc) >= sug.coluna.csn.sugMin && csn(fc) <= sug.coluna.csn.sugMax;
    const somaOk = soma >= sug.soma.sugMin && soma <= sug.soma.sugMax;

    acc.simulacoes++;
    acc.somaMelhor += best;
    acc.maxAcerto = Math.max(acc.maxAcerto, best);
    if (best >= 10) acc.h10++;
    if (best >= 11) acc.h11++;
    if (best >= 12) acc.h12++;
    if (best >= 13) acc.h13++;
    if (best >= 14) acc.h14++;
    if (best >= 15) {
      acc.h15++;
      acc.exemplo15.push(alvo.c);
    }
    if (lineOk) acc.coberturaLinha++;
    if (colOk) acc.coberturaColuna++;
    if (somaOk) acc.coberturaSoma++;
    if (lineOk && colOk) acc.coberturaLinhaColuna++;
    acc.totalGerados += carteira.totalGerado;
  }
  const n = Math.max(1, acc.simulacoes);
  const media = acc.somaMelhor / n;
  const score = media * 100 +
    (acc.h10 / n) * 18 +
    (acc.h11 / n) * 35 +
    (acc.h12 / n) * 85 +
    (acc.h13 / n) * 180 +
    (acc.h14 / n) * 360 +
    (acc.h15 / n) * 900 +
    (acc.coberturaLinhaColuna / n) * 18 +
    (acc.coberturaSoma / n) * 8;
  return {
    ...acc,
    media,
    score,
    taxa10: acc.h10 / n,
    taxa11: acc.h11 / n,
    taxa12: acc.h12 / n,
    taxa13: acc.h13 / n,
    taxa14: acc.h14 / n,
    taxa15: acc.h15 / n,
    geradosMedio: acc.totalGerados / n,
  };
}

function avaliarPerfilCoverage(resultados, perfil, from, to) {
  const rows = resultados.filter((r) => r.c >= from && r.c <= to);
  const acc = {
    perfil,
    simulacoes: 0,
    linha: 0,
    coluna: 0,
    soma: 0,
    linhaColuna: 0,
    universo15: 0,
    formatosLinhaMedio: 0,
    formatosColunaMedio: 0,
  };
  for (const alvo of rows) {
    const idx = resultados.findIndex((r) => r.c === alvo.c);
    if (idx < perfil.retros) continue;
    const hist = resultados.slice(idx - perfil.retros, idx);
    const sug = sugerir(hist, perfil);
    const fl = formatoLinha(alvo.dez);
    const fc = formatoColuna(alvo.dez);
    const soma = alvo.dez.reduce((a, b) => a + b, 0);
    const lineRangeOk = spq(fl) >= sug.linha.spq.sugMin && spq(fl) <= sug.linha.spq.sugMax &&
      csn(fl) >= sug.linha.csn.sugMin && csn(fl) <= sug.linha.csn.sugMax;
    const colRangeOk = spq(fc) >= sug.coluna.spq.sugMin && spq(fc) <= sug.coluna.spq.sugMax &&
      csn(fc) >= sug.coluna.csn.sugMin && csn(fc) <= sug.coluna.csn.sugMax;
    const lineFmtOk = sug.topLinhas.some((f) => f.fmt === fl);
    const colFmtOk = sug.topColunas.some((f) => f.fmt === fc);
    const somaOk = soma >= sug.soma.sugMin && soma <= sug.soma.sugMax;
    const linhaOk = lineRangeOk && lineFmtOk;
    const colunaOk = colRangeOk && colFmtOk;

    acc.simulacoes++;
    if (linhaOk) acc.linha++;
    if (colunaOk) acc.coluna++;
    if (somaOk) acc.soma++;
    if (linhaOk && colunaOk) acc.linhaColuna++;
    if (linhaOk && colunaOk && somaOk) acc.universo15++;
    acc.formatosLinhaMedio += sug.topLinhas.length;
    acc.formatosColunaMedio += sug.topColunas.length;
  }
  const n = Math.max(1, acc.simulacoes);
  const taxaLinha = acc.linha / n;
  const taxaColuna = acc.coluna / n;
  const taxaSoma = acc.soma / n;
  const taxaLinhaColuna = acc.linhaColuna / n;
  const taxaUniverso15 = acc.universo15 / n;
  const amplitudePenalty = (perfil.qtdFormatos - 5) * 1.5 + (perfil.larguraFaixa - 0.8) * 2;
  const score =
    taxaUniverso15 * 1000 +
    taxaLinhaColuna * 180 +
    taxaSoma * 45 +
    taxaLinha * 25 +
    taxaColuna * 25 -
    amplitudePenalty;
  return {
    ...acc,
    taxaLinha,
    taxaColuna,
    taxaSoma,
    taxaLinhaColuna,
    taxaUniverso15,
    score,
    formatosLinhaMedio: acc.formatosLinhaMedio / n,
    formatosColunaMedio: acc.formatosColunaMedio / n,
  };
}

async function main() {
  const file = arg("file", RESULTADOS_PADRAO);
  const from = parseInt(arg("from", "3300"));
  const to = parseInt(arg("to", "3667"));
  const top = parseInt(arg("top", "12"));
  const mode = arg("mode", "quick");
  const metric = arg("metric", "coverage");
  const details = parseInt(arg("details", "1"));
  const text = await readFile(file, "utf8");
  const resultados = parseResultados(text);
  const perfis = gerarPerfis(mode);
  console.error(`Resultados: ${resultados.length}. Testando ${perfis.length} perfis em ${from}-${to}...`);
  const ranking = [];
  const oracle = new Map();
  for (let i = 0; i < perfis.length; i++) {
    if (i % 100 === 0) console.error(`perfil ${i}/${perfis.length}`);
    const r = metric === "tickets"
      ? avaliarPerfil(resultados, perfis[i], from, to)
      : avaliarPerfilCoverage(resultados, perfis[i], from, to);
    ranking.push(r);
  }
  ranking.sort((a, b) => b.score - a.score);

  const ticketsRanking = metric === "coverage" && details
    ? ranking.slice(0, Math.min(12, ranking.length)).map((r) => avaliarPerfil(resultados, r.perfil, from, to))
      .sort((a, b) => b.score - a.score)
    : ranking;

  for (const alvo of resultados.filter((r) => r.c >= from && r.c <= to)) {
    let best = { hit: -1, perfil: null };
    if (details) {
      for (const r of ticketsRanking.slice(0, 40)) {
        const idx = resultados.findIndex((x) => x.c === alvo.c);
        if (idx < r.perfil.retros) continue;
        const hist = resultados.slice(idx - r.perfil.retros, idx);
        const carteira = gerarCarteira(hist, sugerir(hist, r.perfil), r.perfil, 5);
        const set = new Set(alvo.dez);
        const hit = carteira.jogos.length ? Math.max(...carteira.jogos.map((j) => hits(j, set))) : 0;
        if (hit > best.hit) best = { hit, perfil: r.perfil.id };
      }
    } else {
      const idx = resultados.findIndex((x) => x.c === alvo.c);
      for (const r of ranking.slice(0, 80)) {
        if (idx < r.perfil.retros) continue;
        const hist = resultados.slice(idx - r.perfil.retros, idx);
        const sug = sugerir(hist, r.perfil);
        const fl = formatoLinha(alvo.dez);
        const fc = formatoColuna(alvo.dez);
        const soma = alvo.dez.reduce((a, b) => a + b, 0);
        const ok = sug.topLinhas.some((f) => f.fmt === fl) &&
          sug.topColunas.some((f) => f.fmt === fc) &&
          soma >= sug.soma.sugMin &&
          soma <= sug.soma.sugMax;
        const hit = ok ? 15 : 0;
        if (hit > best.hit) best = { hit, perfil: r.perfil.id };
      }
    }
    oracle.set(alvo.c, best);
  }

  const best3600 = oracle.get(3600);
  const out = {
    dataset: { file, totalResultados: resultados.length, from, to },
    metric,
    best3600,
    coverageTop: ranking.slice(0, top).map((r) => ({
      id: r.perfil.id,
      perfil: r.perfil,
      simulacoes: r.simulacoes,
      score: Number(r.score.toFixed(3)),
      taxaUniverso15: Number(((r.taxaUniverso15 ?? 0) * 100).toFixed(2)),
      taxaLinhaColuna: Number(((r.taxaLinhaColuna ?? 0) * 100).toFixed(2)),
      taxaLinha: Number(((r.taxaLinha ?? 0) * 100).toFixed(2)),
      taxaColuna: Number(((r.taxaColuna ?? 0) * 100).toFixed(2)),
      taxaSoma: Number(((r.taxaSoma ?? 0) * 100).toFixed(2)),
    })),
    ticketsTop: details ? ticketsRanking.slice(0, top).map((r) => ({
      id: r.perfil.id,
      perfil: r.perfil,
      simulacoes: r.simulacoes,
      score: Number(r.score.toFixed(3)),
      media: Number(r.media.toFixed(3)),
      maxAcerto: r.maxAcerto,
      taxa10: Number((r.taxa10 * 100).toFixed(2)),
      taxa11: Number((r.taxa11 * 100).toFixed(2)),
      taxa12: Number((r.taxa12 * 100).toFixed(2)),
      taxa13: Number((r.taxa13 * 100).toFixed(2)),
      taxa14: Number((r.taxa14 * 100).toFixed(2)),
      taxa15: Number((r.taxa15 * 100).toFixed(2)),
      geradosMedio: Number(r.geradosMedio.toFixed(0)),
      exemplos15: r.exemplo15.slice(0, 10),
    })) : [],
    oracle: {
      avaliados: oracle.size,
      max: Math.max(...[...oracle.values()].map((x) => x.hit)),
      hit15: [...oracle.entries()].filter(([, x]) => x.hit >= 15).map(([c]) => c),
      hit14: [...oracle.entries()].filter(([, x]) => x.hit >= 14).map(([c]) => c),
      hit13: [...oracle.entries()].filter(([, x]) => x.hit >= 13).length,
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
