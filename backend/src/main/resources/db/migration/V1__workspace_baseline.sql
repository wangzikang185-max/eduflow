-- 学序 EduFlow：完整建库建表脚本（不创建外键约束）
-- 版本：1.0 / 2026-10-23
-- 适用：MySQL 8.0.16+（CHECK 从 8.0.16 起执行）；本机验证版本 8.0.34。
-- 可以单独执行，无需先执行 001 或 002；不包含测试数据、默认账号或密码。
-- IF NOT EXISTS 只跳过已经存在的表，不会自动升级旧表结构。
-- 本脚本没有删库、删表、清空数据、级联删除、触发器和外键定义。
-- 关联 ID 仍然保留，存在性、操作权限和跨表事务由 Java Service 保证。
-- UUID 字符串主键由应用生成；关联表使用联合主键，不必另造无业务意义的 ID。

SET NAMES utf8mb4;



-- ============================================================
-- 1. 学生档案：保持与 001_student_schema.sql 和现有 Mapper 兼容
--    班级仍为固定名称，major 由 Service 按班级推导。
--    保留原来的主键、学号唯一索引；字段校验继续由 Service 执行。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_student (
    id              VARCHAR(36)  NOT NULL COMMENT '学生 ID，由应用生成 UUID',
    student_no      VARCHAR(20)  NOT NULL COMMENT '学号，4-20 位，工作区内唯一',
    name            VARCHAR(30)  NOT NULL COMMENT '学生姓名',
    gender          VARCHAR(8)   NOT NULL COMMENT '男、女、未说明',
    class_name      VARCHAR(40)  NOT NULL COMMENT '当前固定班级名称',
    major           VARCHAR(40)  NOT NULL COMMENT '专业，由班级推导',
    phone           VARCHAR(11)  NOT NULL DEFAULT '' COMMENT '手机，可为空字符串',
    email           VARCHAR(254) NOT NULL DEFAULT '' COMMENT '邮箱，可为空字符串',
    status          VARCHAR(8)   NOT NULL COMMENT '在读、休学、已毕业',
    enrollment_date DATE         NOT NULL COMMENT '入学日期',
    create_time     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    update_time     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                            ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_eduflow_student_no (student_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='学生档案；现有真实后端使用的表';

-- ============================================================
-- 2. 课程：teacher 是展示名称，用户权限另存 user_course。
--    不保存 enrolled 冗余人数；当前 V1 全部学生关联全部课程，查询时统计。
--    前端 time='08:30–10:10' 拆为 start_time/end_time，响应时再拼接。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_course (
    id          VARCHAR(36)   NOT NULL COMMENT '课程 ID，由应用生成 UUID',
    code        VARCHAR(20)   NOT NULL COMMENT '课程编号，2-20 位，唯一',
    name        VARCHAR(40)   NOT NULL COMMENT '课程名称',
    description VARCHAR(200)  NOT NULL DEFAULT '' COMMENT '课程简介',
    teacher     VARCHAR(50)   NOT NULL COMMENT '教师显示名称，不是账号 ID',
    category    VARCHAR(20)   NOT NULL COMMENT '专业必修、公共基础、专业选修',
    credits     DECIMAL(3,1)  NOT NULL COMMENT '学分，0.5-10，按 0.5 递增',
    hours       SMALLINT UNSIGNED NOT NULL COMMENT '课时，1-300',
    capacity    SMALLINT UNSIGNED NOT NULL COMMENT '容量，1-10000；与实际人数比较由 Service 完成',
    room        VARCHAR(100)  NOT NULL COMMENT '上课地点',
    weekday     TINYINT UNSIGNED NOT NULL COMMENT '1=周一，7=周日',
    start_time  TIME          NOT NULL COMMENT '开始时间，仅当天时分',
    end_time    TIME          NOT NULL COMMENT '结束时间，必须晚于开始',
    color       VARCHAR(10)   NOT NULL DEFAULT 'orange' COMMENT '前端卡片颜色枚举',
    create_time DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    update_time DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                             ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_eduflow_course_code (code),
    KEY idx_eduflow_course_schedule (weekday, start_time),
    CONSTRAINT ck_eduflow_course_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
    CONSTRAINT ck_eduflow_course_teacher CHECK (CHAR_LENGTH(TRIM(teacher)) > 0),
    CONSTRAINT ck_eduflow_course_room CHECK (CHAR_LENGTH(TRIM(room)) > 0),
    CONSTRAINT ck_eduflow_course_category
        CHECK (category IN ('专业必修', '公共基础', '专业选修')),
    CONSTRAINT ck_eduflow_course_credits
        CHECK (credits BETWEEN 0.5 AND 10.0 AND MOD(credits, 0.5) = 0),
    CONSTRAINT ck_eduflow_course_hours CHECK (hours BETWEEN 1 AND 300),
    CONSTRAINT ck_eduflow_course_capacity CHECK (capacity BETWEEN 1 AND 10000),
    CONSTRAINT ck_eduflow_course_weekday CHECK (weekday BETWEEN 1 AND 7),
    CONSTRAINT ck_eduflow_course_time
        CHECK (start_time >= '00:00:00' AND start_time < end_time
               AND end_time < '24:00:00'
               AND SECOND(start_time) = 0 AND SECOND(end_time) = 0),
    CONSTRAINT ck_eduflow_course_color
        CHECK (color IN ('orange', 'blue', 'purple', 'teal', 'pink', 'amber'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='课程与上课安排';

-- ============================================================
-- 3. 成绩：每门课程每名学生一条汇总成绩；null 表示未录入，0 是真实零分。
--    分数最多两位小数；Service 必须先验证精度，避免入库时被自动舍入。
--    V1 没有多次考试表，也没有独立选课表。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_grade (
    id          VARCHAR(36)  NOT NULL COMMENT '成绩 ID，由应用生成 UUID',
    course_id   VARCHAR(36)  NOT NULL COMMENT '关联课程 ID，当前不设置外键',
    student_id  VARCHAR(36)  NOT NULL COMMENT '关联学生 ID，当前不设置外键',
    score       DECIMAL(5,2) NULL DEFAULT NULL COMMENT '0-100，最多两位小数；NULL=未录入',
    create_time DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    update_time DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                            ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_eduflow_grade_course_student (course_id, student_id),
    KEY idx_eduflow_grade_student (student_id),
    CONSTRAINT ck_eduflow_grade_score
        CHECK (score IS NULL OR score BETWEEN 0.00 AND 100.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='课程学生成绩';

-- ============================================================
-- 4. 考勤表：一门课程一天一张；只有实际保存后才落库。
--    首次 GET 没有记录时，由后端组装 savedAt=null 的虚拟点名表。
--    saved_at 是最近一次成功保存时间，不等同于 create_time。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_attendance_sheet (
    id              VARCHAR(36) NOT NULL COMMENT '考勤表 ID，由应用生成 UUID',
    course_id       VARCHAR(36) NOT NULL COMMENT '关联课程 ID，当前不设置外键',
    attendance_date DATE        NOT NULL COMMENT '考勤业务日期 YYYY-MM-DD',
    saved_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        COMMENT '每次成功保存时由 Service 显式更新',
    create_time     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    update_time     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                           ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_eduflow_attendance_course_date (course_id, attendance_date),
    KEY idx_eduflow_attendance_date (attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='按课程和日期保存的考勤表';

-- ============================================================
-- 5. 考勤记录：联合主键保证同一张表内学生只出现一次。
--    已保存表按这里的学生 ID 回显名单，不因学生后来休学/毕业而过滤历史。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_attendance_record (
    sheet_id    VARCHAR(36) NOT NULL COMMENT '关联考勤表 ID，当前不设置外键',
    student_id  VARCHAR(36) NOT NULL COMMENT '关联学生 ID，当前不设置外键',
    status      VARCHAR(10) NOT NULL COMMENT 'present/late/absent/leave',
    create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                           ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (sheet_id, student_id),
    KEY idx_eduflow_attendance_record_student (student_id),
    CONSTRAINT ck_eduflow_attendance_record_status
        CHECK (status IN ('present', 'late', 'absent', 'leave'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='每名学生的一次考勤结果';

-- ============================================================
-- 6. 用户：当前首版角色只有管理员和教师；显示名称不是登录凭据。
--    不生成默认账号。密码哈希由后端 PasswordEncoder 等成熟实现产生。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_user (
    id            VARCHAR(36)  NOT NULL COMMENT '用户 ID，由应用生成 UUID',
    username      VARCHAR(50)  NOT NULL COMMENT '登录用户名，唯一',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希，不能存明文密码',
    display_name  VARCHAR(50)  NOT NULL COMMENT '用户显示名称',
    role          VARCHAR(16)  NOT NULL COMMENT 'ADMIN 或 TEACHER',
    enabled       TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=可用，0=禁用',
    create_time   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    update_time   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                              ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_eduflow_user_username (username),
    CONSTRAINT ck_eduflow_user_username CHECK (CHAR_LENGTH(TRIM(username)) > 0),
    CONSTRAINT ck_eduflow_user_password_hash CHECK (CHAR_LENGTH(password_hash) > 0),
    CONSTRAINT ck_eduflow_user_display_name CHECK (CHAR_LENGTH(TRIM(display_name)) > 0),
    CONSTRAINT ck_eduflow_user_role CHECK (role IN ('ADMIN', 'TEACHER')),
    CONSTRAINT ck_eduflow_user_enabled CHECK (enabled IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='管理员和教师登录账户';

-- ============================================================
-- 7. 用户课程授权：教师可以操作哪些课程，不是学生选课表。
--    管理员权限由 role 判断，不必为管理员写全量课程授权记录。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_user_course (
    user_id     VARCHAR(36) NOT NULL COMMENT '教师账户 ID，当前不设置外键',
    course_id   VARCHAR(36) NOT NULL COMMENT '可操作的课程 ID，当前不设置外键',
    create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, course_id),
    KEY idx_eduflow_user_course_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='教师与课程的授权关系';

-- ============================================================
-- 8. 操作日志：记录业务操作，不存密码/Token，也不复制完整敏感请求体。
--    批量操作可用 before_data/after_data JSON 存必要的目标 ID 和变化摘要。
--    失败审计不能依赖已经回滚的业务事务，后端需要另定保存边界。
-- ============================================================
CREATE TABLE IF NOT EXISTS eduflow_operation_log (
    id            VARCHAR(36)  NOT NULL COMMENT '操作日志 ID，由应用生成 UUID',
    operator_id   VARCHAR(36)  NULL DEFAULT NULL COMMENT '操作者 ID；系统或匿名失败可为空',
    action        VARCHAR(50)  NOT NULL COMMENT '操作代码，如 GRADE_BATCH_UPDATE',
    target_type   VARCHAR(30)  NOT NULL COMMENT '目标类型，如 STUDENT/COURSE/GRADE',
    target_id     VARCHAR(36)  NULL DEFAULT NULL COMMENT '单目标 ID；批量摘要放 JSON',
    before_data   JSON         NULL COMMENT '操作前必要信息，须脱敏',
    after_data    JSON         NULL COMMENT '操作后必要信息，须脱敏',
    result        VARCHAR(10)  NOT NULL COMMENT 'SUCCESS 或 FAILURE',
    message       VARCHAR(500) NOT NULL DEFAULT '' COMMENT '安全的结果或失败摘要',
    create_time   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_eduflow_operation_log_time (create_time, id),
    KEY idx_eduflow_operation_log_operator (operator_id, create_time),
    KEY idx_eduflow_operation_log_target (target_type, target_id, create_time),
    CONSTRAINT ck_eduflow_operation_log_result CHECK (result IN ('SUCCESS', 'FAILURE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='服务端业务操作审计';

-- 建表后可以执行：
-- SHOW TABLES;
-- SHOW CREATE TABLE eduflow_grade;
-- SHOW INDEX FROM eduflow_user_course;
-- SELECT TABLE_NAME, CONSTRAINT_TYPE
-- FROM information_schema.TABLE_CONSTRAINTS
-- WHERE CONSTRAINT_SCHEMA = 'xuexu' ORDER BY TABLE_NAME, CONSTRAINT_TYPE;

-- 业务规则提醒：这里没有外键，数据库不会自动检查关联行存在或自动级联清理。
-- 新增学生/课程的成绩初始化、批量成绩保存、导入、删除、考勤保存均须由 Service
-- 在事务中完成；涉及并发容量/关联初始化时还需要统一的加锁或串行化策略。
-- DATETIME(3) 不保存时区；沿用现有项目时区约定，savedAt 输出时正确转为 ISO 8601。

