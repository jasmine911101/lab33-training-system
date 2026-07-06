# Security Audit Report

Project audited: `~/Desktop/lab33-training-system`

Files reviewed:
- [online_exercise.py](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py)
- [schema.sql](/Users/jasmine/Desktop/lab33-training-system/schema.sql)
- [dev_permissions.sql](/Users/jasmine/Desktop/lab33-training-system/dev_permissions.sql)
- [requirements.txt](/Users/jasmine/Desktop/lab33-training-system/requirements.txt)

Scope:
- Authentication
- Authorization
- Streamlit secrets
- Supabase service role key usage
- Row Level Security (RLS)
- SQL Injection
- File upload vulnerabilities
- Session state / session management

## Findings

### 1. Critical
- Severity: Critical
- Affected files: [online_exercise.py:28](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:28), [online_exercise.py:169](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:169), [online_exercise.py:555](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:555), [online_exercise.py:613](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:613), [online_exercise.py:1239](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:1239)
- Explanation: `write_client()` returns `admin_supabase` whenever the service-role key is present. That admin client is then used for normal reads and writes across the app, including athlete listing, assignment reads, and exercise snapshot writes. A Supabase service-role client bypasses RLS entirely, so the app's database protections are effectively disabled at the application layer whenever `SUPABASE_SERVICE_ROLE_KEY` is configured.
- Recommended fix: Never use the service-role client for routine app data access. Keep one user-scoped client for all page reads and normal writes, and isolate service-role usage to narrowly scoped server-only operations such as `auth.admin.create_user` and password resets.

### 2. Critical
- Severity: Critical
- Affected files: [online_exercise.py:1547](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:1547), [online_exercise.py:3961](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3961), [online_exercise.py:3967](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3967)
- Explanation: The coach interface is not protected by authentication or role checks. A visitor can switch the sidebar radio to `教練端` and immediately access coach functionality. Because coach pages call database helpers that prefer the service-role client, this becomes a full administrative authorization bypass rather than just a missing UI guard.
- Recommended fix: Require login before entering the coach area and verify the current user's role server-side before rendering or performing any coach action. Do not rely on a UI radio button to separate privileged and unprivileged modes.

### 3. Critical
- Severity: Critical
- Affected files: [schema.sql:308](/Users/jasmine/Desktop/lab33-training-system/schema.sql:308), [schema.sql:316](/Users/jasmine/Desktop/lab33-training-system/schema.sql:316), [schema.sql:324](/Users/jasmine/Desktop/lab33-training-system/schema.sql:324), [schema.sql:332](/Users/jasmine/Desktop/lab33-training-system/schema.sql:332), [schema.sql:340](/Users/jasmine/Desktop/lab33-training-system/schema.sql:340), [schema.sql:348](/Users/jasmine/Desktop/lab33-training-system/schema.sql:348)
- Explanation: `schema.sql` contains active development policies that grant `anon` full `select`, `insert`, `update`, and `delete` access to core tables with `using (true)` and `with check (true)`. If this schema is applied as-is, any holder of the public anon key can read and modify training data without authentication.
- Recommended fix: Remove all development anon policies and anon DML grants from the production schema. Keep a separate local-only seed or migration file for temporary development access and never apply it to shared or production environments.

### 4. Critical
- Severity: Critical
- Affected files: [dev_permissions.sql:1](/Users/jasmine/Desktop/lab33-training-system/dev_permissions.sql:1)
- Explanation: `dev_permissions.sql` disables RLS on multiple tables and grants the `anon` role full CRUD access. This is effectively a database backdoor. Even if intended only for development, it is stored next to the main app, easy to run accidentally, and severe if ever applied to the real project database.
- Recommended fix: Delete this file from the main project or move it to a clearly isolated local-only setup area with explicit warnings. Prefer local emulators or temporary authenticated test accounts instead of disabling RLS and opening tables to `anon`.

### 5. Critical
- Severity: Critical
- Affected files: [secrets.toml](/Users/jasmine/Desktop/lab33-training-system/.streamlit/secrets.toml), [.gitignore:1](/Users/jasmine/Desktop/lab33-training-system/.gitignore:1)
- Explanation: `.streamlit/secrets.toml` contains a live Supabase URL, anon key, and service-role key in the project folder. The `.gitignore` pattern helps prevent future commits, but the secret file currently exists in the working tree and may already have been exposed through backups, file sharing, screenshots, zip exports, or earlier commits. Exposure of a service-role key is especially severe because it allows unrestricted database and admin API access.
- Recommended fix: Rotate the Supabase service-role key immediately, rotate the anon key if exposure scope is uncertain, remove the local secret file from any shared artifacts, and reissue secrets through Streamlit Cloud or another secret manager. Check Git history and deployment logs for prior leakage.

