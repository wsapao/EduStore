import React from 'react'

/* ── Card base ── */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--r-xl)',
      boxShadow: 'var(--shadow-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      animation: 'fade-up .45s var(--ease) both',
    }}>
      {children}
    </div>
  )
}

/* ── Topo com cor da escola ── */
export function AuthCardTop({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      background: 'var(--brand)', padding: '36px 40px 28px',
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, background:'rgba(255,255,255,.05)', borderRadius:'50%' }} />
      <div style={{ position:'absolute', bottom:-60, left:-30, width:200, height:200, background:'rgba(255,255,255,.03)', borderRadius:'50%' }} />
      <div style={{ position:'relative', display:'inline-block', marginBottom:18 }}>
        <div style={{
          width:76, height:76, background:'white', borderRadius:'var(--r-lg)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 20px rgba(0,0,0,.25)', margin:'0 auto',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div style={{
          position:'absolute', bottom:-4, right:-4,
          width:24, height:24, background:'var(--success)',
          borderRadius:'50%', border:'2px solid var(--brand)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
      <div style={{ color:'white', fontSize:20, fontWeight:800, letterSpacing:'-.02em', marginBottom:4 }}>{title}</div>
      <div style={{ color:'rgba(255,255,255,.55)', fontSize:13, fontWeight:500 }}>{subtitle}</div>
    </div>
  )
}

/* ── Rodapé de segurança ── */
export function AuthCardFooter() {
  return (
    <div style={{
      padding:'14px 32px', background:'var(--surface-2)',
      borderTop:'1px solid var(--border)', textAlign:'center',
      fontSize:11, color:'var(--text-3)', fontWeight:500,
    }}>
      🔒 Seus dados estão protegidos com criptografia SSL 256-bit
    </div>
  )
}

/* ── Label + campo ── */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:7 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize:11, color:'var(--text-3)', marginTop:4, fontWeight:500 }}>{hint}</p>}
    </div>
  )
}

/* ── Input com ícone à esquerda e botão opcional à direita ── */
interface IconInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  rightBtn?: React.ReactNode
}
export function IconInput({ icon, rightBtn, ...props }: IconInputProps) {
  return (
    <div style={{ position:'relative' }}>
      {icon && (
        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)', pointerEvents:'none', display:'flex' }}>
          {icon}
        </span>
      )}
      <input
        {...props}
        style={{
          width:'100%', height:48, paddingLeft: icon ? 44 : 14, paddingRight: rightBtn ? 48 : 14,
          background:'var(--surface-2)', border:'1.5px solid var(--border)',
          borderRadius:'var(--r-md)', fontFamily:'inherit', fontSize:15,
          color:'var(--text-1)', outline:'none', transition:'all .2s',
          ...props.style,
        }}
      />
      {rightBtn && (
        <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)' }}>
          {rightBtn}
        </span>
      )}
    </div>
  )
}

/* ── Mensagem de erro ── */
export function ErrorMsg({ children }: { children: string }) {
  return (
    <div style={{
      background:'var(--danger-light)', border:'1px solid #fca5a5',
      borderRadius:'var(--r-md)', padding:'10px 14px',
      fontSize:13, color:'#991b1b', fontWeight:600, marginBottom:16,
    }}>
      {children}
    </div>
  )
}

/* ── Botão primário ── */
export function BtnPrimary({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={disabled} style={{
      width:'100%', height:52, background: disabled ? '#94a3b8' : 'var(--brand)', color:'white',
      border:'none', borderRadius:'var(--r-md)', fontFamily:'inherit',
      fontSize:15, fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer', marginTop:4,
      boxShadow: disabled ? 'none' : '0 4px 14px rgba(26,47,90,.35)',
      letterSpacing:'-.01em', transition:'all .2s',
    }}>
      {children}
    </button>
  )
}

/* ── Divisor ── */
export function Divider({ label = 'ou' }: { label?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 0', color:'var(--text-3)', fontSize:12, fontWeight:600 }}>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
      {label}
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  )
}

/* ── Ícones SVG ── */
export function UserIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
export function LockIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
}
export function MailIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
export function EyeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
export function EyeOffIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
export function PhoneIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
}
