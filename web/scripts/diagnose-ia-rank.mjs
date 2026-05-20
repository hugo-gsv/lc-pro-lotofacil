#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const RESULTADOS_PADRAO =
  "/Users/mac/Documents/Claude/Projects/Apps loteria/macOS/LTF Resultados/resltf.txt";

const MODAIS = new Set([1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 18, 20, 22, 24, 25]);
const BORDAS = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);
const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
const FIBO = new Set([1, 2, 3, 5, 8, 13, 21]);

const PERFIL = {
  id: "offline-atrasadas-r30-t045-l160-f5",
  nome: "Atrasadas calibrado offline",
  retros: 30,
  pesoTendencia: 0.45,
  larguraFaixa: 1.6,
  qtdFormatos: 5,
  pesoFormato: 1,
  pesoQuente: 0.12,
  pesoAtraso: 0.55,
  pesoDiversidade: 3.9,
  pesoCobertura: 1.5,
  penalQuentes: 2.2,
  penalAtrasadas: 1.5,
};

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
    topRank: 2500,
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
            p.nome = p.id;
            perfis.push(p);
          }
        }
      }
    }
  }
  return perfis;
}

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

function analisarSerie(valores, centroTeorico, pesoTendencia, larguraFaixa) {
  const m = media(valores);
  const sd = desvio(valores, m);
  const tend = media(valores.slice(-5));
  const ajuste = (centroTeorico - tend) * pesoTendencia * 0.5;
  const sugCentro = m + ajuste;
  return {
    media: m,
    desvio: sd,
    ultimaTendencia: tend,
    centralidade: sd > 0 ? Math.min(1, Math.abs(tend - centroTeorico) / sd) : 0,
    sugMin: Math.round(sugCentro - sd * larguraFaixa),
    sugMax: Math.round(sugCentro + sd * larguraFaixa),
  };
}

function analisarFormatos(historico, funcao) {
  const freq = new Map();
  const ultimaPos = new Map();
  historico.forEach((row, i) => {
    const f = funcao(row.dez);
    freq.set(f, (freq.get(f) ?? 0) + 1);
    ultimaPos.set(f, i);
  });
  return [...freq.entries()]
    .map(([fmt, fr]) => {
      const atraso = historico.length - 1 - (ultimaPos.get(fmt) ?? 0);
      return { fmt, freq: fr, atraso, indice: fr * atraso };
    })
    .sort((a, b) => b.indice - a.indice);
}

