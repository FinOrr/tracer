// src/app/project/[id]/page.tsx

import { redirect, notFound } from 'next/navigation'
import { createClient }       from '@/lib/supabase/server'
import { getTraceMatrix }     from '@/lib/actions'
import { Workspace }          from '@/components/workspace/Workspace'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ item?: string }>
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id }   = await params
  const { item } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { data: project } = await supabase
    .from('projects').select('*').eq('id', id).single()

  if (!project) notFound()

  const { data: requirements } = await supabase
    .from('requirement_status')
    .select('*')
    .eq('project_id', id)
    .order('display_id', { ascending: true })

  const { data: intents } = await supabase
    .from('items')
    .select('id, display_id, item_versions ( text, version_number )')
    .eq('project_id', id)
    .eq('type', 'intent')
    .order('display_id')

  // Trace matrix rows (requirement + linked verification + latest run)
  const traceRows = await getTraceMatrix(id)

  // req→intent mapping for Stories view
  const { data: reqLinks } = await supabase
    .from('relationships')
    .select('from_item_id, to_item_id')
    .eq('project_id', id)
    .eq('type', 'refines')

  const selectedId = item ?? requirements?.[0]?.id ?? null
  const detail     = selectedId ? await loadDetail(supabase, selectedId) : null

  return (
    <Workspace
      project={project}
      requirements={requirements ?? []}
      traceRows={traceRows ?? []}
      intents={intents ?? []}
      reqLinks={reqLinks ?? []}
      initialDetail={detail}
      initialSelectedId={selectedId}
    />
  )
}

async function loadDetail(supabase: Awaited<ReturnType<typeof createClient>>, itemId: string) {
  const { data: req } = await supabase
    .from('requirement_status').select('*').eq('id', itemId).single()
  if (!req) return null

  const { data: intentRel } = await supabase
    .from('relationships')
    .select('to_item_id')
    .eq('from_item_id', itemId).eq('type', 'refines').maybeSingle()

  let intent = null
  if (intentRel) {
    const { data: iv } = await supabase
      .from('item_versions')
      .select('text, item_id, items(display_id)')
      .eq('item_id', intentRel.to_item_id)
      .order('version_number', { ascending: false }).limit(1).single()
    if (iv) intent = { id: intentRel.to_item_id, display_id: (iv.items as any)?.display_id, text: iv.text }
  }

  const { data: verRel } = await supabase
    .from('relationships')
    .select('from_item_id')
    .eq('to_item_id', itemId).eq('type', 'verifies').maybeSingle()

  let verification = null
  if (verRel) {
    const { data: vv } = await supabase
      .from('item_versions')
      .select('text, metadata, item_id, items(display_id)')
      .eq('item_id', verRel.from_item_id)
      .order('version_number', { ascending: false }).limit(1).single()

    const { data: run } = await supabase
      .from('verification_runs')
      .select('*')
      .eq('verification_item_id', verRel.from_item_id)
      .order('run_at', { ascending: false }).limit(1).maybeSingle()

    if (vv) verification = {
      id:         verRel.from_item_id,
      display_id: (vv.items as any)?.display_id,
      text:       vv.text,
      method:     (vv.metadata as any)?.method   ?? '',
      criteria:   (vv.metadata as any)?.criteria ?? '',
      setup:      (vv.metadata as any)?.setup    ?? null,
      last_run:   run ?? null,
    }
  }

  return { req, intent, verification }
}
