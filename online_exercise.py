import secrets
import string

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from supabase import create_client


st.set_page_config(page_title="LAB33 Training System", layout="wide")


def get_supabase_client():
    return create_client(
        st.secrets["SUPABASE_URL"],
        st.secrets["SUPABASE_ANON_KEY"],
    )


def get_admin_client():
    service_role_key = st.secrets.get("SUPABASE_SERVICE_ROLE_KEY")
    if not service_role_key:
        return None
    return create_client(st.secrets["SUPABASE_URL"], service_role_key)


supabase = get_supabase_client()
admin_supabase = get_admin_client()

APP_URL = st.secrets.get("APP_URL", "http://localhost:8502")


def restore_auth_session():
    access_token = st.session_state.get("access_token")
    refresh_token = st.session_state.get("refresh_token")
    if access_token and refresh_token:
        try:
            supabase.auth.set_session(access_token, refresh_token)
        except Exception:
            clear_auth_session()


def clear_auth_session():
    for key in ("auth_user_id", "auth_email", "access_token", "refresh_token"):
        st.session_state.pop(key, None)


def get_query_param(name):
    value = st.query_params.get(name)
    if isinstance(value, list):
        return value[0] if value else None
    return value


def convert_recovery_hash_to_query_params():
    components.html(
        """
        <script>
        const parentUrl = new URL(window.parent.location.href);
        if (parentUrl.hash && parentUrl.hash.includes("access_token=")) {
          const hashParams = parentUrl.hash.substring(1);
          window.parent.location.replace(
            parentUrl.origin + parentUrl.pathname + "?" + hashParams
          );
        }
        </script>
        """,
        height=0,
    )


def password_recovery_page():
    convert_recovery_hash_to_query_params()

    access_token = get_query_param("access_token")
    refresh_token = get_query_param("refresh_token")
    recovery_type = get_query_param("type")

    if not access_token or recovery_type != "recovery":
        return False

    st.title("設定新密碼")
    st.caption("請輸入新的密碼，完成後再用新密碼登入。")

    with st.form("password_recovery_form"):
        new_password = st.text_input("新 Password", type="password")
        confirm_password = st.text_input("確認新 Password", type="password")
        submitted = st.form_submit_button("更新密碼", use_container_width=True)

    if submitted:
        if not new_password:
            st.warning("請輸入新 Password。")
        elif new_password != confirm_password:
            st.warning("兩次輸入的 Password 不一致。")
        else:
            try:
                supabase.auth.set_session(access_token, refresh_token)
                supabase.auth.update_user({"password": new_password})
                clear_auth_session()
                st.query_params.clear()
                st.success("密碼已更新，請回到學員端用新密碼登入。")
            except Exception as exc:
                st.error(f"更新密碼失敗：{exc}")

    return True


def login_page():
    st.title("LAB33 Training System")
    st.caption("學員登入後只能看到自己的課表")

    tab_login, tab_reset = st.tabs(["登入", "忘記密碼"])

    with tab_login:
        with st.form("login_form"):
            email = st.text_input("Email")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("登入", use_container_width=True)

        if submitted:
            try:
                result = supabase.auth.sign_in_with_password(
                    {"email": email, "password": password}
                )
                set_auth_session(result)
                st.rerun()
            except Exception as exc:
                st.error(f"登入失敗：{exc}")

    with tab_reset:
        st.info("如果忘記密碼，請聯絡教練幫你重設臨時密碼。")
        st.write("教練重設後，你可以用臨時密碼登入，系統會要求你立刻設定新密碼。")


def set_auth_session(result):
    st.session_state["auth_user_id"] = result.user.id
    st.session_state["auth_email"] = result.user.email
    st.session_state["access_token"] = result.session.access_token
    st.session_state["refresh_token"] = result.session.refresh_token


def athlete_email_exists(email):
    normalized_email = email.strip().lower()
    data = (
        supabase.table("athletes")
        .select("id")
        .ilike("email", normalized_email)
        .limit(1)
        .execute()
        .data
    )
    return bool(data)


def generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits
    body = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"LAB33-{body}"


def render_service_role_help():
    st.error("尚未設定 `SUPABASE_SERVICE_ROLE_KEY`，無法由教練建立或重設學員帳號。")
    st.info("請到 Supabase Project Settings → API 複製 service_role key，加入 `.streamlit/secrets.toml`。")
    st.code(
        """
SUPABASE_SERVICE_ROLE_KEY = "你的-service-role-key"
        """.strip(),
        language="toml",
    )