function analisarVariaveis(historico) {
  const out = [];
  const N = historico.length;
  for (let d = 1; d <= 25; d++) {
    const ocorrencias = historico.map(({ dez }) => dez.includes(d));
    const freq = ocorrencias.filter(Boolean).length;
    let atraso = 0;
    for (let i = N - 1; i >= 0; i--) {
      if (ocorrencias[i]) break;
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

function enumerar(linhas, colunas, somaMin, somaMax) {
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
    const distSpq = Math.abs(s - 45);
    const distCsn = Math.abs(c - 320) / 20;
    return f.freq * (perfil.fmtFreq ?? 12) +
      f.atraso * (perfil.fmtAtraso ?? 1.4) +
      f.indice * (perfil.fmtIndice ?? 0.75) +
      (inSpq ? (perfil.bonusSpq ?? 16) : -(perfil.penSpq ?? 12)) +
      (inCsn ? (perfil.bonusCsn ?? 12) : -(perfil.penCsn ?? 8)) -
      distSpq * (perfil.distSpq ?? 1.2) -
      distCsn * (perfil.distCsn ?? 0.6);
  };

  const topLinhas = analisarFormatos(historico, formatoLinha)
    .sort((a, b) => scoreFormato(b, linhaSpq, linhaCsn) - scoreFormato(a, linhaSpq, linhaCsn))
    .slice(0, perfil.qtdFormatos);
  const topColunas = analisarFormatos(historico, formatoColuna)
    .sort((a, b) => scoreFormato(b, colunaSpq, colunaCsn) - scoreFormato(a, colunaSpq, colunaCsn))
    .slice(0, perfil.qtdFormatos);
  const variaveis = analisarVariaveis(historico);

  return {
    linha: { spq: linhaSpq, csn: linhaCsn },
    coluna: { spq: colunaSpq, csn: colunaCsn },
    soma,
    topLinhas,
    topColunas,
    dezenasAtrasadas: [...variaveis].sort((a, b) => b.atraso - a.atraso).slice(0, perfil.nAtrasadas ?? 5),
    dezenasQuentes: [...variaveis].sort((a, b) => b.freq - a.freq).slice(0, perfil.nQuentes ?? 8),
  };
}

function scoreParts(j, historico, sug, perfil) {
  const ultimo = historico.length ? new Set(historico[historico.length - 1].dez) : new Set();
  const pesoQuentes = new Map(sug.dezenasQuentes.map((d) => [d.dezena, d.freq]));
  const pesoAtrasadas = new Map(sug.dezenasAtrasadas.map((d) => [d.dezena, d.atraso]));
  const fmtLinhaScore = new Map(sug.topLinhas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35]));
  const fmtColScore = new Map(sug.topColunas.map((f, i) => [f.fmt, 12 - i * 1.5 + f.freq * 2 + f.atraso * 0.35]));
  const inRangeBonus = (value, min, max, bonus) =>
    value >= min && value <= max
      ? bonus
      : -Math.min(10, Math.min(Math.abs(value - min), Math.abs(value - max)) * 0.8);
  const bandBonus = (value, min, max, bonus) =>
    value >= min && value <= max
      ? bonus
      : -Math.min(8, Math.min(Math.abs(value - min), Math.abs(value - max)) * 1.5);

  const fl = formatoLinha(j);
  const fc = formatoColuna(j);
  const soma = calcVar("Soma", j);
  const hot = j.reduce((s, d) => s + (pesoQuentes.get(d) ?? 0), 0);
  const atraso = j.reduce((s, d) => s + (pesoAtrasadas.get(d) ?? 0), 0);
  const nHot = j.filter((d) => pesoQuentes.has(d)).length;
  const nAtr = j.filter((d) => pesoAtrasadas.has(d)).length;
  const valores = {
    fl,
    fc,
    spqLinha: spq(fl),
    csnLinha: csn(fl),
    spqColuna: spq(fc),
    csnColuna: csn(fc),
    soma,
    pares: calcVar("Pares", j),
    bordas: calcVar("Bordas", j),
    modas: calcVar("Modas", j),
    primos: calcVar("Primos", j),
    fibo: calcVar("Fibonacci", j),
    repeticao: calcVar("Repetição Último", j, ultimo),
    nQuentes: nHot,
    nAtrasadas: nAtr,
  };
  const parts = {
    formato: ((fmtLinhaScore.get(fl) ?? 0) + (fmtColScore.get(fc) ?? 0)) * perfil.pesoFormato,
    linhaSpq: inRangeBonus(spq(fl), sug.linha.spq.sugMin, sug.linha.spq.sugMax, 10),
    linhaCsn: inRangeBonus(csn(fl), sug.linha.csn.sugMin, sug.linha.csn.sugMax, 8),
    colunaSpq: inRangeBonus(spq(fc), sug.coluna.spq.sugMin, sug.coluna.spq.sugMax, 10),
    colunaCsn: inRangeBonus(csn(fc), sug.coluna.csn.sugMin, sug.coluna.csn.sugMax, 8),
    soma: inRangeBonus(soma, sug.soma.sugMin, sug.soma.sugMax, 12),
    pares: bandBonus(valores.pares, perfil.paresMin ?? 7, perfil.paresMax ?? 8, 7),
    bordas: bandBonus(valores.bordas, perfil.bordasMin ?? 9, perfil.bordasMax ?? 11, 6),
    modas: bandBonus(valores.modas, perfil.modasMin ?? 8, perfil.modasMax ?? 9, 6),
    primos: bandBonus(valores.primos, perfil.primosMin ?? 5, perfil.primosMax ?? 7, 4),
    fibo: bandBonus(valores.fibo, perfil.fiboMin ?? 3, perfil.fiboMax ?? 5, 4),
    repeticao: bandBonus(valores.repeticao, perfil.repMin ?? 7, perfil.repMax ?? 10, 5),
    quentes: hot * perfil.pesoQuente,
    atrasadas: atraso * perfil.pesoAtraso,
    penalQuentes: -Math.max(0, nHot - (perfil.maxQuentes ?? 8)) * perfil.penalQuentes,
    penalAtrasadas: -Math.max(0, nAtr - (perfil.maxAtrasadas ?? 5)) * perfil.penalAtrasadas,
    penalSomaCentro: -Math.abs(soma - 195) * (perfil.penalSomaCentro ?? 0.12),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts, valores };
}

function hamming(a, b) {
  const sb = new Set(b);
  return a.reduce((diff, d) => diff + (sb.has(d) ? 0 : 1), 0);
}

