import Link from 'next/link'

export function ProfileStatusCard({
  title,
  description,
  loginHref,
  loginLabel,
}: {
  title: string
  description: string
  loginHref: string
  loginLabel: string
}) {
  return (
    <div className="lab-card p-6 sm:p-7">
      <p className="lab-eyebrow">Profile Check</p>
      <h3 className="mt-3 text-2xl font-bold text-slate-900">{title}</h3>
      <p className="lab-copy mt-3">{description}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={loginHref} className="lab-btn-primary">
          {loginLabel}
        </Link>
        <Link href="/dashboard" className="lab-btn-secondary">
          回到身份檢查
        </Link>
      </div>
    </div>
  )
}