def render_auth_creation_error(error):
    st.error(f"新增學員失敗：{error}")

    if "database error creating new user" not in str(error).lower():
        return

    st.info("這通常是 Supabase Auth 建立帳號時，被舊的 auth.users trigger 卡住。若你已不使用 public.users，請到 Supabase SQL Editor 檢查並移除舊 trigger。")
    st.code(
        """
-- 1. 先查看 auth.users 上目前有哪些 trigger
select
  trigger_name,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users';

-- 2. 如果看到會寫入 public.users 的舊 trigger，刪掉它
-- 常見名稱是 on_auth_user_created，但請以第 1 步查到的名稱為準
drop trigger if exists on_auth_user_created on auth.users;

-- 3. 如果有舊 function 也可以一起移除
-- 常見名稱是 public.handle_new_user，但請先確認你已經不需要它
drop function if exists public.handle_new_user();
        """.strip(),
        language="sql",
    )


def create_auth_user_for_athlete(name, email, temp_password):
    if not admin_supabase:
        raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

    result = admin_supabase.auth.admin.create_user(
        {
            "email": email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": {"name": name},
        }
    )
    return result.user


def reset_athlete_temp_password(user_id, temp_password):
    if not admin_supabase:
        raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

    return admin_supabase.auth.admin.update_user_by_id(
        user_id,
        {"password": temp_password},
    )


def find_auth_user_by_email(email):
    if not admin_supabase or not email:
        return None

    normalized_email = email.strip().lower()
    for page in range(1, 11):
        users = admin_supabase.auth.admin.list_users(page=page, per_page=100)
        if not users:
            break
        for user in users:
            if (user.email or "").lower() == normalized_email:
                return user

    return None


def create_or_link_auth_user_for_athlete(name, email, temp_password):
    auth_user = find_auth_user_by_email(email)
    if auth_user:
        reset_athlete_temp_password(auth_user.id, temp_password)
        return auth_user, "Supabase Authentication 裡已有此 Email，已連結並重設臨時密碼。"

    try:
        auth_user = create_auth_user_for_athlete(name, email, temp_password)
        return auth_user, "已建立新的 Supabase Auth 帳號，並產生臨時密碼。"
    except Exception as exc:
        if "already" not in str(exc).lower() and "registered" not in str(exc).lower():
            raise

        auth_user = find_auth_user_by_email(email)
        if not auth_user:
            raise

        reset_athlete_temp_password(auth_user.id, temp_password)
        return auth_user, "Supabase Authentication 裡已有此 Email，已連結並重設臨時密碼。"


def create_or_reset_athlete_temp_password(athlete):
    if not admin_supabase:
        raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")

    temp_password = generate_temp_password()
    user_id = athlete.get("user_id")

    if has_value(user_id):
        try:
            reset_athlete_temp_password(user_id, temp_password)
            supabase.table("athletes").update(
                {"must_change_password": True}
            ).eq("id", athlete["id"]).execute()
            return temp_password, "已重設臨時密碼。"
        except Exception as exc:
            if "user not found" not in str(exc).lower():
                raise

    auth_user = find_auth_user_by_email(athlete.get("email"))
    if auth_user:
        reset_athlete_temp_password(auth_user.id, temp_password)
        message = "已連結既有 Auth 帳號，並重設臨時密碼。"
    else:
        auth_user = create_auth_user_for_athlete(
            athlete.get("name") or "",
            athlete.get("email"),
            temp_password,
        )
        message = "已建立 Auth 帳號，並產生臨時密碼。"

    supabase.table("athletes").update(
        {
            "user_id": auth_user.id,
            "must_change_password": True,
        }
    ).eq("id", athlete["id"]).execute()

    return temp_password, message


def has_value(value):
    return value is not None and not pd.isna(value) and value != ""


def delete_athlete(athlete_id, user_id=None):
    supabase.table("athlete_blocks").delete().eq("athlete_id", athlete_id).execute()
    supabase.table("athletes").delete().eq("id", athlete_id).execute()

    if has_value(user_id) and admin_supabase:
        try:
            admin_supabase.auth.admin.delete_user(str(user_id))
        except Exception as exc:
            message = str(exc).lower()
            if "user not found" in message:
                return "學員資料已刪除；Supabase Auth 帳號原本就不存在，所以已略過 Auth 刪除。"
            raise

    return "已刪除學員。"


