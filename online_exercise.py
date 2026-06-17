import secrets
import string

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from openpyxl import load_workbook
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

TRAINING_CATEGORIES = [
    "肌力/爆發訓練",
    "速度與敏捷",
    "有氧/無氧訓練",
    "專項訓練",
    "恢復/其他訓練",
]

BLOCK_SECTION_NAMES = [
    "自我筋膜滾動",
    "自我筋膜鬆動",
    "活動度",
    "活化",
    "動態熱身",
    "增強/彈震式訓練",
    "重量訓練",
    "輔助訓練",
    "恢復訓練",
]

MANUAL_BLOCK_SECTION_NAMES = [
    "自我筋膜滾動",
    "活動度",
    "活化",
    "動態熱身",
    "增強/彈震式訓練",
    "重量訓練",
    "輔助訓練",
    "恢復訓練",
]

MANUAL_TEMPLATE_COLUMNS = [
    "exercise_name",
    "sets",
    "reps_or_time",
    "equipment",
    "intensity",
    "weight",
    "rest",
    "video_url",
]

ATHLETE_BLOCK_EXERCISE_COLUMNS = [
    "exercise_name",
    "sets",
    "reps_or_time",
    "equipment",
    "intensity",
    "weight",
    "rest",
    "video_url",
    "notes",
]


def write_client():
    return admin_supabase or supabase


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


def delete_block(block_id):
    block_id = to_plain_int(block_id)
    supabase.table("athlete_blocks").delete().eq("block_id", block_id).execute()
    supabase.table("block_exercises").delete().eq("block_id", block_id).execute()
    supabase.table("block_sections").delete().eq("block_id", block_id).execute()
    supabase.table("blocks").delete().eq("id", block_id).execute()
    return "已刪除板塊，並移除相關的學員課表與詳細內容。"


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
            .select("id,block_code,block_name,goal,training_element,description")
            .order("id", desc=False)
            .execute()
            .data
        )
        return pd.DataFrame(data or []), None
    except Exception as exc:
        return pd.DataFrame(), exc


def fetch_block_sections(block_id):
    try:
        data = (
            supabase.table("block_sections")
            .select("id,block_id,section_name,order_num")
            .eq("block_id", block_id)
            .order("order_num", desc=False)
            .execute()
            .data
        )
        return pd.DataFrame(data or []), None
    except Exception as exc:
        return pd.DataFrame(), exc


def fetch_block_exercises(block_id):
    try:
        data = (
            supabase.table("block_exercises")
            .select("id,block_id,section_id,exercise_name,sets,reps_or_time,equipment,intensity,weight,rest,video_url,order_num,notes")
            .eq("block_id", block_id)
            .order("order_num", desc=False)
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
            .select("id,athlete_id,block_id,week_num,day_num,training_category,notes,created_at")
            .eq("athlete_id", athlete_id)
            .order("id", desc=True)
            .execute()
            .data
        )
        return pd.DataFrame(data or []), None
    except Exception as exc:
        return pd.DataFrame(), exc


