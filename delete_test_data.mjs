import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { error: err1 } = await supabase.from('ingressos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("ingressos error:", err1);

  const { error: err2 } = await supabase.from('itens_pedido').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("itens_pedido error:", err2);

  const { error: err3 } = await supabase.from('pedidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("pedidos error:", err3);

  const { error: err4 } = await supabase.from('produtos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("produtos error:", err4);

  console.log("Finished deleting.");
}
run();