### 6. High
- Severity: High
- Affected files: [online_exercise.py:201](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:201), [online_exercise.py:221](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:221), [online_exercise.py:246](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:246)
- Explanation: The password recovery flow moves Supabase recovery tokens from the URL hash into normal query parameters. Query parameters are more likely to be retained in browser history, server logs, analytics, screenshots, and copied links. This increases exposure of one-time recovery credentials and session material.
- Recommended fix: Keep recovery tokens in the fragment when possible, or exchange them immediately without rewriting them into the query string. If query parameters must be used, clear them before rendering any further content and avoid any logging or telemetry that captures URLs.

### 7. High
- Severity: High
- Affected files: [online_exercise.py:3807](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3807), [online_exercise.py:3849](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3849)
- Explanation: Student identity resolution falls back to matching by email and, in ambiguous cases, picks the first athlete record that has blocks. This is an authorization flaw. If athlete records are mis-linked, duplicated, or maliciously created with the same email, a logged-in user could be mapped to the wrong athlete record and view another student's schedule.
- Recommended fix: Bind every athlete record to a unique `user_id` from `auth.users` and require that mapping for access. Remove email-based fallback for authorization decisions and enforce uniqueness constraints on athlete email and `user_id`.

### 8. Medium
- Severity: Medium
- Affected files: [online_exercise.py:1059](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:1059), [online_exercise.py:1829](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:1829), [requirements.txt:4](/Users/jasmine/Desktop/lab33-training-system/requirements.txt:4)
- Explanation: The app accepts uploaded Excel workbooks and parses them directly with `openpyxl` without checking file size, sheet count, content type, or expected workbook structure before loading. This can enable denial-of-service conditions through oversized or malformed files and makes the parser trust unvalidated user-controlled content.
- Recommended fix: Enforce upload size limits, validate MIME type and extension, reject unexpected workbook structures early, and wrap parsing with defensive error handling and resource limits. If possible, scan or normalize files before processing.

### 9. Medium
- Severity: Medium
- Affected files: [online_exercise.py:173](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:173), [online_exercise.py:281](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:281), [online_exercise.py:3838](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3838)
- Explanation: Access and refresh tokens are copied into Streamlit session state and later restored manually. This is not automatically unsafe, but it increases the app's responsibility for session handling and can cause confusing or stale session behavior if tokens expire, are replayed, or persist longer than intended in a reused browser session.
- Recommended fix: Minimize custom token handling. Prefer the framework or provider's standard session mechanisms, explicitly validate session freshness, and clear session state on any auth error or privilege boundary change.

### 10. Low
- Severity: Low
- Affected files: [online_exercise.py:231](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:231), [online_exercise.py:3908](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3908), [online_exercise.py:3935](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py:3935)
- Explanation: Password updates only enforce presence, equality, and a length of 6 characters. That is weak for an internet-facing authentication system and allows easily guessed passwords, especially for accounts that already start from coach-issued temporary credentials.
- Recommended fix: Raise the minimum password standard and use Supabase password policies if available. At a minimum, require a longer password and consider stronger composition or passphrase guidance.

## SQL Injection Review

### 11. No direct SQL injection sink found in app code
- Severity: Informational
- Affected files: [online_exercise.py](/Users/jasmine/Desktop/lab33-training-system/online_exercise.py), [schema.sql](/Users/jasmine/Desktop/lab33-training-system/schema.sql)
- Explanation: I did not find raw SQL string construction or direct database-driver execution in `online_exercise.py`. The app uses the Supabase query builder methods such as `.select()`, `.insert()`, `.update()`, and `.eq()`, which reduces classic SQL injection risk in the application layer.
- Recommended fix: Keep using parameterized/query-builder APIs. If raw SQL or RPC functions are added later, review them separately for injection risk.

## Summary

The highest-risk issues are not isolated bugs; they are systemic trust-boundary failures:
- The coach area is effectively unauthenticated.
- The service-role key is present locally and is used for normal app queries.
- RLS is bypassed both in the application layer and in the SQL policy files.

Even if only one of those issues existed, the app would be high risk. Together, they currently allow unauthorized access paths that can expose or modify athlete data.
