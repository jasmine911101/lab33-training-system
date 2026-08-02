import Link from 'next/link'
import type { ReactNode } from 'react'

type Breadcrumb = {
  label: string
  href?: string
}

type Entry = {
  id: number | string
  name: string
  href: string
  meta?: string
  actions?: ReactNode
}

type Props = {
  eyebrow: string
  title: string
  breadcrumbs?: Breadcrumb[]
  entries: Entry[]
  emptyMessage: string
  createForm?: ReactNode
  aside?: ReactNode
}

export function BlockTaxonomyBrowser({
  eyebrow,
  title,
  breadcrumbs = [],
  entries,
  emptyMessage,
  createForm,
  aside,
}: Props) {
  const parentHref = [...breadcrumbs].reverse().find((breadcrumb) => breadcrumb.href)?.href

  return (
    <div className="space-y-6">
      {breadcrumbs.length > 0 || parentHref ? (
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          {breadcrumbs.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="板塊路徑">
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span>/</span> : null}
                {breadcrumb.href ? (
                  <Link href={breadcrumb.href} className="hover:text-slate-900">{breadcrumb.label}</Link>
                ) : (
                  <span className="font-semibold text-slate-900">{breadcrumb.label}</span>
                )}
              </div>
            ))}
          </nav>
          ) : <span className="lab-eyebrow">{eyebrow}</span>}

          {parentHref ? (
          <Link href={parentHref} className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">
            ← 返回上一層
          </Link>
          ) : null}
        </div>
      ) : null}

      {createForm ? createForm : null}

      <article className="lab-card overflow-hidden p-7 sm:p-8">
        <div className="lab-section-heading lab-section-heading-flush items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">{eyebrow}</p>
            <h1 className="lab-section-title mt-3">{title === '板塊分類' ? '專項資料夾' : title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {aside}
            <span className="lab-badge-primary">{entries.length} 個項目</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">{emptyMessage}</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <div key={entry.id} className="group rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <Link href={entry.href} className="block rounded-[0.9rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="lab-eyebrow text-[0.72rem]">資料夾</p>
                    <h3 className="mt-3 truncate text-xl font-bold text-slate-900 group-hover:text-orange-600">{entry.name}</h3>
                    {entry.meta ? <p className="mt-2 text-sm text-slate-500">{entry.meta}</p> : null}
                  </div>
                  <span className="lab-badge bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-700">前往</span>
                </div>
                </Link>
                {entry.actions}
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
