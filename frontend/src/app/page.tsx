export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
        PayD
      </h1>
      <p className="text-xl text-gray-400 mb-8 text-center max-w-2xl">
        Decentralized Payroll, Vesting &amp; Treasury Protocol on Stellar
        Soroban
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* TODO: Replace with actual dashboard cards (see FE-6) */}
        <DashboardCard
          title="Treasury"
          description="Multi-sig vault with configurable approval thresholds"
          href="/treasury"
          icon="🏦"
        />
        <DashboardCard
          title="Payroll"
          description="Continuous payment streaming, claimable in real-time"
          href="/payroll"
          icon="💸"
        />
        <DashboardCard
          title="Vesting"
          description="Cliff + linear vesting schedules for your team"
          href="/vesting"
          icon="⏳"
        />
        <DashboardCard
          title="Governance"
          description="On-chain budget proposals with approval voting"
          href="/governance"
          icon="🗳️"
        />
      </div>
    </div>
  )
}

function DashboardCard({
  title,
  description,
  href,
  icon,
}: {
  title: string
  description: string
  href: string
  icon: string
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-gray-700 bg-gray-800/50 p-6 transition-all hover:border-purple-500/50 hover:bg-gray-800"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="text-xl font-semibold mb-2 group-hover:text-purple-400 transition-colors">
        {title}
      </h2>
      <p className="text-gray-400 text-sm">{description}</p>
    </a>
  )
}
