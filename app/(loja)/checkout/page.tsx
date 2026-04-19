import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckoutClient } from './CheckoutClient'

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <CheckoutClient />
}
