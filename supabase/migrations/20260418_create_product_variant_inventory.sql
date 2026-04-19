create table if not exists public.produto_variantes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  nome text not null,
  disponivel boolean not null default true,
  estoque integer null,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_produto_variantes_produto_id
  on public.produto_variantes(produto_id);

create unique index if not exists idx_produto_variantes_produto_nome_unique
  on public.produto_variantes(produto_id, nome);

alter table public.itens_pedido
  add column if not exists variante_id uuid null references public.produto_variantes(id) on delete set null;

create or replace function public.reservar_estoque_variante(p_variante_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_estoque integer;
begin
  select estoque into v_estoque
  from public.produto_variantes
  where id = p_variante_id
  for update;

  if v_estoque is null then
    return true;
  end if;

  if v_estoque <= 0 then
    return false;
  end if;

  update public.produto_variantes
  set estoque = estoque - 1
  where id = p_variante_id;

  return true;
end;
$$;

create or replace function public.restaurar_estoque_variante(p_variante_id uuid)
returns void
language plpgsql
as $$
begin
  update public.produto_variantes
  set estoque = estoque + 1
  where id = p_variante_id
    and estoque is not null;
end;
$$;
