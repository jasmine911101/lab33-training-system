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
}

type Props = {
  eyebrow: string
  title: string
  description: string
  breadcrumbs?: Breadcrumb[]
  entries: Entry[]
  emptyMessage: string
  createForm?: ReactNode
  aside?: ReactNode
}

export function BlockTaxonomyBrowser({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  entries,
  emptyMessage,
  createForm,
  aside,
}: Props) {
  return (
    <div className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        {breadcrumbs.length > 0 ? (
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
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
        ) : null}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="lab-eyebrow">{eyebrow}</p>
            <h1 className="lab-section-title mt-3">{title}</h1>
            <p className="lab-copy mt-3 max-w-3xl">{description}</p>
          </div>
          {aside ? <div className="lg:max-w-sm lg:min-w-[280px]">{aside}</div> : null}
        </div>
      </article>

      {createForm ? createForm : null}

      <article className="lab-card p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">Folders</p>
            <h2 className="lab-section-title mt-3">分類資料夾</h2>
          </div>
          <span className="lab-badge-primary">{entries.length} 個項目</span>
        </div>

        {entries.length === 0 ? (
          <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">{emptyMessage}</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                className="group rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="lab-eyebrow text-[0.72rem]">資料夾</p>
                    <h3 className="mt-3 text-xl font-bold text-slate-900 group-hover:text-orange-600">{entry.name}</h3>
                    {entry.meta ? <p className="mt-2 text-sm text-slate-500">{entry.meta}</p> : null}
                  </div>
                  <span className="lab-badge bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-700">前往</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
