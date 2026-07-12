export type CoachDirectoryEntry = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  is_head_coach: boolean | null
  created_at?: string | null
}

export type ManagedCoachRecord = CoachDirectoryEntry & {
  managedAthleteCount: number
}

export type CoachAssignmentBadge = {
  id: number
  label: string
  roleLabel: '總教練' | '教練'
}

export type ManagedAthleteRecord = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  sport: string | null
  level: string | null
  must_change_password: boolean | null
  assignedCoachIds: number[]
  assignedCoachLabels: string[]
  assignedCoachBadges: CoachAssignmentBadge[]
}

export type CoachManagementSnapshot = {
  athletes: ManagedAthleteRecord[]
  assignableCoaches: CoachDirectoryEntry[]
  coaches: ManagedCoachRecord[]
}

export function coachDisplayName(coach: Pick<CoachDirectoryEntry, 'id' | 'name' | 'email'>) {
  const name = coach.name?.trim()
  const email = coach.email?.trim()

  if (name && email) {
    return `${name} (${email})`
  }

  return name || email || `Coach ${coach.id}`
}

export function scoreSearchText(
  value: string | null | undefined,
  query: string,
  exactWeight: number,
  prefixWeight: number,
  tokenPrefixWeight: number,
  containsWeight: number,
) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text || !query) return 0
  if (text === query) return exactWeight

  let score = 0

  if (text.startsWith(query)) {
    score = Math.max(score, prefixWeight)
  }

  const normalizedTokens = text
    .replaceAll('@', ' ')
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .split(' ')
    .filter(Boolean)

  if (normalizedTokens.some((token) => token.startsWith(query))) {
    score = Math.max(score, tokenPrefixWeight)
  }

  if (text.includes(query)) {
    score = Math.max(score, containsWeight)
  }

  return score
}

export function rankAthletesBySearch(athletes: ManagedAthleteRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return athletes
  }

  const ranked = athletes
    .map((athlete) => {
      let score = 0
      score += scoreSearchText(athlete.name, normalizedQuery, 240, 180, 140, 100)
      score += scoreSearchText(athlete.email, normalizedQuery, 220, 160, 120, 90)
      score += scoreSearchText(athlete.sport, normalizedQuery, 180, 130, 100, 70)
      score += athlete.assignedCoachLabels.reduce(
        (total, label) => total + scoreSearchText(label, normalizedQuery, 200, 150, 120, 90),
        0,
      )
      return { athlete, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return ranked.map((entry) => entry.athlete)
}

export function rankCoachesBySearch(coaches: ManagedCoachRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return coaches
  }

  const ranked = coaches
    .map((coach) => {
      let score = 0
      score += scoreSearchText(coach.name, normalizedQuery, 240, 180, 140, 100)
      score += scoreSearchText(coach.email, normalizedQuery, 220, 160, 120, 90)
      return { coach, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return ranked.map((entry) => entry.coach)
}
