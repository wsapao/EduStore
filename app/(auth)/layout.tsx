export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Injeta cor da escola via variável de ambiente (configurada no deploy)
  const brand = process.env.NEXT_PUBLIC_ESCOLA_COR ?? '#1a2f5a'
  const themeStyle = `:root { --brand: ${brand}; --brand-mid: ${brand}; }`

  return (
    <main className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'var(--bg)' }}>
      <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      {/* Blobs decorativos de fundo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[30%] -left-[20%] w-[70vw] h-[70vw] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(91,106,248,.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-[20%] -right-[15%] w-[55vw] h-[55vw] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(26,47,90,.05) 0%, transparent 70%)' }} />
      </div>
      <div className="relative z-10 w-full max-w-[420px]">
        {children}
      </div>
    </main>
  )
}
