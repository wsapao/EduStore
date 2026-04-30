require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  let res = await supabase.from('series').select('*').limit(1);
  console.log("series:", res.error ? res.error.message : "Exists");
  res = await supabase.from('escola_series').select('*').limit(1);
  console.log("escola_series:", res.error ? res.error.message : "Exists");
  res = await supabase.from('configuracoes').select('*').limit(1);
  console.log("configuracoes:", res.error ? res.error.message : "Exists");
}
run();
