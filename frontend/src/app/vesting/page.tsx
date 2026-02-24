export default function VestingPage() {
  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">⏳ Token Vesting</h1>
      <p className="text-gray-400 mb-8">
        Manage cliff + linear vesting schedules for team members, advisors, and investors.
      </p>
      {/* TODO: Implement Vesting Dashboard (see FE-16 to FE-19) */}
      <div className="border border-dashed border-gray-600 rounded-xl p-12 text-center text-gray-500">
        Vesting dashboard coming soon. See ISSUES-FRONTEND.md for contribution tasks.
      </div>
    </div>
  )
}
