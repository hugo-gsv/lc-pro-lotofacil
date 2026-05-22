import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars não configuradas");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, p) {
    return (client() as unknown as Record<string | symbol, unknown>)[p];
  },
});

export type JogoSalvo = {
  id: number;
  nome: string;
  tipo: string | null;
  dt_criacao: string;
  params_json: Record<string, unknown> | null;
  jogos_json: number[][];
  n_jogos: number;
};

export type AutomacaoStatus = "pendente" | "rodando" | "concluido" | "erro" | "cancelado";

export async function salvarJogos(args: {
  nome: string;
  tipo: string;
  params: Record<string, unknown>;
  jogos: number[][];
}): Promise<number> {
  const { data, error } = await supabase
    .from("jogos_gerados")
    .insert({
      nome: args.nome,
      tipo: args.tipo,
      dt_criacao: new Date().toISOString(),
      params_json: args.params,
      jogos_json: args.jogos,
      n_jogos: args.jogos.length,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function criarJobAutomacao(args: {
  nome: string;
  params: Record<string, unknown>;
  jogos: number[][];
}): Promise<number> {
  const agora = new Date().toISOString();
  const id = await salvarJogos({
    nome: args.nome,
    tipo: "automacao_caixa",
    params: {
      ...args.params,
      status: "pendente",
      status_at: agora,
      criado_em: agora,
      eventos: [
        { status: "pendente", at: agora, mensagem: "Fila criada no LC Pro" },
      ],
    },
    jogos: args.jogos,
  });
  return id;
}

export async function listarJogos(limit = 50, tipo?: string) {
  let q = supabase
    .from("jogos_gerados")
    .select("id, nome, tipo, dt_criacao, params_json, n_jogos")
    .order("id", { ascending: false })
    .limit(limit);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listarJobsAutomacao(limit = 20, status?: AutomacaoStatus) {
  let q = supabase
    .from("jogos_gerados")
    .select("*")
    .eq("tipo", "automacao_caixa")
    .order("id", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("params_json->>status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as JogoSalvo[];
}

export async function carregarJogo(id: number): Promise<JogoSalvo | null> {
  const { data, error } = await supabase
    .from("jogos_gerados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function atualizarJobAutomacao(
  id: number,
  status: AutomacaoStatus,
  detalhes: Record<string, unknown> = {}
) {
  const atual = await carregarJogo(id);
  if (!atual) throw new Error("Job não encontrado");
  if (atual.tipo !== "automacao_caixa") throw new Error("Registro não é job de automação");

  const agora = new Date().toISOString();
  const params = atual.params_json ?? {};
  const eventos = Array.isArray(params.eventos) ? params.eventos : [];
  const mensagem = typeof detalhes.mensagem === "string" ? detalhes.mensagem : undefined;
  const novoParams = {
    ...params,
    ...detalhes,
    status,
    status_at: agora,
    eventos: [
      ...eventos,
      { status, at: agora, mensagem: mensagem ?? null },
    ].slice(-30),
  };

  const { error } = await supabase
    .from("jogos_gerados")
    .update({ params_json: novoParams })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirJogo(id: number) {
  const { error } = await supabase
    .from("jogos_gerados")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
