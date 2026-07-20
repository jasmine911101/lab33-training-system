export const TEAM_MEMBERSHIP_STATUSES = ['active', 'inactive', 'removed'] as const
export const TEAM_COACH_ROLES = ['owner', 'manager', 'coach', 'viewer'] as const
export const TEAM_COACH_STATUSES = ['active', 'inactive', 'removed'] as const
export const TEAM_ENROLLMENT_STATUSES = ['draft', 'active', 'ended', 'cancelled'] as const
export const TEAM_PROGRAM_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'] as const
export const TEAM_SESSION_STATUSES = ['scheduled', 'available', 'completed', 'cancelled'] as const
export const TEAM_RESULT_STATUSES = ['not_started', 'in_progress', 'completed', 'skipped'] as const

export type TeamMembershipStatus = (typeof TEAM_MEMBERSHIP_STATUSES)[number]
export type TeamCoachRole = (typeof TEAM_COACH_ROLES)[number]
export type TeamCoachStatus = (typeof TEAM_COACH_STATUSES)[number]
export type TeamEnrollmentStatus = (typeof TEAM_ENROLLMENT_STATUSES)[number]
export type TeamProgramStatus = (typeof TEAM_PROGRAM_STATUSES)[number]
export type TeamSessionStatus = (typeof TEAM_SESSION_STATUSES)[number]
export type TeamResultStatus = (typeof TEAM_RESULT_STATUSES)[number]

export type TeamMembershipRecord = {
  id: number
  team_id: number
  athlete_id: number
  athlete_name: string | null
  athlete_email: string | null
  status: TeamMembershipStatus
  joined_at: string | null
  left_at: string | null
  created_at: string | null
}

export type TeamCoachRecord = {
  id: number
  team_id: number
  coach_id: number
  coach_name: string | null
  coach_email: string | null
  role: TeamCoachRole
  can_manage_roster: boolean
  can_manage_programs: boolean
  can_view_results: boolean
  status: TeamCoachStatus
  assigned_by: number | null
  created_at: string | null
  updated_at: string | null
  removed_at: string | null
}

export type TeamRecord = {
  id: number
  name: string
  description: string | null
  sport_type: string | null
  created_by: number
  created_by_name: string | null
  created_by_email: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  activeRosterCount: number
  memberships: TeamMembershipRecord[]
  coaches: TeamCoachRecord[]
  activeSeatLimit: number | null
}

export type TeamOption = {
  id: number
  name: string
  activeRosterCount: number
  activeSeatLimit: number | null
}

export type TeamProgramSessionRecord = {
  id: number
  team_program_instance_id: number
  source_product_block_id: number
  source_block_id: number
  title: string
  block_code: string | null
  block_name: string | null
  scheduled_date: string | null
  week_number: number | null
  day_number: number | null
  sort_order: number
  status: TeamSessionStatus
  created_at: string | null
  updated_at: string | null
}

export type TeamEnrollmentRecord = {
  id: number
  team_id: number
  team_name: string
  product_id: number
  product_name: string
  product_version_id: number
  product_version_number: number
  assigned_by: number
  assigned_by_name: string | null
  start_date: string
  end_date: string | null
  seat_limit: number | null
  status: TeamEnrollmentStatus
  access_mode: 'dynamic_roster'
  created_at: string | null
  activated_at: string | null
  ended_at: string | null
  cancelled_at: string | null
  program: TeamProgramRecord | null
  activeRosterCount: number
  sessionsCount: number
}

export type TeamProgramRecord = {
  id: number
  team_product_enrollment_id: number
  team_id: number
  team_name: string
  product_version_id: number
  product_version_number: number
  product_name: string
  name: string
  start_date: string
  end_date: string | null
  timezone: string
  status: TeamProgramStatus
  source_snapshot_json: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
  sessions: TeamProgramSessionRecord[]
}

export type TeamManagementSnapshot = {
  teams: TeamRecord[]
  athleteOptions: Array<{ id: number; name: string | null; email: string | null; sport: string | null }>
  coachOptions: Array<{ id: number; name: string | null; email: string | null; is_head_coach: boolean | null }>
}

export type TeamProgramsSnapshot = {
  enrollments: TeamEnrollmentRecord[]
}

export type AssignProductVersionPayload = {
  teamId: number
  productVersionId: number
  startDate: string
  endDate?: string | null
  seatLimit?: number | null
  timezone?: string | null
}

export type StudentTeamSessionResult = {
  id: number
  team_program_session_id: number
  athlete_id: number
  status: TeamResultStatus
  started_at: string | null
  completed_at: string | null
  notes: string | null
  result_json: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type StudentTeamProgramSession = TeamProgramSessionRecord & {
  result: StudentTeamSessionResult | null
}

export type StudentTeamProgramSummary = {
  id: number
  teamName: string
  programName: string
  productName: string
  productVersionNumber: number
  startDate: string
  endDate: string | null
  status: TeamProgramStatus
  progress: {
    total: number
    completed: number
  }
  nextSession: StudentTeamProgramSession | null
}

export type StudentTeamProgramDetail = StudentTeamProgramSummary & {
  timezone: string
  sessions: StudentTeamProgramSession[]
}