def fetch_athlete_block_exercises(athlete_block_id):
    try:
        data = (
            write_client().table("athlete_block_exercises")
            .select("id,athlete_block_id,section_name,section_order,exercise_name,sets,reps_or_time,equipment,intensity,weight,rest,video_url,notes,order_num")
            .eq("athlete_block_id", athlete_block_id)
            .order("section_order", desc=False)
            .order("order_num", desc=False)
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


def create_block(block_code, block_name, goal, training_element, description):
    return (
        supabase.table("blocks")
        .insert(
            {
                "block_code": block_code,
                "block_name": block_name,
                "goal": goal,
                "training_element": training_element,
                "description": description,
            }
        )
        .execute()
    )


def cell_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def merged_cell_value(sheet, row_index, column_index):
    cell = sheet.cell(row=row_index, column=column_index)
    if cell.value is not None:
        return cell_text(cell.value)

    for merged_range in sheet.merged_cells.ranges:
        if cell.coordinate in merged_range:
            return cell_text(
                sheet.cell(
                    row=merged_range.min_row,
                    column=merged_range.min_col,
                ).value
            )

    return ""


def sheet_row_values(sheet, row_index):
    return [
        merged_cell_value(sheet, row_index, column_index)
        for column_index in range(1, sheet.max_column + 1)
    ]


def normalize_section_name(value):
    if not value:
        return ""
    if "自我筋膜" in value:
        return "自我筋膜滾動"
    if "增強" in value or "彈震" in value:
        return "增強/彈震式訓練"
    matched_section = next(
        (section for section in BLOCK_SECTION_NAMES if section == value),
        "",
    )
    return matched_section


def normalize_header_name(value):
    header = cell_text(value).replace(" ", "")
    header_aliases = {
        "動作": "exercise_name",
        "組數": "sets",
        "次數/時間": "reps_or_time",
        "次數／時間": "reps_or_time",
        "工具": "equipment",
        "強度": "intensity",
        "重量": "weight",
        "休息時間": "rest",
        "休息": "rest",
        "影片連結": "video_url",
        "影片": "video_url",
    }
    return header_aliases.get(header, "")


def value_by_header(values, headers, header_key):
    index = headers.get(header_key)
    if index is None or index >= len(values):
        return ""
    return values[index]


def looks_like_block_title(value, sheet_name):
    if not value:
        return False

    excluded_fragments = [
        "LAB33",
        "Sport Performance",
        "週期目標",
        "訓練元素",
        "強調於",
        "核心目標",
        "透過",
        "過程中",
    ]
    if any(fragment in value for fragment in excluded_fragments):
        return False

    if len(value) > 20:
        return False

    return "訓練" in value or value.replace(" ", "") in sheet_name.replace(" ", "")


def extract_block_title(sheet, fallback_name):
    preferred_values = []
    for row_index in range(1, min(3, sheet.max_row) + 1):
        for value in sheet_row_values(sheet, row_index):
            if looks_like_block_title(value, sheet.title):
                preferred_values.append(value)

    if preferred_values:
        return max(preferred_values, key=len)

    top_values = [
        value
        for row_index in range(1, min(5, sheet.max_row) + 1)
        for value in sheet_row_values(sheet, row_index)
        if looks_like_block_title(value, sheet.title)
    ]
    return max(top_values, key=len) if top_values else fallback_name


def to_plain_int(value):
    if value is None or value == "":
        return None
    return int(value)


def clean_manual_cell(value):
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def normalize_unique_value(value):
    return clean_manual_cell(value).casefold()


def duplicate_values(values):
    seen = set()
    duplicates = []
    for value in values:
        normalized = normalize_unique_value(value)
        if not normalized:
            continue
        if normalized in seen and value not in duplicates:
            duplicates.append(value)
        seen.add(normalized)
    return duplicates


def validate_new_block_identity(blocks_to_create, existing_blocks_df):
    errors = []
    block_codes = [block.get("block_code") for block in blocks_to_create]
    block_names = [block.get("block_name") for block in blocks_to_create]

    duplicated_codes = duplicate_values(block_codes)
    duplicated_names = duplicate_values(block_names)
    if duplicated_codes:
        errors.append(f"這次匯入/建立中有重複的 Block Code：{', '.join(duplicated_codes)}")
    if duplicated_names:
        errors.append(f"這次匯入/建立中有重複的顯示名稱：{', '.join(duplicated_names)}")

    if existing_blocks_df is not None and not existing_blocks_df.empty:
        existing_codes = {
            normalize_unique_value(value)
            for value in existing_blocks_df.get("block_code", pd.Series(dtype=str)).tolist()
            if normalize_unique_value(value)
        }
        existing_names = {
            normalize_unique_value(value)
            for value in existing_blocks_df.get("block_name", pd.Series(dtype=str)).tolist()
            if normalize_unique_value(value)
        }

        conflicted_codes = [
            code for code in block_codes
            if normalize_unique_value(code) in existing_codes
        ]
        conflicted_names = [
            name for name in block_names
            if normalize_unique_value(name) in existing_names
        ]
        if conflicted_codes:
            errors.append(f"資料庫已存在相同 Block Code：{', '.join(conflicted_codes)}")
        if conflicted_names:
            errors.append(f"資料庫已存在相同顯示名稱：{', '.join(conflicted_names)}")

    return errors


def render_block_identity_errors(errors):
    for error in errors:
        st.error(error)


def empty_manual_template_rows(row_count=4):
    return pd.DataFrame(
        [
            {column: "" for column in MANUAL_TEMPLATE_COLUMNS}
            for _ in range(row_count)
        ]
    )


def manual_template_version():
    if "manual_template_version" not in st.session_state:
        st.session_state["manual_template_version"] = 0
    return st.session_state["manual_template_version"]


def reset_manual_template():
    st.session_state["manual_template_version"] = manual_template_version() + 1


def build_manual_template_block(block_name, goal, training_element, section_tables):
    sections = []

    for section_name in MANUAL_BLOCK_SECTION_NAMES:
        section_df = section_tables.get(section_name)
        if section_df is None:
            continue

        exercises = []
        for _, row in section_df.iterrows():
            exercise_name = clean_manual_cell(row.get("exercise_name"))
            if not exercise_name:
                continue

            exercises.append(
                {
                    "exercise_name": exercise_name,
                    "sets": clean_manual_cell(row.get("sets")),
                    "reps_or_time": clean_manual_cell(row.get("reps_or_time")),
                    "equipment": clean_manual_cell(row.get("equipment")),
                    "intensity": clean_manual_cell(row.get("intensity")),
                    "weight": clean_manual_cell(row.get("weight")),
                    "rest": clean_manual_cell(row.get("rest")),
                    "video_url": clean_manual_cell(row.get("video_url")),
                    "order_num": len(exercises) + 1,
                }
            )

        if exercises:
            sections.append(
                {
                    "section_name": section_name,
                    "exercises": exercises,
                }
            )

    return {
        "sheet_name": block_name,
        "block_name": block_name,
        "goal": goal,
        "training_element": training_element,
        "sections": sections,
    }


def parse_block_sheet(sheet, fallback_name):
    block_name = extract_block_title(sheet, fallback_name)

    goal = ""
    training_element = ""
    for row_index in range(1, min(5, sheet.max_row) + 1):
        values = sheet_row_values(sheet, row_index)
        for index, value in enumerate(values):
            if value == "週期目標":
                goal = next((item for item in values[index + 1:] if item), "")
            if value == "訓練元素":
                training_element = next((item for item in values[index + 1:] if item), "")

    sections = []
    current_section = None
    current_headers = {}
    last_headers = {}
    order_by_section = {}

    for row_index in range(4, sheet.max_row + 1):
        values = sheet_row_values(sheet, row_index)
        non_empty = [value for value in values if value]

        matched_section = next(
            (
                normalize_section_name(value)
                for value in non_empty
                if normalize_section_name(value)
            ),
            None,
        )
        if matched_section:
            current_section = {
                "section_name": matched_section,
                "exercises": [],
            }
            sections.append(current_section)
            current_headers = last_headers.copy()
            order_by_section[matched_section] = 0
            continue

        if "動作" in non_empty:
            current_headers = {}
            for index, value in enumerate(values):
                header_name = normalize_header_name(value)
                if header_name and header_name not in current_headers:
                    current_headers[header_name] = index
            last_headers = current_headers.copy()
            continue

        if not current_section or not current_headers:
            continue

        exercise_index = current_headers.get("exercise_name")
        if exercise_index is None or exercise_index >= len(values):
            continue

        exercise_name = values[exercise_index]
        if not exercise_name:
            continue

        order_by_section[current_section["section_name"]] += 1
        current_section["exercises"].append(
            {
                "exercise_name": exercise_name,
                "sets": value_by_header(values, current_headers, "sets"),
                "reps_or_time": value_by_header(values, current_headers, "reps_or_time"),
                "equipment": value_by_header(values, current_headers, "equipment"),
                "intensity": value_by_header(values, current_headers, "intensity"),
                "weight": value_by_header(values, current_headers, "weight"),
                "rest": value_by_header(values, current_headers, "rest"),
                "video_url": value_by_header(values, current_headers, "video_url"),
                "order_num": order_by_section[current_section["section_name"]],
            }
        )

    return {
        "sheet_name": sheet.title,
        "block_name": block_name,
        "goal": goal,
        "training_element": training_element,
        "sections": sections,
    }


def parse_block_excel(uploaded_file):
    workbook = load_workbook(uploaded_file, data_only=True)
    return parse_block_sheet(workbook.active, uploaded_file.name.rsplit(".", 1)[0])


def parse_block_workbook(uploaded_file):
    workbook = load_workbook(uploaded_file, data_only=True)
    parsed_blocks = []

    for sheet in workbook.worksheets:
        parsed_block = parse_block_sheet(sheet, sheet.title)
        exercise_count = sum(len(section["exercises"]) for section in parsed_block["sections"])
        if parsed_block["sections"] or exercise_count:
            parsed_blocks.append(parsed_block)

    return parsed_blocks


def create_block_from_excel(parsed_block, block_code, description):
    block_name = parsed_block.get("block_name") or parsed_block.get("sheet_name") or block_code
    block_response = (
        supabase.table("blocks")
        .insert(
            {
                "block_code": block_code,
                "block_name": block_name,
                "goal": parsed_block.get("goal") or "",
                "training_element": parsed_block.get("training_element") or "",
                "description": description,
            }
        )
        .execute()
    )
    block_id = block_response.data[0]["id"]

    for section_order, section in enumerate(parsed_block["sections"], start=1):
        section_response = (
            supabase.table("block_sections")
            .insert(
                {
                    "block_id": block_id,
                    "section_name": section["section_name"],
                    "order_num": section_order,
                }
            )
            .execute()
        )
        section_id = section_response.data[0]["id"]

        for exercise in section["exercises"]:
            supabase.table("block_exercises").insert(
                {
                    "block_id": block_id,
                    "section_id": section_id,
                    **exercise,
                }
            ).execute()

    return block_id


def assign_block_to_athlete(athlete_id, block_id, week_num, day_num, training_category, notes):
    response = (
        supabase.table("athlete_blocks")
        .insert(
            {
                "athlete_id": to_plain_int(athlete_id),
                "block_id": to_plain_int(block_id),
                "week_num": to_plain_int(week_num),
                "day_num": to_plain_int(day_num),
                "training_category": training_category,
                "notes": notes,
            }
        )
        .execute()
    )
    assignment_id = response.data[0]["id"]
    create_assignment_exercise_snapshot(assignment_id, block_id)
    return response


def update_athlete_block_assignment(assignment_id, block_id, week_num, day_num, training_category, notes):
    return (
        supabase.table("athlete_blocks")
        .update(
            {
                "block_id": to_plain_int(block_id),
                "week_num": to_plain_int(week_num),
                "day_num": to_plain_int(day_num),
                "training_category": training_category,
                "notes": notes,
            }
        )
        .eq("id", to_plain_int(assignment_id))
        .execute()
    )


def delete_athlete_block_assignment(assignment_id):
    write_client().table("athlete_block_exercises").delete().eq(
        "athlete_block_id",
        to_plain_int(assignment_id),
    ).execute()
    return (
        supabase.table("athlete_blocks")
        .delete()
        .eq("id", to_plain_int(assignment_id))
        .execute()
    )


def template_exercise_rows_for_block(block_id):
    sections_df, sections_error = fetch_block_sections(block_id)
    exercises_df, exercises_error = fetch_block_exercises(block_id)
    if sections_error or exercises_error:
        raise sections_error or exercises_error

    rows = []
    if sections_df.empty:
        return rows

    for section_order, section in enumerate(sections_df.to_dict("records"), start=1):
        if exercises_df.empty or "section_id" not in exercises_df.columns:
            continue
        section_exercises = exercises_df[
            exercises_df["section_id"] == section["id"]
        ].copy()
        if section_exercises.empty:
            continue
        section_exercises = section_exercises.sort_values("order_num")

        for order_num, exercise in enumerate(section_exercises.to_dict("records"), start=1):
            rows.append(
                {
                    "section_name": section.get("section_name") or "未命名區段",
                    "section_order": section.get("order_num") or section_order,
                    "exercise_name": exercise.get("exercise_name") or "",
                    "sets": exercise.get("sets") or "",
                    "reps_or_time": exercise.get("reps_or_time") or "",
                    "equipment": exercise.get("equipment") or "",
                    "intensity": exercise.get("intensity") or "",
                    "weight": exercise.get("weight") or "",
                    "rest": exercise.get("rest") or "",
                    "video_url": exercise.get("video_url") or "",
                    "notes": exercise.get("notes") or "",
                    "order_num": exercise.get("order_num") or order_num,
                }
            )
    return rows


def create_assignment_exercise_snapshot(athlete_block_id, block_id):
    rows = template_exercise_rows_for_block(block_id)
    db = write_client()
    db.table("athlete_block_exercises").delete().eq(
        "athlete_block_id",
        to_plain_int(athlete_block_id),
    ).execute()

    for row in rows:
        db.table("athlete_block_exercises").insert(
            {
                "athlete_block_id": to_plain_int(athlete_block_id),
                **row,
            }
        ).execute()


def save_assignment_exercise_tables(athlete_block_id, section_tables):
    db = write_client()
    db.table("athlete_block_exercises").delete().eq(
        "athlete_block_id",
        to_plain_int(athlete_block_id),
    ).execute()

    for section_order, (section_name, section_df) in enumerate(section_tables.items(), start=1):
        if section_df is None:
            continue
        order_num = 0
        for _, row in section_df.iterrows():
            exercise_name = clean_manual_cell(row.get("exercise_name"))
            if not exercise_name:
                continue
            order_num += 1
            db.table("athlete_block_exercises").insert(
                {
                    "athlete_block_id": to_plain_int(athlete_block_id),
                    "section_name": section_name,
                    "section_order": section_order,
                    "exercise_name": exercise_name,
                    "sets": clean_manual_cell(row.get("sets")),
                    "reps_or_time": clean_manual_cell(row.get("reps_or_time")),
                    "equipment": clean_manual_cell(row.get("equipment")),
                    "intensity": clean_manual_cell(row.get("intensity")),
                    "weight": clean_manual_cell(row.get("weight")),
                    "rest": clean_manual_cell(row.get("rest")),
                    "video_url": clean_manual_cell(row.get("video_url")),
                    "notes": clean_manual_cell(row.get("notes")),
                    "order_num": order_num,
                }
            ).execute()


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
  training_element text,
  description text,
  created_at timestamp with time zone default now()
);