def render_temp_password_card(password_key, email_key, close_key, extra_keys=None):
    if not st.session_state.get(password_key):
        return

    st.info("請把這組臨時密碼交給學員。此密碼只會顯示在這裡，學員登入後會被要求修改。")
    st.code(
        f"Email: {st.session_state[email_key]}\n"
        f"Temporary Password: {st.session_state[password_key]}"
    )
    if st.button("我已記下，關閉", key=close_key):
        st.session_state.pop(password_key, None)
        st.session_state.pop(email_key, None)
        for key in extra_keys or []:
            st.session_state.pop(key, None)
        st.rerun()


def logout_button():
    if st.sidebar.button("登出", use_container_width=True):
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
        clear_auth_session()
        st.rerun()


def fetch_athletes():
    try:
        data = (
            supabase.table("athletes")
            .select("*")
            .order("id", desc=True)
            .execute()
            .data
        )
        return pd.DataFrame(data or []), None
    except Exception as exc:
        return pd.DataFrame(), exc


def fetch_blocks():
    try:
        data = (
            supabase.table("blocks")
            .select("id,block_code,block_name,goal,sport,description")
            .order("id", desc=False)
            .execute()
            .data
        )
        return pd.DataFrame(data or []), None
    except Exception as exc:
        return pd.DataFrame(), exc


def fetch_athlete_blocks(athlete_id):
    try:
        data = (
            supabase.table("athlete_blocks")
            .select("id,athlete_id,block_id,week_num,day_num,notes,created_at")
            .eq("athlete_id", athlete_id)
            .order("id", desc=True)
            .execute()
            .data
        )
        return pd.DataFrame(data or []), None
    except Exception as exc:
        return pd.DataFrame(), exc


def create_athlete(name, email, sport, level, user_id=None, must_change_password=False):
    payload = {
        "name": name,
        "email": email,
        "sport": sport,
        "level": level,
        "must_change_password": must_change_password,
    }
    if user_id:
        payload["user_id"] = user_id

    return (
        supabase.table("athletes")
        .insert(payload)
        .execute()
    )


def create_block(block_code, block_name, goal, sport, description):
    return (
        supabase.table("blocks")
        .insert(
            {
                "block_code": block_code,
                "block_name": block_name,
                "goal": goal,
                "sport": sport,
                "description": description,
            }
        )
        .execute()
    )


def assign_block_to_athlete(athlete_id, block_id, week_num, day_num, notes):
    return (
        supabase.table("athlete_blocks")
        .insert(
            {
                "athlete_id": athlete_id,
                "block_id": block_id,
                "week_num": week_num,
                "day_num": day_num,
                "notes": notes,
            }
        )
        .execute()
    )


def render_block_setup_help(error):
    st.error(f"讀取或新增板塊失敗：{error}")
    st.info("請先到 Supabase SQL Editor 執行下面這段開發用 SQL。")
    st.code(
        """
create table if not exists public.blocks (
  id bigint generated by default as identity primary key,
  block_code text,
  block_name text,
  goal text,
  sport text,
  description text,
  created_at timestamp with time zone default now()
);

alter table public.blocks add column if not exists block_code text;
alter table public.blocks add column if not exists block_name text;
alter table public.blocks add column if not exists goal text;
alter table public.blocks add column if not exists sport text;
alter table public.blocks add column if not exists description text;

alter table public.blocks no force row level security;
alter table public.blocks disable row level security;

drop policy if exists "Development anon manage blocks" on public.blocks;
create policy "Development anon manage blocks"
on public.blocks
for all
to anon
using (true)
with check (true);

grant usage on schema public to anon;
grant select, insert, update, delete on table public.blocks to anon;
grant usage, select on all sequences in schema public to anon;

-- 跑完後用這段確認：
select
  relname,
  relrowsecurity,
  relforcerowsecurity
from pg_class
where relname = 'blocks';

select
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'blocks';
        """.strip(),
        language="sql",
    )


