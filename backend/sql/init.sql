-- ============================================================
-- 公考星 · AI全真面试模拟 - 数据库初始化脚本
-- 说明：PostgreSQL 容器首次启动时自动执行
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone                VARCHAR(20) UNIQUE NOT NULL,
    password             VARCHAR(255),
    name                 VARCHAR(50),
    avatar               VARCHAR(255),
    member_type          VARCHAR(20) DEFAULT 'free',
    member_expire_at     TIMESTAMP,
    daily_practice_count INTEGER DEFAULT 0,
    last_practice_date   DATE,
    total_practice_count INTEGER DEFAULT 0,
    avg_score            FLOAT DEFAULT 0,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_member_type ON users(member_type);

-- ============================================================
-- 2. 题库表
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category          VARCHAR(30) NOT NULL,
    exam_type         VARCHAR(30) NOT NULL,
    province          VARCHAR(20),
    content           TEXT NOT NULL,
    difficulty        INTEGER DEFAULT 1,
    answer_reference  TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_exam_type ON questions(exam_type);

-- ============================================================
-- 3. 练习记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS practice_records (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                   UUID NOT NULL REFERENCES users(id),
    question_id               UUID NOT NULL REFERENCES questions(id),
    practice_mode             VARCHAR(20) NOT NULL,
    thinking_time             INTEGER,
    answer_time               INTEGER,
    answer_text               TEXT,
    audio_url                 VARCHAR(255),
    video_url                 VARCHAR(255),
    score_overall             FLOAT,
    score_analysis            FLOAT,
    score_expression          FLOAT,
    score_adaptability        FLOAT,
    score_organization        FLOAT,
    score_appearance          FLOAT,
    report_content            TEXT,
    deduction_points          TEXT,
    optimization_suggestions  TEXT,
    file_expire_at            TIMESTAMP,
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_practice_user_id ON practice_records(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_created_at ON practice_records(created_at);

-- ============================================================
-- 4. 追问记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_up_records (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practice_record_id   UUID NOT NULL REFERENCES practice_records(id),
    round_number         INTEGER NOT NULL,
    question_text        TEXT NOT NULL,
    answer_text          TEXT,
    audio_url            VARCHAR(255),
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_followup_practice_id ON follow_up_records(practice_record_id);

-- ============================================================
-- 5. 验证码表
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_codes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone       VARCHAR(20) NOT NULL,
    code        VARCHAR(6) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_verify_phone ON verification_codes(phone);

-- ============================================================
-- 6. 更新时间触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 初始化完成
-- ============================================================