alter table public.blocks add column if not exists block_code text;
alter table public.blocks add column if not exists block_name text;
alter table public.blocks add column if not exists goal text;
alter table public.blocks add column if not exists training_element text;
alter table public.blocks add column if not exists description text;
alter table public.blocks drop column if exists sport;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.blocks'::regclass
      and contype = 'p'
  ) then
    alter table public.blocks alter column id set not null;
    alter table public.blocks add constraint blocks_pkey primary key (id);
  end if;
end $$;

create table if not exists public.block_sections (
  id bigint generated by default as identity primary key,
  block_id bigint,
  section_name text,
  order_num integer,
  created_at timestamp with time zone default now()
);

create table if not exists public.block_exercises (
  id bigint generated by default as identity primary key,
  block_id bigint,
  section_id bigint,
  exercise_name text,
  sets text,
  reps_or_time text,
  equipment text,
  intensity text,
  weight text,
  rest text,
  video_url text,
  order_num integer,
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.blocks no force row level security;
alter table public.blocks disable row level security;
alter table public.block_sections no force row level security;
alter table public.block_sections disable row level security;
alter table public.block_exercises no force row level security;
alter table public.block_exercises disable row level security;

drop policy if exists "Development anon manage blocks" on public.blocks;
create policy "Development anon manage blocks"
on public.blocks
for all
to anon
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.blocks to anon, authenticated;
grant select, insert, update, delete on table public.block_sections to anon, authenticated;
grant select, insert, update, delete on table public.block_exercises to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.athletes to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
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
  training_category text,
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.athlete_blocks add column if not exists training_category text;

create table if not exists public.athlete_block_exercises (
  id bigint generated by default as identity primary key,
  athlete_block_id bigint references public.athlete_blocks(id) on delete cascade,
  section_name text,
  section_order integer,
  exercise_name text,
  sets text,
  reps_or_time text,
  equipment text,
  intensity text,
  weight text,
  rest text,
  video_url text,
  notes text,
  order_num integer,
  created_at timestamp with time zone default now()
);

alter table public.athlete_blocks no force row level security;
alter table public.athlete_blocks disable row level security;
alter table public.athlete_block_exercises no force row level security;
alter table public.athlete_block_exercises disable row level security;

drop policy if exists "Development anon manage athlete blocks" on public.athlete_blocks;
create policy "Development anon manage athlete blocks"
on public.athlete_blocks
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Development anon manage athlete block exercises" on public.athlete_block_exercises;
create policy "Development anon manage athlete block exercises"
on public.athlete_block_exercises
for all
to anon, authenticated
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.athlete_blocks to anon, authenticated;
grant select, insert, update, delete on table public.athlete_block_exercises to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- 跑完後可以用這段確認 RLS 是否真的關閉：
select
  relname,
  relrowsecurity,
  relforcerowsecurity
from pg_class
where relname in ('athlete_blocks', 'athlete_block_exercises');
        """.strip(),
        language="sql",
    )


def athlete_label(row):
    name = row.get("name") or f"學員 {row.get('id')}"
    sport = row.get("sport")
    return f"{name} - {sport}" if sport else name


def block_label(row):
    return row.get("block_name") or row.get("block_code") or f"Block {row.get('id')}"


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
        if row_cols[6].button("刪除", key=f"ask_delete_athlete_{athlete['id']}"):
            st.session_state["pending_delete_athlete_id"] = athlete["id"]

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

    with st.expander("從 Excel 匯入板塊", expanded=False):
        uploaded_file = st.file_uploader(
            "上傳板塊 Excel 檔",
            type=["xlsx"],
            help="支援你目前的 LAB33 板塊模板格式。",
        )

        if uploaded_file:
            try:
                uploaded_file.seek(0)
                parsed_blocks = parse_block_workbook(uploaded_file)

                if not parsed_blocks:
                    st.warning("沒有讀到可匯入的模板。請確認每個工作表都有 LAB33 板塊模板格式。")
                    return

                st.markdown("#### 匯入預覽")
                summary_rows = []
                blocks_to_create = []
                for parsed_block in parsed_blocks:
                    block_code = parsed_block["sheet_name"]
                    block_name = parsed_block["block_name"]
                    blocks_to_create.append(
                        {
                            "block_code": block_code,
                            "block_name": block_name,
                        }
                    )
                    exercise_count = sum(len(section["exercises"]) for section in parsed_block["sections"])
                    summary_rows.append(
                        {
                            "將寫入 Block Code": block_code,
                            "將寫入顯示名稱": block_name,
                            "週期目標": parsed_block.get("goal") or "",
                            "訓練元素": parsed_block.get("training_element") or "",
                            "區段數": len(parsed_block["sections"]),
                            "動作數": exercise_count,
                        }
                    )
                st.success(f"已讀取 {len(parsed_blocks)} 個板塊模板。")
                st.dataframe(pd.DataFrame(summary_rows), use_container_width=True, hide_index=True)
                identity_errors = validate_new_block_identity(blocks_to_create, blocks_df)
                if identity_errors:
                    render_block_identity_errors(identity_errors)
                    st.warning("請先調整 Excel 工作表名稱或模板顯示名稱，避免建立重複板塊。")

                for parsed_block in parsed_blocks:
                    st.markdown(f"**{parsed_block['sheet_name']}｜{parsed_block['block_name']}**")
                    preview_rows = []
                    for section in parsed_block["sections"]:
                        for exercise in section["exercises"]:
                            preview_rows.append(
                                {
                                    "section": section["section_name"],
                                    **exercise,
                                }
                            )
                    if preview_rows:
                        st.dataframe(pd.DataFrame(preview_rows), use_container_width=True, hide_index=True)
                    else:
                        st.warning("這張工作表沒有讀到動作列。")

                with st.form("import_block_excel_form"):
                    import_description = st.text_area("描述", value="由 Excel 多工作表匯入")
                    import_submitted = st.form_submit_button("確認匯入所有板塊", use_container_width=True)

                if import_submitted:
                    if identity_errors:
                        render_block_identity_errors(identity_errors)
                        return

                    for parsed_block in parsed_blocks:
                        block_code = parsed_block["sheet_name"]
                        create_block_from_excel(
                            parsed_block,
                            block_code,
                            import_description,
                        )
                    st.success(f"已從 Excel 匯入 {len(parsed_blocks)} 個板塊。")
                    st.rerun()
            except Exception as exc:
                render_block_setup_help(exc)

    render_manual_block_template_creator()

    st.subheader("板塊列表")
    if blocks_df.empty:
        st.info("目前尚未建立板塊。")
    else:
        render_blocks_with_details(blocks_df)


def render_manual_block_template_creator():
    with st.expander("直接填寫模板", expanded=False):
        st.caption("依照 LAB33 板塊模板填入動作；每個有填動作名稱的列都會寫進資料庫。")
        version = manual_template_version()

        col1, col2 = st.columns(2)
        block_code = col1.text_input("Block Code", key=f"manual_block_code_{version}")
        block_name = col2.text_input("顯示名稱（留空會用 Block Code）", key=f"manual_block_name_{version}")
        goal = col1.text_area("週期目標", key=f"manual_block_goal_{version}", height=120)
        training_element = col2.text_area("訓練元素", key=f"manual_training_element_{version}", height=120)
        description = st.text_area("描述", key=f"manual_block_description_{version}", height=160)

        section_tables = {}
        column_config = {
            "exercise_name": st.column_config.TextColumn("動作"),
            "sets": st.column_config.TextColumn("組數"),
            "reps_or_time": st.column_config.TextColumn("次數/時間"),
            "equipment": st.column_config.TextColumn("工具"),
            "intensity": st.column_config.TextColumn("強度"),
            "weight": st.column_config.TextColumn("重量"),
            "rest": st.column_config.TextColumn("休息時間"),
            "video_url": st.column_config.TextColumn("影片連結"),
        }

        for section_name in MANUAL_BLOCK_SECTION_NAMES:
            st.markdown(f"### {section_name}")
            section_tables[section_name] = st.data_editor(
                empty_manual_template_rows(),
                key=f"manual_template_{section_name}_{version}",
                num_rows="dynamic",
                use_container_width=True,
                hide_index=True,
                column_order=MANUAL_TEMPLATE_COLUMNS,
                column_config=column_config,
            )

        if st.button("建立這個板塊模板", key=f"create_manual_template_block_{version}", use_container_width=True):
            display_name = block_name or block_code
            if not display_name:
                st.warning("請先輸入 Block Code 或顯示名稱。")
                return

            parsed_block = build_manual_template_block(
                display_name,
                goal,
                training_element,
                section_tables,
            )
            exercise_count = sum(len(section["exercises"]) for section in parsed_block["sections"])
            if exercise_count == 0:
                st.warning("請至少填入一個動作名稱。")
                return

            identity_errors = validate_new_block_identity(
                [
                    {
                        "block_code": block_code or display_name,
                        "block_name": display_name,
                    }
                ],
                fetch_blocks()[0],
            )
            if identity_errors:
                render_block_identity_errors(identity_errors)
                return

            try:
                create_block_from_excel(
                    parsed_block,
                    block_code or display_name,
                    description or "由手動模板建立",
                )
                st.success(f"已建立板塊模板，共寫入 {exercise_count} 個動作。")
                st.rerun()
            except Exception as exc:
                render_block_setup_help(exc)

        if st.button("清空模板內容", key=f"clear_manual_template_{version}", use_container_width=True):
            reset_manual_template()
            st.rerun()


def render_blocks_with_details(blocks_df):
    st.dataframe(blocks_df, use_container_width=True, hide_index=True)

    st.markdown("#### 板塊詳細內容")
    for block in blocks_df.to_dict("records"):
        with st.expander(f"{block.get('block_code') or block.get('id')}｜{block.get('block_name') or '未命名板塊'}"):
            col1, col2, col3, col4 = st.columns([2, 3, 3, 1])
            col1.write(f"目標：{block.get('goal') or '-'}")
            col2.write(f"訓練元素：{block.get('training_element') or '-'}")
            col3.write(f"描述：{block.get('description') or '-'}")
            if col4.button("刪除", key=f"ask_delete_block_{block['id']}", use_container_width=True):
                st.session_state["pending_delete_block_id"] = block["id"]

            if st.session_state.get("pending_delete_block_id") == block["id"]:
                render_delete_block_confirmation(block)

            render_block_detail_tables(block["id"])


def format_block_exercise_table(exercises_df):
    visible_columns = [
        "exercise_name",
        "sets",
        "reps_or_time",
        "equipment",
        "intensity",
        "weight",
        "rest",
        "video_url",
        "notes",
    ]
    column_labels = {
        "exercise_name": "動作",
        "sets": "組數",
        "reps_or_time": "次數/時間",
        "equipment": "工具",
        "intensity": "強度",
        "weight": "重量",
        "rest": "休息時間",
        "video_url": "影片連結",
        "notes": "備註",
    }
    available_columns = [
        column for column in visible_columns
        if column in exercises_df.columns
    ]
    return exercises_df[available_columns].rename(columns=column_labels)


def exercise_editor_column_config():
    return {
        "exercise_name": st.column_config.TextColumn("動作"),
        "sets": st.column_config.TextColumn("組數"),
        "reps_or_time": st.column_config.TextColumn("次數/時間"),
        "equipment": st.column_config.TextColumn("工具"),
        "intensity": st.column_config.TextColumn("強度"),
        "weight": st.column_config.TextColumn("重量"),
        "rest": st.column_config.TextColumn("休息時間"),
        "video_url": st.column_config.TextColumn("影片連結"),
        "notes": st.column_config.TextColumn("備註"),
    }


def assignment_exercises_from_template(block_id):
    return pd.DataFrame(template_exercise_rows_for_block(block_id))


def assignment_exercises_for_editing(assignment_id, block_id):
    exercises_df, error = fetch_athlete_block_exercises(assignment_id)
    if error:
        return pd.DataFrame(), error
    if exercises_df.empty:
        try:
            return assignment_exercises_from_template(block_id), None
        except Exception as exc:
            return pd.DataFrame(), exc
    return exercises_df, None


def render_assignment_detail_tables(assignment_id, block_id, empty_message="這個板塊目前沒有詳細內容。"):
    exercises_df, error = fetch_athlete_block_exercises(assignment_id)
    if error:
        render_block_assignment_setup_help(error)
        return
    if exercises_df.empty:
        exercises_df = assignment_exercises_from_template(block_id)

    if exercises_df.empty:
        st.info(empty_message)
        return

    section_names = exercises_df.sort_values(["section_order", "order_num"])["section_name"].dropna().unique()
    for section_name in section_names:
        st.markdown(f"**{section_name or '未命名區段'}**")
        section_df = exercises_df[exercises_df["section_name"] == section_name].copy()
        st.dataframe(
            format_block_exercise_table(section_df),
            use_container_width=True,
            hide_index=True,
        )


def render_block_detail_tables(block_id, empty_message="這個板塊目前沒有詳細內容。"):
    sections_df, sections_error = fetch_block_sections(block_id)
    exercises_df, exercises_error = fetch_block_exercises(block_id)

    if sections_error or exercises_error:
        render_block_setup_help(sections_error or exercises_error)
        return

    if sections_df.empty and exercises_df.empty:
        st.info(empty_message)
        return

    for section in sections_df.to_dict("records"):
        st.markdown(f"**{section.get('section_name') or '未命名區段'}**")
        if exercises_df.empty or "section_id" not in exercises_df.columns:
            st.caption("此區段尚未建立動作。")
            continue

        section_exercises = exercises_df[
            exercises_df["section_id"] == section["id"]
        ].copy()
        if section_exercises.empty:
            st.caption("此區段尚未建立動作。")
            continue

        st.dataframe(
            format_block_exercise_table(section_exercises),
            use_container_width=True,
            hide_index=True,
        )


def render_delete_block_confirmation(block):
    block_name = block.get("block_name") or block.get("block_code") or f"Block {block.get('id')}"

    with st.container(border=True):
        st.warning(
            f"確認要刪除 {block_name} 嗎？刪除後會移除板塊詳細內容，"
            "也會從已安排給學員的課表中移除。"
        )
        col1, col2 = st.columns(2)
        if col1.button("確認刪除", key=f"confirm_delete_block_{block['id']}", use_container_width=True):
            try:
                delete_message = delete_block(block["id"])
                st.session_state.pop("pending_delete_block_id", None)
                st.success(delete_message)
                st.rerun()
            except Exception as exc:
                render_block_setup_help(exc)
        if col2.button("取消", key=f"cancel_delete_block_{block['id']}", use_container_width=True):
            st.session_state.pop("pending_delete_block_id", None)
            st.rerun()


def render_athlete_program_section(selected_athlete):
    st.subheader("學員課表板塊")

    with st.container(border=True):
        st.markdown(f"### {selected_athlete.get('name') or '未命名學員'}")
        col1, col2, col3, col4 = st.columns(4)
        col1.write(f"Email：{selected_athlete.get('email') or '-'}")
        col2.write(f"運動項目：{selected_athlete.get('sport') or '-'}")
        col3.write(f"程度：{selected_athlete.get('level') or '-'}")
        col4.write(f"學員 ID：{selected_athlete.get('id') or '-'}")

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
        block_by_id = {
            to_plain_int(block["id"]): block
            for block in block_options
        }
        block_ids = list(block_by_id.keys())
        with st.form("assign_block_form", clear_on_submit=True):
            selected_block_id = st.selectbox(
                "選擇板塊",
                block_ids,
                format_func=lambda block_id: block_label(block_by_id[block_id]),
            )
            col1, col2 = st.columns(2)
            week_num = col1.number_input("Week", min_value=1, value=1)
            day_num = col2.number_input("Day", min_value=1, value=1)
            training_category = st.selectbox("訓練分類", TRAINING_CATEGORIES)
            notes = st.text_area("備註")
            submitted = st.form_submit_button("加入到這位學員課表", use_container_width=True)

        if submitted:
            try:
                assign_block_to_athlete(
                    selected_athlete["id"],
                    selected_block_id,
                    week_num,
                    day_num,
                    training_category,
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
        render_schedule_table(athlete_blocks_df, blocks_df, editable=True)


def render_schedule_table(athlete_blocks_df, blocks_df, show_block_details=False, editable=False):
    display_df = athlete_blocks_df.copy()
    block_records = blocks_df.to_dict("records")
    blocks_by_id = {
        row["id"]: row
        for row in block_records
    }
    block_names = {
        row["id"]: block_label(row)
        for row in block_records
    }
    display_df["block"] = display_df["block_id"].map(block_names).fillna(
        display_df["block_id"].astype(str)
    )
    if "training_category" not in display_df.columns:
        display_df["training_category"] = ""
    display_df = display_df.sort_values(["week_num", "day_num", "training_category", "id"])
    visible_columns = ["week_num", "day_num", "training_category", "block", "notes", "created_at"]
    st.dataframe(display_df[visible_columns], use_container_width=True, hide_index=True)

    if editable:
        render_athlete_block_assignment_editor(display_df, blocks_by_id)

    st.markdown("#### 週期檢視")
    for (week_num, day_num), day_df in display_df.groupby(["week_num", "day_num"], sort=True):
        with st.expander(f"Week {week_num} / Day {day_num}", expanded=True):
            for category, category_df in day_df.groupby("training_category", sort=False):
                st.markdown(f"**{category or '未分類'}**")
                for row in category_df.to_dict("records"):
                    notes = row.get("notes") or ""
                    block = blocks_by_id.get(row.get("block_id"))

                    if not show_block_details:
                        note_text = f"｜{notes}" if notes else ""
                        st.write(f"- {row.get('block')}{note_text}")
                        continue

                    with st.container(border=True):
                        st.markdown(f"##### {row.get('block')}")
                        if notes:
                            st.info(f"教練備註：{notes}")

                        if not block:
                            st.warning("找不到這個板塊的詳細資料，可能已被刪除。")
                            continue

                        info_cols = st.columns(2)
                        info_cols[0].write(f"目標：{block.get('goal') or '-'}")
                        info_cols[1].write(f"訓練元素：{block.get('training_element') or '-'}")
                        if block.get("description"):
                            st.caption(f"描述：{block.get('description')}")

                        render_assignment_detail_tables(
                            row["id"],
                            block["id"],
                            empty_message="這個板塊目前沒有建立詳細動作內容。",
                        )


def render_athlete_block_assignment_editor(display_df, blocks_by_id):
    st.markdown("#### 點開板塊編輯學員專屬內容")

    for row in display_df.to_dict("records"):
        assignment_id = to_plain_int(row.get("id"))
        current_block_id = to_plain_int(row.get("block_id"))
        block = blocks_by_id.get(current_block_id)
        block_name = row.get("block") or f"Block {current_block_id}"

        with st.expander(
            f"Week {row.get('week_num')} / Day {row.get('day_num')}｜{row.get('training_category') or '未分類'}｜{block_name}",
            expanded=False,
        ):
            if not block:
                st.warning("找不到這個板塊模板，可能已經被刪除。你仍然可以刪除這筆學員課表安排。")

            exercises_df, exercises_error = assignment_exercises_for_editing(
                assignment_id,
                current_block_id,
            )
            if exercises_error:
                render_block_assignment_setup_help(exercises_error)
            elif exercises_df.empty:
                st.info("這個板塊目前沒有詳細動作內容。")

            if block:
                info_cols = st.columns(2)
                info_cols[0].write(f"目標：{block.get('goal') or '-'}")
                info_cols[1].write(f"訓練元素：{block.get('training_element') or '-'}")
                if block.get("description"):
                    st.caption(f"描述：{block.get('description')}")

            with st.form(f"edit_athlete_block_content_{assignment_id}"):
                st.markdown("##### 安排設定")
                col1, col2, col3 = st.columns([1, 1, 2])
                week_num = col1.number_input(
                    "Week",
                    min_value=1,
                    value=to_plain_int(row.get("week_num")) or 1,
                    key=f"edit_assignment_week_{assignment_id}",
                )
                day_num = col2.number_input(
                    "Day",
                    min_value=1,
                    value=to_plain_int(row.get("day_num")) or 1,
                    key=f"edit_assignment_day_{assignment_id}",
                )
                current_category = row.get("training_category") or TRAINING_CATEGORIES[0]
                category_index = (
                    TRAINING_CATEGORIES.index(current_category)
                    if current_category in TRAINING_CATEGORIES
                    else 0
                )
                training_category = col3.selectbox(
                    "訓練分類",
                    TRAINING_CATEGORIES,
                    index=category_index,
                    key=f"edit_assignment_category_{assignment_id}",
                )
                notes = st.text_area(
                    "教練備註",
                    value=row.get("notes") or "",
                    key=f"edit_assignment_notes_{assignment_id}",
                )

                st.markdown("##### 板塊內容")
                section_tables = {}
                if not exercises_df.empty:
                    sorted_exercises_df = exercises_df.sort_values(["section_order", "order_num"])
                    section_names = sorted_exercises_df["section_name"].dropna().unique()
                    for section_name in section_names:
                        st.markdown(f"**{section_name or '未命名區段'}**")
                        section_df = sorted_exercises_df[
                            sorted_exercises_df["section_name"] == section_name
                        ].copy()
                        for column in ATHLETE_BLOCK_EXERCISE_COLUMNS:
                            if column not in section_df.columns:
                                section_df[column] = ""
                        section_tables[section_name or "未命名區段"] = st.data_editor(
                            section_df[ATHLETE_BLOCK_EXERCISE_COLUMNS],
                            key=f"edit_assignment_exercises_{assignment_id}_{section_name}",
                            num_rows="dynamic",
                            use_container_width=True,
                            hide_index=True,
                            column_order=ATHLETE_BLOCK_EXERCISE_COLUMNS,
                            column_config=exercise_editor_column_config(),
                        )

                submitted = st.form_submit_button("儲存這個學員的板塊內容", use_container_width=True)

            if submitted:
                try:
                    update_athlete_block_assignment(
                        assignment_id,
                        current_block_id,
                        week_num,
                        day_num,
                        training_category,
                        notes,
                    )
                    save_assignment_exercise_tables(assignment_id, section_tables)
                    st.success("已更新這位學員的板塊內容。")
                    st.rerun()
                except Exception as exc:
                    render_block_assignment_setup_help(exc)

            if st.button("刪除這筆安排", key=f"ask_delete_assignment_{assignment_id}", use_container_width=True):
                st.session_state["pending_delete_assignment_id"] = assignment_id

            if st.session_state.get("pending_delete_assignment_id") == assignment_id:
                render_delete_athlete_block_assignment_confirmation(assignment_id, block_name)


def render_delete_athlete_block_assignment_confirmation(assignment_id, block_name):
    with st.container(border=True):
        st.warning(f"確認要從這位學員課表移除 {block_name} 嗎？板塊模板本身不會被刪除。")
        col1, col2 = st.columns(2)
        if col1.button("確認刪除", key=f"confirm_delete_assignment_{assignment_id}", use_container_width=True):
            try:
                delete_athlete_block_assignment(assignment_id)
                st.session_state.pop("pending_delete_assignment_id", None)
                st.success("已刪除這筆課表安排。")
                st.rerun()
            except Exception as exc:
                render_block_assignment_setup_help(exc)
        if col2.button("取消", key=f"cancel_delete_assignment_{assignment_id}", use_container_width=True):
            st.session_state.pop("pending_delete_assignment_id", None)
            st.rerun()


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
        col1, col2, col3, col4 = st.columns(4)
        col1.write(f"Email：{selected_athlete.get('email') or '-'}")
        col2.write(f"運動項目：{selected_athlete.get('sport') or '-'}")
        col3.write(f"程度：{selected_athlete.get('level') or '-'}")
        col4.write(f"學員 ID：{selected_athlete.get('id') or '-'}")

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
        st.caption(
            f"目前登入帳號對應到 athletes.id = {selected_athlete.get('id')}。"
            "請確認 Supabase 的 athlete_blocks.athlete_id 是否等於這個 ID。"
        )
    else:
        render_schedule_table(athlete_blocks_df, blocks_df, show_block_details=True)


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
