import Link from 'next/link'

import { LogoutButton } from '@/components/auth/logout-button'
import { BrandLogo } from '@/components/layout/brand-logo'
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
      { href: '/coach/qa', label: 'Q&A 庫', shortLabel: 'Q&A', icon: 'Q' },
      { href: '/', label: '網站首頁', shortLabel: '首頁', icon: 'L' },
    ]
  }

  return [
    { href: '/student', label: '我的課表', shortLabel: '課表', icon: 'T' },
    { href: '/student/qa', label: 'Q&A 庫', shortLabel: 'Q&A', icon: 'Q' },
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
            aria-current={isActive ? 'page' : undefined}
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
          <div className="lab-shell-panel lab-shell-brand-panel">
            <Link href="/" className="lab-shell-brand-link" aria-label="LAB33 首頁">
              <BrandLogo className="w-48" priority />
            </Link>
            <p className="lab-shell-role-label">{role === 'coach' ? '教練端' : '學員端'}</p>
          </div>

          <div className="lab-shell-panel">
            <NavLinks items={navItems} currentPath={currentPath} />
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
            <Link href="/" aria-label="LAB33 首頁"><BrandLogo className="w-24" priority /></Link>
            <h1 className="lab-page-title !rounded-xl !px-3 !py-2 text-2xl">{title}</h1>
            <span className={role === 'coach' ? 'lab-badge-primary' : 'lab-badge-info'}>{roleLabel}</span>
          </header>

          {hideHeaderCard ? null : (
            <div className="lab-card overflow-hidden p-7 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-3xl">
                  <h2 className="lab-page-title">{title}</h2>
                  <p className="lab-copy mt-2">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={role === 'coach' ? 'lab-badge-primary' : 'lab-badge-info'}>{roleLabel}</span>
                  <span className="lab-badge bg-slate-100 text-slate-600">{userEmail ?? '未登入'}</span>
                </div>
              </div>
            </div>
          )}

          <main id="main-content" className={`${hideHeaderCard ? '' : 'mt-6'} flex-1`}>{children}</main>
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
