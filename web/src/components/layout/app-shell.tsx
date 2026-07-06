import Link from 'next/link'

import { LogoutButton } from '@/components/auth/logout-button'
import type { AppRole } from '@/lib/auth/roles'

type AppShellProps = {
  title: string
  description: string
  role: Exclude<AppRole, 'unknown'>
  userEmail?: string | null
  roleLabel: string
  currentPath: string
  hideHeaderCard?: boolean
  children: React.ReactNode
}

type NavItem = {
  href: string
  label: string
  shortLabel: string
  icon: string
}

function getNavItems(role: Exclude<AppRole, 'unknown'>): NavItem[] {
  if (role === 'coach') {
    return [
      { href: '/coach', label: '學員管理', shortLabel: '學員', icon: 'A' },
      { href: '/coach/blocks', label: '板塊管理', shortLabel: '板塊', icon: 'B' },
      { href: '/dashboard', label: '角色分流', shortLabel: '分流', icon: 'H' },
      { href: '/', label: '網站首頁', shortLabel: '首頁', icon: 'L' },
    ]
  }

  return [
    { href: '/student', label: '我的課表', shortLabel: '課表', icon: 'T' },
    { href: '/dashboard', label: '角色分流', shortLabel: '分流', icon: 'H' },
    { href: '/', label: '網站首頁', shortLabel: '首頁', icon: 'L' },
  ]
}

function isNavItemActive(itemHref: string, currentPath: string) {
  if (itemHref === '/') return currentPath === '/'
  if (itemHref === '/coach') return currentPath === '/coach'
  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`)
}

function NavLinks({ items, currentPath }: { items: NavItem[]; currentPath: string }) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isActive = isNavItemActive(item.href, currentPath)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`lab-nav-link ${isActive ? 'lab-nav-link-active' : ''}`}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-xs font-black text-slate-500 shadow-sm">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </span>
            <span className="text-xs">›</span>
          </Link>
        )
      })}
    </div>
  )
}

export function AppShell({ title, description, role, userEmail, roleLabel, currentPath, hideHeaderCard = false, children }: AppShellProps) {
  const navItems = getNavItems(role)

  return (
    <div className="lab-page">
      <div className="lab-app-shell">
        <aside className="lab-shell-sidebar">
          <div className="lab-shell-panel">
            <div className="lab-shell-brand">
              <div className="lab-brand-mark">33</div>
              <div>
                <p className="lab-eyebrow">LAB33 Training System</p>
                <h1 className="mt-2 text-3xl font-bold leading-none">{role === 'coach' ? 'Coach Hub' : 'Athlete Hub'}</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {role === 'coach'
                    ? '管理學員、查看已安排課表與一般事件，逐步從 Streamlit 遷移完整訓練管理流程。'
                    : '聚焦自己的課表、一般事件與訓練內容，後續再搬移回報與互動流程。'}
                </p>
              </div>
            </div>
          </div>

          <div className="lab-shell-panel">
            <p className="lab-eyebrow">Navigation</p>
            <div className="mt-4">
              <NavLinks items={navItems} currentPath={currentPath} />
            </div>
          </div>

          <div className="lab-shell-panel lg:mt-auto">
            <div className="space-y-3">
              <span className={role === 'coach' ? 'lab-badge-primary' : 'lab-badge-info'}>{roleLabel}</span>
              <p className="text-sm font-semibold text-slate-800">{userEmail ?? '未登入'}</p>
            </div>
            <div className="mt-5">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="lab-mobile-topbar">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">LAB33</p>
              <h1 className="font-display text-2xl leading-none text-slate-900">{title}</h1>
            </div>
            <span className={role === 'coach' ? 'lab-badge-primary' : 'lab-badge-info'}>{roleLabel}</span>
          </header>

          {hideHeaderCard ? null : (
            <div className="lab-card overflow-hidden p-6 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-3xl">
                  <p className="lab-eyebrow">Logged In Experience</p>
                  <h2 className="lab-section-title mt-3">{title}</h2>
                  <p className="lab-copy mt-3">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={role === 'coach' ? 'lab-badge-primary' : 'lab-badge-info'}>{roleLabel}</span>
                  <span className="lab-badge bg-slate-100 text-slate-600">{userEmail ?? '未登入'}</span>
                </div>
              </div>
            </div>
          )}

          <main className={`${hideHeaderCard ? '' : 'mt-6'} flex-1`}>{children}</main>
        </div>
      </div>

      <div className="lab-mobile-nav" aria-label="行動版導覽">
        <div className="lab-mobile-nav-grid">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.href, currentPath)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`lab-mobile-nav-link ${isActive ? 'lab-mobile-nav-link-active' : ''}`}
              >
                <span className="text-sm font-black">{item.icon}</span>
                <span>{item.shortLabel}</span>
              </Link>
            )
          })}
          <div className="flex items-center justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  )
}
