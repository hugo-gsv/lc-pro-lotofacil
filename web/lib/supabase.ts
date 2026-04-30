import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false },
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

export async function carregarJogo(id: number): Promise<JogoSalvo | null> {
  const { data, error } = await supabase
    .from("jogos_gerados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function excluirJogo(id: number) {
  const { error } = await supabase
    .from("jogos_gerados")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
