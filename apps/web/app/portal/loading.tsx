export default function PortalLoading() {
  return (
    <div className="space-y-6">
      {/* Greeting + streak */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-9 w-40" />
        </div>
        <div className="skeleton h-12 w-24 rounded-full" />
      </div>

      {/* Weekly goal + membership */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 skeleton h-44 rounded-2xl" />
        <div className="lg:col-span-2 skeleton h-44 rounded-2xl" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>

      {/* Achievements */}
      <div className="skeleton h-40 rounded-2xl" />

      {/* Heatmap */}
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );
}
