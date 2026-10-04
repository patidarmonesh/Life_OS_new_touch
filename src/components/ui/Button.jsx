export default function Button({ children, variant = 'primary', loading = false, disabled, className = '', type = 'button', ...props }) {
  return <button type={type} className={`button button-${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? 'Working…' : children}</button>
}