def render_setup_help(error):
    st.error(f"讀取或新增學員失敗：{error}")
    st.info("請先到 Supabase SQL Editor 執行下面這段開發用 SQL。")
    st.code(
        """
create table if not exists public.athletes (
  id bigint generated by default as identity primary key,
  user_id uuid,
  name text,
  email text,
  sport text,
  level text,
  must_change_password boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.athletes add column if not exists user_id uuid;
alter table public.athletes add column if not exists must_change_password boolean default false;

alter table public.athletes disable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on table public.athletes to anon;
grant usage, select on all sequences in schema public to anon;
        """.strip(),
        language="sql",
    )


def render_block_assignment_setup_help(error):
    st.error(f"讀取或加入板塊失敗：{error}")
    st.info("請先到 Supabase SQL Editor 執行下面這段開發用 SQL。")
    st.code(
        """
create table if not exists public.athlete_blocks (
  id bigint generated by default as identity primary key,
  athlete_id bigint references public.athletes(id) on delete cascade,
  block_id bigint,
  week_num integer,
  day_num integer,
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.athlete_blocks no force row level security;
alter table public.athlete_blocks disable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on table public.athlete_blocks to anon;
grant usage, select on all sequences in schema public to anon;

-- 跑完後可以用這段確認 RLS 是否真的關閉：
select
  relname,
  relrowsecurity,
  relforcerowsecurity
from pg_class
where relname = 'athlete_blocks';
        """.strip(),
        language="sql",
    )


def athlete_label(row):
    name = row.get("name") or f"學員 {row.get('id')}"
    sport = row.get("sport")
    return f"{name} - {sport}" if sport else name


def block_label(row):
    name = row.get("block_name") or f"Block {row.get('id')}"
    goal = row.get("goal")
    return f"{name} - {goal}" if goal else name


def coach_page():
    st.title("Coach")
    st.caption("新增學員、查看學員，並直接替每位學員加入訓練板塊")

    athletes_df, fetch_error = fetch_athletes()
    if fetch_error:
        render_setup_help(fetch_error)
        return

    selected_athlete_id = st.session_state.get("selected_athlete_id")
    if selected_athlete_id:
        render_selected_athlete_page(athletes_df, selected_athlete_id)
        return

    render_new_athlete_form()

    st.subheader("學員列表")
    if athletes_df.empty:
        st.info("目前尚未建立學員。")
    else:
        render_clickable_athlete_list(athletes_df)


def render_new_athlete_form():
    with st.container(border=True):
        st.subheader("新增學員")
        with st.form("new_athlete_form", clear_on_submit=True):
            col1, col2 = st.columns(2)
            name = col1.text_input("姓名")
            email = col2.text_input("Email")
            sport = col1.text_input("運動項目")
            level = col2.text_input("程度")
            submitted = st.form_submit_button("新增學員", use_container_width=True)

        if submitted:
            st.session_state.pop("last_temp_password", None)
            st.session_state.pop("last_temp_email", None)
            email = email.strip().lower()
            if not name or not email:
                st.warning("請先輸入學員姓名和 Email。")
            elif athlete_email_exists(email):
                st.error("這個 Email 已經存在，不能重複建立學員帳號。")
            elif not admin_supabase:
                render_service_role_help()
            else:
                try:
                    temp_password = generate_temp_password()
                    auth_user, auth_message = create_or_link_auth_user_for_athlete(
                        name,
                        email,
                        temp_password,
                    )
                    create_athlete(
                        name,
                        email,
                        sport,
                        level,
                        user_id=auth_user.id,
                        must_change_password=True,
                    )
                    st.session_state["last_temp_password"] = temp_password
                    st.session_state["last_temp_email"] = email
                    st.success(f"{auth_message} 已新增學員。")
                    st.rerun()
                except Exception as exc:
                    render_auth_creation_error(exc)

        render_temp_password_card(
            "last_temp_password",
            "last_temp_email",
            "close_last_temp_password",
        )


