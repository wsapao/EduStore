import { redirect } from 'next/navigation'

export default function CantinaLayout() {
  // Módulo Cantina temporariamente desativado a pedido da escola.
  redirect('/loja')
}
