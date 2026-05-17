import { DashboardClient } from './DashboardClient'
import { listProjects }    from '@/lib/store'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  return <DashboardClient projects={listProjects()} />
}