def render_clickable_athlete_list(athletes_df):
    header_cols = st.columns([1.7, 2, 1.1, 0.9, 0.9, 1.4, 0.9])
    header_cols[0].markdown("**姓名**")
    header_cols[1].markdown("**Email**")
    header_cols[2].markdown("**運動項目**")
    header_cols[3].markdown("**程度**")
    header_cols[4].markdown("**課表**")
    header_cols[5].markdown("**臨時密碼**")
    header_cols[6].markdown("**刪除**")

    for athlete in athletes_df.to_dict("records"):
        row_cols = st.columns([1.7, 2, 1.1, 0.9, 0.9, 1.4, 0.9])
        row_cols[0].write(athlete.get("name") or "-")
        row_cols[1].write(athlete.get("email") or "-")
        row_cols[2].write(athlete.get("sport") or "-")
        row_cols[3].write(athlete.get("level") or "-")
        if row_cols[4].button("查看", key=f"open_athlete_{athlete['id']}"):
            st.session_state["selected_athlete_id"] = athlete["id"]
            st.rerun()
        if row_cols[5].button("重設", key=f"reset_password_from_list_{athlete['id']}"):
            st.session_state["pending_reset_athlete_id"] = athlete["id"]
            st.rerun()
        if row_cols[6].button("刪除", key=f"ask_delete_athlete_{athlete['id']}"):
            st.session_state["pending_delete_athlete_id"] = athlete["id"]
            st.rerun()

        if st.session_state.get("pending_reset_athlete_id") == athlete["id"]:
            render_reset_password_confirmation(athlete)

        if st.session_state.get("pending_delete_athlete_id") == athlete["id"]:
            render_delete_athlete_confirmation(athlete)

        if st.session_state.get("last_reset_temp_athlete_id") == athlete["id"]:
            render_temp_password_card(
                "last_reset_temp_password",
                "last_reset_temp_email",
                f"close_last_reset_temp_password_{athlete['id']}",
                extra_keys=["last_reset_temp_athlete_id"],
            )


def reset_temp_password_from_list(athlete):
    if not admin_supabase:
        render_service_role_help()
        return

    try:
        temp_password, message = create_or_reset_athlete_temp_password(athlete)
        st.session_state["last_reset_temp_password"] = temp_password
        st.session_state["last_reset_temp_email"] = athlete.get("email")
        st.session_state["last_reset_temp_athlete_id"] = athlete["id"]
        st.success(message)
    except Exception as exc:
        st.error(f"重設失敗：{exc}")


def render_reset_password_confirmation(athlete):
    athlete_name = athlete.get("name") or athlete.get("email") or "這位學員"

    with st.container(border=True):
        st.warning(f"確認要重設 {athlete_name} 的臨時密碼嗎？重設後舊密碼會失效。")
        col1, col2 = st.columns(2)
        if col1.button("確認重設", key=f"confirm_reset_password_{athlete['id']}", use_container_width=True):
            st.session_state.pop("pending_reset_athlete_id", None)
            reset_temp_password_from_list(athlete)
        if col2.button("取消", key=f"cancel_reset_password_{athlete['id']}", use_container_width=True):
            st.session_state.pop("pending_reset_athlete_id", None)
            st.rerun()


def render_delete_athlete_confirmation(athlete):
    athlete_name = athlete.get("name") or athlete.get("email") or "這位學員"

    with st.container(border=True):
        st.warning(f"確認要刪除 {athlete_name} 嗎？刪除後會移除學員資料，並清掉已安排的課表板塊。")
        if has_value(athlete.get("user_id")) and not admin_supabase:
            st.info("目前沒有設定 service role key，所以只能刪除學員資料，無法同步刪除 Supabase Auth 帳號。")

        col1, col2 = st.columns(2)
        if col1.button("確認刪除", key=f"confirm_delete_athlete_{athlete['id']}", use_container_width=True):
            try:
                delete_message = delete_athlete(
                    athlete["id"],
                    athlete.get("user_id"),
                )
                if st.session_state.get("selected_athlete_id") == athlete["id"]:
                    st.session_state.pop("selected_athlete_id", None)
                st.session_state.pop("pending_delete_athlete_id", None)
                st.success(delete_message)
                st.rerun()
            except Exception as exc:
                st.error(f"刪除學員失敗：{exc}")
        if col2.button("取消", key=f"cancel_delete_athlete_{athlete['id']}", use_container_width=True):
            st.session_state.pop("pending_delete_athlete_id", None)
            st.rerun()


def render_selected_athlete_page(athletes_df, athlete_id):
    selected_rows = athletes_df[athletes_df["id"] == athlete_id]
    if selected_rows.empty:
        st.session_state.pop("selected_athlete_id", None)
        st.warning("找不到這位學員，已返回學員列表。")
        st.rerun()

    if st.button("返回學員列表"):
        st.session_state.pop("selected_athlete_id", None)
        st.rerun()

    st.divider()
    selected_athlete = selected_rows.iloc[0].to_dict()
    render_athlete_program_section(selected_athlete)


