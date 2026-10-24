# 板塊移動與複製

在分類內的板塊列表按「移動」或「複製」，依序選擇運動項目、年齡層與訓練分類，再確認操作。

- 移動只修改板塊的分類，保留原 ID、內容和課表引用。
- 複製建立新的板塊、區段和動作 ID，保留內容、空區段、備註、影片連結及順序。不複製已安排的個人／團隊課表，也不更動原板塊。
- 複製的代碼與名稱必須與現有板塊不同；預填 `原代碼-COPY` 與 `原名稱（副本）`，可自行修改。
- 不允許把目標設成原本的分類；未分類板塊也可以移動或複製到已建立的分類。
- 目標分類及其上層必須仍啟用。API 會驗證教練登入、改密碼要求及輸入格式，服務端再次驗證來源與目標。

## 修改範圍

### 初學者閱讀順序

1. 先讀 `src/lib/types/block-transfer.ts`：認識操作要送出的資料與成功後的回傳資料。
2. 再讀 `src/components/coach/block-transfer-form.tsx`：從載入分類、選擇目的地，一路看到送出表單。
3. 接著讀 `src/app/api/coach/blocks/[blockId]/transfer/route.ts`：看伺服器如何先確認教練權限，再檢查輸入。
4. 最後讀 `src/services/block-transfer.ts`：看實際移動或複製的順序，以及失敗時如何清理。

這裡的 `await` 表示等待一個非同步工作完成；`throw new Error(...)` 表示目前步驟無法繼續，交給外層 `catch` 顯示錯誤或清理副本。`Map` 用來記住「原區段 ID → 新區段 ID」，讓副本動作連到新區段。

- `src/components/coach/coach-block-library-panel.tsx`：操作入口及成功提示。
- `src/components/coach/block-transfer-form.tsx`：分類連動、複製名稱、載入／空清單／錯誤／處理中狀態。
- `src/lib/types/block-transfer.ts`：介面與 API 共用型別。
- `src/services/block-transfer.ts`：來源／目標驗證、移動與複製、失敗清理。
- `src/app/api/coach/blocks/transfer-options/route.ts`：提供可用分類。
- `src/app/api/coach/blocks/[blockId]/transfer/route.ts`：受教練權限保護的操作入口。
- `tests/block-transfer.test.mjs`：實際 API 與服務的隔離回歸測試。

不需要新增資料表、migration 或 RLS 政策。管理用連線只在伺服器使用，不傳到瀏覽器。

## 在測試資料庫的驗證步驟

1. 準備 A、B 兩個分類，以及 A 內的測試板塊，包含區段、動作、影片、備註，並安排一份測試課表。
2. 把板塊從 A 移動到 B。重新整理兩個分類，確認 A 不再顯示、B 有顯示；確認原課表內容與回報仍正常。
3. 從 B 複製到 A，輸入未使用的代碼與名稱。確認所有內容與順序一致，兩邊都保留。
4. 編輯副本的動作，確認原板塊及原課表不變。
5. 用重複代碼／名稱嘗試複製，確認錯誤提示且沒有新增副本。
6. 取消操作，確認分類與板塊都不變；測試跨運動、跨年齡層的目的地。
7. 用學生或未登入身分呼叫 API，應回覆 403 或 401，不得寫入。

請先確認站台使用獨立測試資料庫；Preview 網址本身不代表資料已隔離。

## 自動檢查

在 `web` 資料夾執行：

```sh
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

測試替換資料庫連線，驗證真正的 API／服務程式，不寫入線上資料。桌面及手機表單另外以本機模擬回應驗證，不能代替測試資料庫的完整操作驗證。

## 失敗處理與限制

複製使用多筆資料庫請求；可捕捉的寫入失敗會清理本次建立的副本，原板塊不變。若清理也失敗，畫面會指出不完整副本的 ID，請先處理再重試。這不是單一資料庫交易：伺服器程序若在寫入途中被強制終止，可能留下不完整副本。多人同時建立相同代碼／名稱時，最終唯一性仍取決於現有資料庫約束；這次沒有變更其約束。
