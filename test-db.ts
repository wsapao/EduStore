import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*, variantes_rel:produto_variantes(*)')
    .order('created_at', { ascending: false })
    .range(0, 11)

  console.log('Error:', error)
  console.log('Data:', data)
}
test()