def blocks_page():
    st.title("板塊")
    st.caption("新增訓練板塊，並查看目前所有板塊")

    blocks_df, blocks_error = fetch_blocks()
    if blocks_error:
        render_block_setup_help(blocks_error)
        return

    with st.container(border=True):
        st.subheader("新增板塊")
        with st.form("new_block_form", clear_on_submit=True):
            col1, col2 = st.columns(2)
            block_code = col1.text_input("Block Code")
            block_name = col2.text_input("板塊名稱")
            goal = col1.text_input("目標")
            sport = col2.text_input("運動項目")
            description = st.text_area("描述")
            submitted = st.form_submit_button("新增板塊", use_container_width=True)

        if submitted:
            if not block_name:
                st.warning("請先輸入板塊名稱。")
            else:
                try:
                    create_block(block_code, block_name, goal, sport, description)
                    st.success("已新增板塊。")
                    st.rerun()
                except Exception as exc:
                    render_block_setup_help(exc)

    st.subheader("板塊列表")
    if blocks_df.empty:
        st.info("目前尚未建立板塊。")
    else:
        st.dataframe(blocks_df, use_container_width=True, hide_index=True)


def render_athlete_program_section(selected_athlete):
    st.subheader("學員課表板塊")

    with st.container(border=True):
        st.markdown(f"### {selected_athlete.get('name') or '未命名學員'}")
        col1, col2, col3 = st.columns(3)
        col1.write(f"Email：{selected_athlete.get('email') or '-'}")
        col2.write(f"運動項目：{selected_athlete.get('sport') or '-'}")
        col3.write(f"程度：{selected_athlete.get('level') or '-'}")

    blocks_df, blocks_error = fetch_blocks()
    if blocks_error:
        st.error(f"讀取 blocks 失敗：{blocks_error}")
        st.info("請先確認 Supabase 已有 `blocks` 資料表，且 anon key 可以讀取。")
        return

    athlete_blocks_df, athlete_blocks_error = fetch_athlete_blocks(selected_athlete["id"])
    if athlete_blocks_error:
        render_block_assignment_setup_help(athlete_blocks_error)
        return

    with st.container(border=True):
        st.subheader("加入板塊")
        if blocks_df.empty:
            st.info("目前沒有任何 block。請先在 Supabase 的 `blocks` 表新增板塊。")
            return

        block_options = blocks_df.to_dict("records")
        with st.form("assign_block_form", clear_on_submit=True):
            selected_block = st.selectbox(
                "選擇板塊",
                block_options,
                format_func=block_label,
            )
            col1, col2 = st.columns(2)
            week_num = col1.number_input("Week", min_value=1, value=1)
            day_num = col2.number_input("Day", min_value=1, value=1)
            notes = st.text_area("備註")
            submitted = st.form_submit_button("加入到這位學員課表", use_container_width=True)

        if submitted:
            try:
                assign_block_to_athlete(
                    selected_athlete["id"],
                    selected_block["id"],
                    week_num,
                    day_num,
                    notes,
                )
                st.success("已將板塊加入這位學員的課表。")
                st.rerun()
            except Exception as exc:
                render_block_assignment_setup_help(exc)

    st.subheader("這位學員已加入的板塊")
    if athlete_blocks_df.empty:
        st.info("這位學員目前還沒有加入任何板塊。")
    else:
        render_schedule_table(athlete_blocks_df, blocks_df)


def render_schedule_table(athlete_blocks_df, blocks_df):
    display_df = athlete_blocks_df.copy()
    block_names = {
        row["id"]: block_label(row)
        for row in blocks_df.to_dict("records")
    }
    display_df["block"] = display_df["block_id"].map(block_names).fillna(
        display_df["block_id"].astype(str)
    )
    display_df = display_df.sort_values(["week_num", "day_num", "id"])
    visible_columns = ["block", "week_num", "day_num", "notes", "created_at"]
    st.dataframe(display_df[visible_columns], use_container_width=True, hide_index=True)


def find_logged_in_athlete(athletes_df):
    user_id = st.session_state.get("auth_user_id")
    email = st.session_state.get("auth_email")

    if "user_id" in athletes_df.columns and user_id:
        user_rows = athletes_df[athletes_df["user_id"] == user_id]
        if not user_rows.empty:
            return user_rows.iloc[0].to_dict()

    if "email" in athletes_df.columns and email:
        email_rows = athletes_df[
            athletes_df["email"].fillna("").str.lower() == email.lower()
        ]
        if not email_rows.empty:
            return email_rows.iloc[0].to_dict()

    return None


