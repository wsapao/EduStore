alter table public.produtos
  add column if not exists variantes text[];

alter table public.itens_pedido
  add column if not exists variante text;
