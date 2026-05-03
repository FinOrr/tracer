'use server'
// src/lib/actions.ts , complete, merged, single source of truth

import { createClient }   from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CreateProjectInput,
  CreateIntentInput,
  CreateRequirementInput,
  EditRequirementInput,
  CreateVerificationInput,
  SubmitRunInput,
} from '@/types'

//  Auth helper 

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  return { supabase, user }
}

//  Display ID helper 

async function nextDisplayId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  type: string,
  prefix: string
) {
  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('type', type)
  return `${prefix}-${String((count ?? 0) + 1).padStart(3, '0')}`
}

//  Projects 

export async function createProject(input: CreateProjectInput) {
  const { supabase, user } = await getUser()

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name:        input.name.trim(),
      description: input.description?.trim() || null,
      created_by:  user.id,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/dashboard')
  return project
}

//  Sign out 

export async function signOut() {
  const { supabase } = await getUser()
  await supabase.auth.signOut()
  revalidatePath('/')
}

//  Intents 

export async function createIntent(input: CreateIntentInput) {
  const { supabase, user } = await getUser()
  const displayId = await nextDisplayId(supabase, input.project_id, 'intent', 'INT')

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .insert({ project_id: input.project_id, type: 'intent', display_id: displayId, created_by: user.id })
    .select()
    .single()

  if (itemErr) throw itemErr

  const { error: verErr } = await supabase
    .from('item_versions')
    .insert({ item_id: item.id, version_number: 1, text: input.text, metadata: {}, created_by: user.id })

  if (verErr) throw verErr

  revalidatePath(`/project/${input.project_id}`)
  return item
}

//  Requirements 

export async function createRequirement(input: CreateRequirementInput) {
  const { supabase, user } = await getUser()
  const displayId = await nextDisplayId(supabase, input.project_id, 'requirement', 'REQ')

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .insert({ project_id: input.project_id, type: 'requirement', display_id: displayId, created_by: user.id })
    .select()
    .single()

  if (itemErr) throw itemErr

  const { error: verErr } = await supabase
    .from('item_versions')
    .insert({ item_id: item.id, version_number: 1, text: input.text, metadata: {}, created_by: user.id })

  if (verErr) throw verErr

  if (input.intent_item_id) {
    await supabase.from('relationships').insert({
      project_id:   input.project_id,
      from_item_id: item.id,
      to_item_id:   input.intent_item_id,
      type:         'refines',
    })
  }

  revalidatePath(`/project/${input.project_id}`)
  return item
}

export async function editRequirement(input: EditRequirementInput) {
  const { supabase, user } = await getUser()

  const { data: latest } = await supabase
    .from('item_versions')
    .select('version_number')
    .eq('item_id', input.item_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (latest?.version_number ?? 0) + 1

  const { error } = await supabase
    .from('item_versions')
    .insert({
      item_id: input.item_id, version_number: nextVersion,
      text: input.text, metadata: {}, created_by: user.id,
    })

  if (error) throw error

  const { data: item } = await supabase
    .from('items').select('project_id').eq('id', input.item_id).single()

  revalidatePath(`/project/${item?.project_id}`)
}

//  Verifications 

export async function createVerification(input: CreateVerificationInput) {
  const { supabase, user } = await getUser()
  const displayId = await nextDisplayId(supabase, input.project_id, 'verification', 'VER')

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .insert({ project_id: input.project_id, type: 'verification', display_id: displayId, created_by: user.id })
    .select()
    .single()

  if (itemErr) throw itemErr

  const { error: verErr } = await supabase
    .from('item_versions')
    .insert({
      item_id: item.id, version_number: 1, text: input.text,
      metadata: { method: input.method, criteria: input.criteria, setup: input.setup ?? '' },
      created_by: user.id,
    })

  if (verErr) throw verErr

  const { error: relErr } = await supabase
    .from('relationships')
    .insert({
      project_id:   input.project_id,
      from_item_id: item.id,
      to_item_id:   input.requirement_item_id,
      type:         'verifies',
    })

  if (relErr) throw relErr

  revalidatePath(`/project/${input.project_id}`)
  return { ...item, text: input.text, method: input.method, criteria: input.criteria, setup: input.setup ?? null, last_run: null }
}

//  Verification runs 

export async function submitVerificationRun(input: SubmitRunInput) {
  const { supabase, user } = await getUser()

  const { error } = await supabase.from('verification_runs').insert({
    verification_item_id:   input.verification_item_id,
    requirement_version_id: input.requirement_version_id,
    result:                 input.result,
    evidence_filename:      input.evidence_filename ?? null,
    notes:                  input.notes ?? null,
    run_by:                 user.id,
  })

  if (error) throw error

  const { data: rel } = await supabase
    .from('relationships')
    .select('project_id')
    .eq('from_item_id', input.verification_item_id)
    .eq('type', 'verifies')
    .single()

  revalidatePath(`/project/${rel?.project_id}`)
}

//  Queries 

export async function getTraceMatrix(projectId: string) {
  const { supabase } = await getUser()

  // All requirements with status
  const { data: reqs, error } = await supabase
    .from('requirement_status')
    .select('*')
    .eq('project_id', projectId)
    .order('display_id', { ascending: true })

  if (error) throw error
  if (!reqs?.length) return []

  // For each requirement, fetch its linked verification and latest run
  const rows = await Promise.all(reqs.map(async (req) => {
    // Linked verification
    const { data: verRel } = await supabase
      .from('relationships')
      .select('from_item_id')
      .eq('to_item_id', req.id)
      .eq('type', 'verifies')
      .maybeSingle()

    if (!verRel) return { req, verification: null, run: null }

    const { data: verVersion } = await supabase
      .from('item_versions')
      .select('text, metadata, item_id, items(display_id)')
      .eq('item_id', verRel.from_item_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    const { data: run } = await supabase
      .from('verification_runs')
      .select('*')
      .eq('verification_item_id', verRel.from_item_id)
      .order('run_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      req,
      verification: verVersion ? {
        id:         verRel.from_item_id,
        display_id: (verVersion.items as any)?.display_id,
        method:     (verVersion.metadata as any)?.method ?? '',
        criteria:   (verVersion.metadata as any)?.criteria ?? '',
      } : null,
      run: run ?? null,
    }
  }))

  return rows
}
