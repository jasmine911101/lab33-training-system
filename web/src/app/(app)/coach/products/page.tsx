import { ProductManagementPanel } from '@/components/coach/product-management-panel'
import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { AppShell } from '@/components/layout/app-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getProductManagementSnapshot } from '@/services/commerce-products'
import { getTeamOptionsForCoach } from '@/services/team-programs'

export default async function CoachProductsPage() {
  const context = await requireCoachAccess('/coach/login')
  const coachProfile = context.coachProfile

  if (!coachProfile) {
    return (
      <AppShell
        title="商品管理"
        description="目前登入帳號尚未對應到 coach profile，因此無法顯示商品管理內容。"
        role="coach"
        userEmail={context.user.email}
        roleLabel="教練"
        currentPath="/coach/products"
      >
        <ProfileStatusCard
          title="找不到對應的 coach profile"
          description="目前這個登入帳號尚未對應到 `coaches` 資料，因此無法顯示教練端商品內容。"
          loginHref="/coach/login"
          loginLabel="返回教練登入"
        />
      </AppShell>
    )
  }

  let snapshot: Awaited<ReturnType<typeof getProductManagementSnapshot>> | null = null
  let teamOptions: Awaited<ReturnType<typeof getTeamOptionsForCoach>> = []
  let error: string | null = null
  let teamOptionsError: string | null = null

  try {
    const [nextSnapshot, nextTeamOptions] = await Promise.all([
      getProductManagementSnapshot(coachProfile),
      getTeamOptionsForCoach(coachProfile).catch((teamError) => {
        teamOptionsError = teamError instanceof Error ? teamError.message : 'Team options 目前無法載入。'
        return []
      }),
    ])
    snapshot = nextSnapshot
    teamOptions = nextTeamOptions
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : '商品資料目前無法載入。'
  }

  const roleLabel = coachProfile.is_head_coach ? '總教練' : '教練'

  return (
    <AppShell
      title="商品管理"
      description="建立 Training Product，將多個 Block 組合成可上架的訓練商品。"
      role="coach"
      userEmail={context.user.email}
      roleLabel={roleLabel}
      currentPath="/coach/products"
    >
      {error ? (
        <div className="lab-card p-6 text-sm text-rose-700">
          <p className="font-semibold">商品管理目前無法載入</p>
          <p className="mt-2 text-rose-600">{error}</p>
          <p className="mt-3 text-slate-600">請確認 Commerce migration 已套用，且 server-side service role 可讀取商品資料表。</p>
        </div>
      ) : snapshot ? (
        <>
          {teamOptionsError ? (
            <div className="mb-4 rounded-[1rem] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Team options 目前無法載入；商品管理仍可使用，但暫時不能指派給球隊。{teamOptionsError}
            </div>
          ) : null}
          <ProductManagementPanel
            initialProducts={snapshot.products}
            blockOptions={snapshot.blockOptions}
            teamOptions={teamOptions}
            isHeadCoach={coachProfile.is_head_coach === true}
          />
        </>
      ) : null}
    </AppShell>
  )
}
