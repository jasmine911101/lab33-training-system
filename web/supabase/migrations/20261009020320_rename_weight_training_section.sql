-- Rename the template section while preserving all blocks, exercises, and ordering.
-- Existing assigned athlete schedules intentionally keep their historical section labels.
update public.block_sections
set section_name = '主要運動'
where section_name = '重量訓練';
