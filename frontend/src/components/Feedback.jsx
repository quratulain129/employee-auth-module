export function Spinner({ label = 'Loading…' }) {
  return <p className="status" role="status" aria-live="polite">{label}</p>;
}
export function Alert({ kind = 'info', title, children }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}
