
## 實作流程

開始修改前：

1. 確認目前分支不是 `pilot`。
2. 若目前位於 `pilot`，停止修改並提醒使用者建立功能分支。
3. 重新閱讀本 `AGENTS.md`。
4. 檢查 `git status`。
5. 保留使用者所有尚未提交的修改，不得覆蓋或刪除。

實作原則：

- 只修改已確認計畫中相關的檔案。
- 優先沿用現有專案架構、元件、服務與 UI 模式。
- 不進行與需求無關的重構。
- 不修改其他已正常運作的頁面。
- 不得以隱藏按鈕或前端限制取代 server-side authorization。
- 不得信任瀏覽器傳入的 user ID、coach ID、student ID 或 role。
- 所有重要權限都必須由伺服器再次確認。
- 不得將 service role key 或其他 server-only secret 放入 client bundle。
- 若需修改資料庫，必須建立新的 migration；不得覆寫既有 migration。
- 不得執行破壞性 SQL。
- 保留既有 UI 視覺風格，並兼顧手機版與桌面版。
- 必須提供 loading、empty、success 與 error 狀態。
- 必須防止表單重複送出。

實作完成後：

1. 執行 repository 中適用的 lint、typecheck、tests 與 build。
2. 若任一必要檢查失敗，不得宣稱功能已完成。
3. 回報以下內容：
   - 完成功能摘要
   - 修改檔案
   - 資料庫與 RLS 修改
   - 權限保護方式
   - 執行的檢查與完整結果
   - 尚未自動驗證的內容
   - 手動測試步驟
   - 已知風險
   - git diff 摘要

## 強制 UI 設計流程

每次建立、修改、審查或稽核網站／App UI 時：

1. 先使用 `web-design-guidelines`，並指定相關 UI 檔案。
   - 每次審查前都必須取得最新的 guidelines。
   - 在 UI 工作完成前，處理所有適用的檢查結果。

2. 再使用 `emil-design-eng`。
   - 套用其視覺細節、互動狀態、動態效果、效能與減少動態效果無障礙原則。
   - 審查 UI 程式碼時，必須使用 `Before | After | Why` 的 Markdown 表格提出建議。

UI 相關任務不得略過任一 skill。

非 UI 任務除非使用者明確要求，否則不使用這兩個 skill。
