export function compactWeekLabel(weekLabel: string) {
  const matched = weekLabel.match(/(\d+)/)
  return matched ? `W${matched[1]}` : 'W-'
}

export function weekNumberLabel(weekLabel: string) {
  const matched = weekLabel.match(/(\d+)/)
  return matched ? matched[1] : '-'
}

export function cycleNameFromAssignment(cycleName?: string | null, cycleGoal?: string | null) {
  return (cycleName ?? cycleGoal ?? '').trim()
}

export function AssignmentCalendarPreview({
  weekLabel,
  cycleName,
  eventName,
  categoryLabel,
  blockCode,
}: {
  weekLabel: string
  cycleName?: string | null
  eventName: string
  categoryLabel: string
  blockCode: string
}) {
  const resolvedCycleName = cycleNameFromAssignment(cycleName)

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 font-bold">{compactWeekLabel(weekLabel)}</span>
        <span className="truncate">{eventName || '未命名安排'}</span>
      </div>
      {resolvedCycleName ? (
        <div className="truncate text-[10px] opacity-85" title={resolvedCycleName}>
          {resolvedCycleName}
        </div>
      ) : null}
      <div className="truncate text-[10px] opacity-85">
        {categoryLabel || '未分類'}・{blockCode || '無代號'}
      </div>
    </div>
  )
}

export function CycleBadge({
  weekLabel,
  cycleName,
  className = 'lab-badge bg-slate-100 text-slate-700',
}: {
  weekLabel: string
  cycleName?: string | null
  className?: string
}) {
  const resolvedCycleName = cycleNameFromAssignment(cycleName)

  return (
    <span className={`${className} max-w-full`}>
      <span className="truncate">{weekLabel}</span>
      {resolvedCycleName ? (
        <span className="ml-1 max-w-[12rem] truncate opacity-80" title={resolvedCycleName}>
          ｜{resolvedCycleName}
        </span>
      ) : null}
    </span>
  )
}
