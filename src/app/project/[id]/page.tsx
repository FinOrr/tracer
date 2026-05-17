import { notFound } from 'next/navigation'
import { Workspace } from '@/components/workspace/Workspace'
import {
  getProject,
  getTraceMatrix,
  listIntents,
  listRequirementIntentLinks,
  listRequirements,
  loadRequirementDetail,
} from '@/lib/store'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ item?: string }>
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id }   = await params
  const { item } = await searchParams

  const project = getProject(id)
  if (!project) notFound()

  const requirements = listRequirements(id)
  const intents = listIntents(id)
  const traceRows = await getTraceMatrix(id)
  const reqLinks = listRequirementIntentLinks(id)

  const selectedId = item ?? requirements?.[0]?.id ?? null
  const detail     = selectedId ? loadRequirementDetail(selectedId) : null

  return (
    <Workspace
      project={project}
      requirements={requirements}
      traceRows={traceRows}
      intents={intents}
      reqLinks={reqLinks}
      initialDetail={detail}
      initialSelectedId={selectedId}
    />
  )
}