def student_page():
    restore_auth_session()
    if "auth_user_id" not in st.session_state:
        login_page()
        return

    st.title("我的課表")
    st.caption("查看自己目前被安排的訓練板塊")
    st.sidebar.caption(st.session_state.get("auth_email", ""))
    logout_button()

    athletes_df, athletes_error = fetch_athletes()
    if athletes_error:
        render_setup_help(athletes_error)
        return

    if athletes_df.empty:
        render_change_password_section()
        st.info("目前尚未建立學員。")
        return

    selected_athlete = find_logged_in_athlete(athletes_df)
    if not selected_athlete:
        render_change_password_section()
        st.warning("找不到和這個登入帳號對應的學員資料。")
        st.info("請確認教練新增學員時填寫的 Email 和你的登入 Email 相同。")
        return

    must_change_password = selected_athlete.get("must_change_password") is True
    if must_change_password:
        force_change_password_page(selected_athlete)
        return

    render_change_password_section()

    with st.container(border=True):
        st.markdown(f"### {selected_athlete.get('name') or '未命名學員'}")
        col1, col2, col3 = st.columns(3)
        col1.write(f"Email：{selected_athlete.get('email') or '-'}")
        col2.write(f"運動項目：{selected_athlete.get('sport') or '-'}")
        col3.write(f"程度：{selected_athlete.get('level') or '-'}")

    blocks_df, blocks_error = fetch_blocks()
    if blocks_error:
        render_block_setup_help(blocks_error)
        return

    athlete_blocks_df, athlete_blocks_error = fetch_athlete_blocks(selected_athlete["id"])
    if athlete_blocks_error:
        render_block_assignment_setup_help(athlete_blocks_error)
        return

    st.subheader("課表板塊")
    if athlete_blocks_df.empty:
        st.info("目前還沒有被安排任何板塊。")
    else:
        render_schedule_table(athlete_blocks_df, blocks_df)


def update_current_user_password(new_password):
    supabase.auth.update_user({"password": new_password})


def force_change_password_page(selected_athlete):
    st.title("請設定新密碼")
    st.caption("你目前使用的是臨時密碼。設定新密碼後才能查看課表。")

    with st.form("force_change_password_form"):
        new_password = st.text_input("新 Password", type="password")
        confirm_password = st.text_input("確認新 Password", type="password")
        submitted = st.form_submit_button("更新密碼", use_container_width=True)

    if submitted:
        if not new_password:
            st.warning("請輸入新 Password。")
        elif len(new_password) < 6:
            st.warning("Password 至少需要 6 碼。")
        elif new_password != confirm_password:
            st.warning("兩次輸入的 Password 不一致。")
        else:
            try:
                update_current_user_password(new_password)
                supabase.table("athletes").update(
                    {"must_change_password": False}
                ).eq("id", selected_athlete["id"]).execute()
                st.success("密碼已更新。")
                st.rerun()
            except Exception as exc:
                st.error(f"更新密碼失敗：{exc}")


def render_change_password_section():
    with st.expander("修改密碼"):
        st.write("如果你想更換登入密碼，可以在這裡更新。")
        with st.form("change_password_form"):
            new_password = st.text_input("新 Password", type="password")
            confirm_password = st.text_input("確認新 Password", type="password")
            submitted = st.form_submit_button("更新密碼", use_container_width=True)

        if submitted:
            if not new_password:
                st.warning("請輸入新 Password。")
            elif len(new_password) < 6:
                st.warning("Password 至少需要 6 碼。")
            elif new_password != confirm_password:
                st.warning("兩次輸入的 Password 不一致。")
            else:
                try:
                    update_current_user_password(new_password)
                    st.success("密碼已更新。下次請使用新密碼登入。")
                except Exception as exc:
                    st.error(f"更新密碼失敗：{exc}")


def main():
    if password_recovery_page():
        return

    mode = st.sidebar.radio("介面", ["教練端", "學員端"])

    if mode == "學員端":
        student_page()
        return

    page = st.sidebar.radio("教練功能", ["學員", "板塊"])
    if page == "學員":
        coach_page()
    else:
        blocks_page()


main()
