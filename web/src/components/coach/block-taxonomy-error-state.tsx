import Link from 'next/link'

export function BlockTaxonomyErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="lab-card p-6 sm:p-7">
      <p className="lab-eyebrow">Taxonomy Error</p>
      <h3 className="mt-3 text-2xl font-bold text-slate-900">{title}</h3>
      <p className="lab-copy mt-3 whitespace-pre-line">{description}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/coach/blocks" className="lab-btn-primary">
          回到板塊管理
        </Link>
        <Link href="/coach" className="lab-btn-secondary">
          回到教練端
        </Link>
      </div>
    </div>
  )
}
