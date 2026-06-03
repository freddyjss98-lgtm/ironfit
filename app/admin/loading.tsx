export default function AdminLoading() {
  return (
    <div className="space-y-8">
      {/* Two KPI rows */}
      {Array.from({ length: 2 }).map((_, row) => (
        <div key={row} className="space-y-4">
          <div className="skeleton h-3 w-24" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        </div>
      ))}

      {/* Chart block */}
      <div className="skeleton h-64 rounded-xl" />

      {/* Table block */}
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );
}
