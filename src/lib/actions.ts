'use server'

import { revalidatePath } from 'next/cache'
import type {
  CreateIntentInput,
  CreateProjectInput,
  CreateRequirementInput,
  CreateVerificationInput,
  EditRequirementInput,
  SubmitRunInput,
} from '@/types'
import {
  createIntentRecord,
  createProjectRecord,
  createRequirementRecord,
  createVerificationRecord,
  editRequirementRecord,
  getTraceMatrix as getTraceMatrixRows,
  submitVerificationRunRecord,
} from '@/lib/store'

export async function createProject(input: CreateProjectInput) {
  const project = createProjectRecord(input)
  revalidatePath('/dashboard')
  return project
}

export async function createIntent(input: CreateIntentInput) {
  const item = createIntentRecord(input)
  revalidatePath(`/project/${input.project_id}`)
  return item
}

export async function createRequirement(input: CreateRequirementInput) {
  const item = createRequirementRecord(input)
  revalidatePath(`/project/${input.project_id}`)
  return item
}

export async function editRequirement(input: EditRequirementInput) {
  const item = editRequirementRecord(input)
  if (item?.project_id) revalidatePath(`/project/${item.project_id}`)
}

export async function createVerification(input: CreateVerificationInput) {
  const verification = createVerificationRecord(input)
  revalidatePath(`/project/${input.project_id}`)
  return verification
}

export async function submitVerificationRun(input: SubmitRunInput) {
  const { project_id } = submitVerificationRunRecord(input)
  if (project_id) revalidatePath(`/project/${project_id}`)
}

export async function getTraceMatrix(projectId: string) {
  return getTraceMatrixRows(projectId)
}
