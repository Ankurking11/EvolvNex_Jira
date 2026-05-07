export default function ProjectLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 rounded-xl border border-gray-200 bg-white animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
