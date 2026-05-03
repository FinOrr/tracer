// src/types/index.ts

export type RequirementKeyword = 'SHALL' | 'SHALL NOT' | 'SHOULD' | 'SHOULD NOT' | 'MAY'

export const KEYWORD_META: Record<RequirementKeyword, { label: string; meaning: string; color: string }> = {
  'SHALL':     { label: 'SHALL',     meaning: 'Mandatory. Non-negotiable. Failure to meet this is a defect.',                      color: '#c0392b' },
  'SHALL NOT': { label: 'SHALL NOT', meaning: 'Absolutely prohibited. The system must never do this.',                             color: '#c0392b' },
  'SHOULD':    { label: 'SHOULD',    meaning: 'Recommended. Deviation requires documented justification.',                         color: '#9a5c00' },
  'SHOULD NOT':{ label: 'SHOULD NOT',meaning: 'Not recommended. Deviation requires documented justification.',                     color: '#9a5c00' },
  'MAY':       { label: 'MAY',       meaning: 'Optional. Permitted but not required.',                                             color: '#3a6b3a' },
}

export type ItemType          = 'intent' | 'requirement' | 'verification' | 'risk'
export type RelationshipType  = 'refines' | 'verifies' | 'mitigates'
export type RunResult         = 'pass' | 'fail'
export type RequirementStatus = 'verified' | 'stale' | 'missing'

export interface Project {
  id: string; name: string; description: string | null
  created_by: string; created_at: string
}

export interface Item {
  id: string; project_id: string; type: ItemType
  display_id: string; created_by: string; created_at: string
}

export interface ItemVersion {
  id: string; item_id: string; version_number: number
  text: string; metadata: Record<string, string>
  created_by: string; created_at: string
}

export interface VerificationRun {
  id: string; verification_item_id: string; requirement_version_id: string
  result: RunResult; evidence_filename: string | null
  notes: string | null; run_by: string; run_at: string
}

export interface RequirementRow {
  id: string; project_id: string; display_id: string
  current_version_id: string; current_version: number
  current_text: string; last_edited_at: string; status: RequirementStatus
}

// Trace matrix row , one per requirement
export interface TraceRow {
  req:          RequirementRow
  verification: { id: string; display_id: string; method: string; criteria: string } | null
  run:          VerificationRun | null
}

// Intent with resolved text for display
export interface IntentRow {
  id:         string
  display_id: string
  text:       string
}

//  Form inputs 

export interface CreateProjectInput {
  name:         string
  description?: string
}

export interface CreateIntentInput {
  project_id: string
  text:       string
}

export interface CreateRequirementInput {
  project_id:      string
  text:            string
  intent_item_id?: string
}

export interface EditRequirementInput {
  item_id: string
  text:    string
}

export interface CreateVerificationInput {
  project_id:          string
  requirement_item_id: string
  text:                string
  method:              string
  criteria:            string
  setup?:              string
}

export interface SubmitRunInput {
  verification_item_id:   string
  requirement_version_id: string
  result:                 RunResult
  evidence_filename?:     string
  notes?:                 string
}
