export default function LoadingSpinner({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="rounded-full border-2 border-accent/20 border-t-accent animate-spin shadow-neon"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}
