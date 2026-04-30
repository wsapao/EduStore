require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (error) {
    console.log("Error querying information_schema:", error.message);
  } else {
    console.log("Tables:", data);
  }
}
run();
