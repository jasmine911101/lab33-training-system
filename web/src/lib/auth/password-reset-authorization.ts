export function canCoachResetManagedAthlete(input: {
  hasCoachAccess: boolean
  targetIsManaged: boolean
}) {
  return input.hasCoachAccess && input.targetIsManaged
}

export function canHeadCoachResetCoach(input: {
  actorIsHeadCoach: boolean
  actorCoachId: number
  targetCoachId: number
}) {
  return input.actorIsHeadCoach && input.actorCoachId !== input.targetCoachId
}

export function mustRevokeTargetSessionsAfterPasswordReset(success: boolean) {
  return success
}