function selectPortfolio(ranked, perfil, totalFichas = 5) {
  const N = Math.max(1, Math.min(totalFichas, ranked.length));
  const out = [ranked[0]];
  const taken = new Set([ranked[0].key]);
  const steps = [{ etapa: 1, selecionado: ranked[0].key, rawScore: ranked[0].score, portfolioScore: ranked[0].score }];

  while (out.length < N) {
    let best = null;
    const coverage = new Set(out.flatMap((x) => x.jogo));
    for (const item of ranked) {
      if (taken.has(item.key)) continue;
      const minDist = Math.min(...out.map((o) => hamming(item.jogo, o.jogo)));
      const newCoverage = item.jogo.filter((d) => !coverage.has(d)).length;
      const portfolioScore = item.score + minDist * perfil.pesoDiversidade + newCoverage * perfil.pesoCobertura;
      if (!best || portfolioScore > best.portfolioScore) best = { ...item, portfolioScore, minDist, newCoverage };
    }
    if (!best) break;
    out.push(best);
    taken.add(best.key);
    steps.push({
      etapa: out.length,
      selecionado: best.key,
      rawScore: best.score,
      portfolioScore: best.portfolioScore,
      minDist: best.minDist,
      newCoverage: best.newCoverage,
    });
  }
  return { out, steps };
}

function stepRankForTarget(ranked, selectedBefore, targetKey, perfil) {
  const target = ranked.find((x) => x.key === targetKey);
  if (!target) return null;
  const taken = new Set(selectedBefore.map((x) => x.key));
  if (taken.has(targetKey)) return { rank: 0, portfolioScore: null };
  const coverage = new Set(selectedBefore.flatMap((x) => x.jogo));
  const scored = ranked
    .filter((x) => !taken.has(x.key))
    .map((item) => {
      const minDist = Math.min(...selectedBefore.map((o) => hamming(item.jogo, o.jogo)));
      const newCoverage = item.jogo.filter((d) => !coverage.has(d)).length;
      return {
        key: item.key,
        portfolioScore: item.score + minDist * perfil.pesoDiversidade + newCoverage * perfil.pesoCobertura,
        minDist,
        newCoverage,
      };
    })
    .sort((a, b) => b.portfolioScore - a.portfolioScore);
  const idx = scored.findIndex((x) => x.key === targetKey);
  return idx >= 0 ? { rank: idx + 1, ...scored[idx] } : null;
}

function avgParts(items) {
  const keys = Object.keys(items[0].detail.parts);
  const out = {};
  for (const k of keys) out[k] = media(items.map((x) => x.detail.parts[k]));
  return out;
}

function hits(a, b) {
  const sb = new Set(b);
  return a.reduce((s, d) => s + (sb.has(d) ? 1 : 0), 0);
}

function diagnosticar(resultados, concurso, perfil = PERFIL) {
  const idx = resultados.findIndex((r) => r.c === concurso);
  if (idx < perfil.retros) throw new Error(`Sem histórico suficiente para ${concurso}`);
  const alvo = resultados[idx];
  const historico = resultados.slice(idx - perfil.retros, idx);
  const sug = sugerir(historico, perfil);
  const candidatos = enumerar(
    sug.topLinhas.map((f) => f.fmt),
    sug.topColunas.map((f) => f.fmt),
    sug.soma.sugMin,
    sug.soma.sugMax
  );
  const targetKey = alvo.dez.join(",");
  const rankedAll = candidatos
    .map((jogo) => {
      const detail = scoreParts(jogo, historico, sug, perfil);
      return { jogo, key: jogo.join(","), score: detail.total, detail };
    })
    .sort((a, b) => b.score - a.score);
  const rawIdx = rankedAll.findIndex((x) => x.key === targetKey);
  const ranked = rankedAll.slice(0, Math.min(perfil.topRank ?? 2500, rankedAll.length));
  const targetInTop2500 = ranked.some((x) => x.key === targetKey);
  const selected = selectPortfolio(ranked, perfil, 5);
  const target = rawIdx >= 0 ? rankedAll[rawIdx] : null;
  const selectedKeys = new Set(selected.out.map((x) => x.key));

  const selectedAvg = avgParts(selected.out);
  const targetStepRanks = [];
  for (let step = 2; step <= 5; step++) {
    const before = selected.out.slice(0, step - 1);
    targetStepRanks.push({ etapa: step, ...stepRankForTarget(ranked, before, targetKey, perfil) });
  }

  const gaps = target
    ? Object.entries(target.detail.parts)
        .map(([k, v]) => ({ item: k, target: v, mediaSelecionadas: selectedAvg[k], diff: v - selectedAvg[k] }))
        .sort((a, b) => a.diff - b.diff)
    : [];

  return {
    concurso,
    perfil,
    resultado: alvo.dez,
    universo: {
      total: candidatos.length,
      resultadoDentro: rawIdx >= 0,
      rankScore: rawIdx >= 0 ? rawIdx + 1 : null,
      percentilScore: rawIdx >= 0 ? Number((((rawIdx + 1) / rankedAll.length) * 100).toFixed(2)) : null,
      entrouTop2500: targetInTop2500,
    },
    faixas: {
      linhaSpq: [sug.linha.spq.sugMin, sug.linha.spq.sugMax],
      linhaCsn: [sug.linha.csn.sugMin, sug.linha.csn.sugMax],
      colunaSpq: [sug.coluna.spq.sugMin, sug.coluna.spq.sugMax],
      colunaCsn: [sug.coluna.csn.sugMin, sug.coluna.csn.sugMax],
      soma: [sug.soma.sugMin, sug.soma.sugMax],
      topLinhas: sug.topLinhas.map((f) => f.fmt),
      topColunas: sug.topColunas.map((f) => f.fmt),
    },
    resultadoMetricas: target
      ? {
          score: Number(target.score.toFixed(3)),
          valores: target.detail.valores,
          parts: Object.fromEntries(Object.entries(target.detail.parts).map(([k, v]) => [k, Number(v.toFixed(3))])),
        }
      : null,
    cincoEscolhidas: selected.out.map((x, i) => ({
      n: i + 1,
      jogo: x.jogo,
      score: Number(x.score.toFixed(3)),
      acertosContraResultado: hits(x.jogo, alvo.dez),
      valores: x.detail.valores,
    })),
    selecao: {
      resultadoSelecionado: selectedKeys.has(targetKey),
      melhorAcertoNas5: Math.max(...selected.out.map((x) => hits(x.jogo, alvo.dez))),
      etapas: selected.steps,
      rankResultadoPorEtapa: targetStepRanks,
    },
    principaisGapsContraMediaDas5: gaps.slice(0, 8).map((g) => ({
      item: g.item,
      resultado15: Number(g.target.toFixed(3)),
      media5: Number(g.mediaSelecionadas.toFixed(3)),
      diferenca: Number(g.diff.toFixed(3)),
    })),
    maioresVantagensContraMediaDas5: gaps.slice(-5).reverse().map((g) => ({
      item: g.item,
      resultado15: Number(g.target.toFixed(3)),
      media5: Number(g.mediaSelecionadas.toFixed(3)),
      diferenca: Number(g.diff.toFixed(3)),
    })),
  };
}

