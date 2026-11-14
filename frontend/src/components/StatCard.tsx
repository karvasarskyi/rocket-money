export default function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}
