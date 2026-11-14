export default function RocketIcon({ className = 'w-24 h-24' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill="#00FF88" fillOpacity="0.06" />
      <path d="M60 18c14 10 21 26 21 44l-9 12H48l-9-12c0-18 7-34 21-44z" fill="#111" stroke="#00FF88" strokeWidth="3" />
      <circle cx="60" cy="50" r="8" stroke="#00FF88" strokeWidth="3" />
      <path d="M48 74l-10 18 16-9M72 74l10 18-16-9" stroke="#00FF88" strokeWidth="3" strokeLinejoin="round" />
      <path d="M54 86c0 8 6 16 6 16s6-8 6-16" fill="#00FF88" fillOpacity="0.5" />
    </svg>
  );
}