async function main() {
  const file = arg("file", RESULTADOS_PADRAO);
  const concursos = arg("concursos", "3370,3615,3617,3638")
    .split(",")
    .map((x) => parseInt(x.trim()))
    .filter(Boolean);
  const resultados = parseResultados(await readFile(file, "utf8"));
  const searchProfiles = arg("searchProfiles", "0") === "1";
  if (!searchProfiles) {
    const diagnosticos = concursos.map((c) => diagnosticar(resultados, c));
    console.log(JSON.stringify({ perfil: PERFIL, diagnosticos }, null, 2));
    return;
  }

  const mode = arg("mode", "quick");
  const perfis = gerarPerfis(mode);
  const resumo = [];
  for (const concurso of concursos) {
    const hitsPerfis = [];
    for (const perfil of perfis) {
      const d = diagnosticar(resultados, concurso, perfil);
      if (d.universo.resultadoDentro) hitsPerfis.push(d);
    }
    hitsPerfis.sort((a, b) => {
      const ar = a.universo.rankScore ?? Number.POSITIVE_INFINITY;
      const br = b.universo.rankScore ?? Number.POSITIVE_INFINITY;
      return ar - br || b.resultadoMetricas.score - a.resultadoMetricas.score;
    });
    resumo.push({
      concurso,
      perfisQueIncluemResultado: hitsPerfis.length,
      melhores: hitsPerfis.slice(0, 5).map((d) => ({
        perfil: d.perfil.id,
        universoTotal: d.universo.total,
        rankScore: d.universo.rankScore,
        percentilScore: d.universo.percentilScore,
        entrouTop2500: d.universo.entrouTop2500,
        selecionadoNas5: d.selecao.resultadoSelecionado,
        melhorAcertoNas5: d.selecao.melhorAcertoNas5,
        scoreResultado: d.resultadoMetricas.score,
        resultadoValores: d.resultadoMetricas.valores,
        gaps: d.principaisGapsContraMediaDas5.slice(0, 5),
        vantagens: d.maioresVantagensContraMediaDas5.slice(0, 3),
        cincoEscolhidas: d.cincoEscolhidas.map((x) => ({
          n: x.n,
          acertos: x.acertosContraResultado,
          score: x.score,
          fl: x.valores.fl,
          fc: x.valores.fc,
          soma: x.valores.soma,
          repeticao: x.valores.repeticao,
          modas: x.valores.modas,
          quentes: x.valores.nQuentes,
          atrasadas: x.valores.nAtrasadas,
        })),
      })),
    });
  }
  console.log(JSON.stringify({ mode, perfisTestados: perfis.length, resumo }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
