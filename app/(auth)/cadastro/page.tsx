import { createClient } from '@/lib/supabase/server'
import CadastroForm from './CadastroForm'

export default async function CadastroPage() {
  const supabase = await createClient()
  const { data: escola } = await supabase.from('escolas').select('nome, logo_url').limit(1).maybeSingle()

  return <CadastroForm logoUrl={escola?.logo_url} nome={escola?.nome} />
}
