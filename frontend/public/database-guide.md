# 学序数据库脚本

公开仓库不包含本机数据库；请按根 README 创建空库，演示数据按 docs/演示数据.md 自行初始化。

## V2 当前运行方式（优先阅读）

当前版本由 Flyway 自动管理结构：`backend/src/main/resources/db/migration/V1__workspace_baseline.sql` 创建 V1 八张表，`V2__academic_workspace.sql` 新增班级、选课、考试和 version / 学生身份 / 令牌撤销字段，最终为 11 张业务表，加 flyway_schema_history。**旧的独立 SQL 001、002、003 已于 2026-10-24 精简移除；当前结构以这两条 Flyway 迁移为准。**

空库只需要先执行：

```sql
CREATE DATABASE IF NOT EXISTS xuexu CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

配置环境变量后启动 Java，由 Flyway 顺序迁移；首次管理员由 ADMIN_PASSWORD 初始化。旧非空库使用 baseline 0；已有学生、主键和 V1 成绩/点名会保留，迁入新的关联模型。不要对已经由 Flyway 升级的库手动重复执行 V2 ALTER，也不要修改已经在共享环境执行过的历史迁移。

V2 新表和关键约束：class.name 唯一；enrollment(course_id,student_id) 联合主键；exam(course_id,name) 唯一；grade 唯一键改为 (exam_id,student_id)；user.student_id 唯一且可空。数据库仍没有 FOREIGN KEY；存在性校验、引用保护、选退课、关联删除和事务在 Service 完成。容量采用课程行锁和 READ COMMITTED；资料、成绩和点名的陈旧版本返回 409。

### 升级前备份及恢复

使用 MySQL 客户端原生结果文件，避免 PowerShell 旧版本重定向将 SQL 写成 UTF-16。先创建 runtime 目录，再执行（-p 交互输入密码，不把密码写进命令）：

```powershell
New-Item -ItemType Directory -Path runtime -Force
mysqldump -u root -p --single-transaction --set-gtid-purged=OFF --no-tablespaces --result-file=runtime/xuexu-before-v2.sql xuexu
```

先恢复到另一个测试库检查，而非覆盖现有业务库：

```sql
CREATE DATABASE xuexu_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE xuexu_restore;
SOURCE runtime/xuexu-before-v2.sql;
SHOW TABLES;
SELECT COUNT(*) FROM eduflow_student;
```

mysqldump 不加 --databases 时不会写入固定 USE，适合上述独立恢复。MySQL DDL 不保证迁移脚本整段回滚；迁移失败时保存日志并依据升级前备份恢复，不能为了通过校验就删除 Flyway 历史或随意 repair。

本轮隔离验证：旧 001+002 学生单表库升级后仍保留两条原学生及 ID、version=0；V1/V2 迁移记录成功，外键数量 0。新空库也成功迁到 V2。详细记录见 `docs/验收记录.md`。

## 保留哪些文件

| 文件 | 用途 |
| --- | --- |
| backend/src/main/resources/db/migration/V1__workspace_baseline.sql | 初始 8 张业务表；是当前迁移链的一部分，必须保留。 |
| backend/src/main/resources/db/migration/V2__academic_workspace.sql | 班级、独立选课、多次考试、版本和学生身份的升级，必须保留。 |
| sql/004_demo_data_checks.sql | 常用展示库的只读统计和孤立关联核对。 |

旧 SQL 和旧 V1 文档已移除，迁移注释及历史验收报告中的原始脚本名称仍保留用于追溯，不构成启动依赖。不要修改已执行迁移的内容或校验和。

## 当前 11 张业务表

| 表 | 用途 |
| --- | --- |
| eduflow_student | 学生档案。 |
| eduflow_class | 班级与专业。 |
| eduflow_course | 课程、时间与容量。 |
| eduflow_enrollment | 独立学生选课关系。 |
| eduflow_exam | 每门课的多次考试与权重。 |
| eduflow_grade | 每名学生每次考试的成绩；NULL 是未录入，0 是有效成绩。 |
| eduflow_attendance_sheet | 每课程每日一张已保存点名表。 |
| eduflow_attendance_record | 点名表内每个学生的状态。 |
| eduflow_user | 登录账户、角色、学生绑定及令牌版本。 |
| eduflow_user_course | 教师课程授权。 |
| eduflow_operation_log | 业务审计。 |

另有 flyway_schema_history 记录迁移版本。存在性、引用保护、授权和批量事务由 Java Service 实现；数据库仍保留唯一索引和 CHECK 等约束。

## 只读核对

在 IDEA/MySQL 控制台打开并执行 [004_demo_data_checks.sql](004_demo_data_checks.sql)。它明确 USE xuexu，用于常用展示库；检查隔离测试库时应选择正确的数据库，不要直接照搬这个 USE。

```sql
USE xuexu;
SHOW TABLES;
SELECT installed_rank, version, description, success
FROM flyway_schema_history ORDER BY installed_rank;
SELECT COUNT(*) AS foreign_key_count
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'xuexu' AND CONSTRAINT_TYPE = 'FOREIGN KEY';
```

预期为 11 张业务表及迁移历史，V1/V2 成功，外键数为 0。15 名学生等数量是演示资料导入时的历史基线，正常编辑后可以变化。业务数据实际保存在 MySQL；runtime/local.env 是本机配置，runtime/backups 和 runtime/demo-before.json 是恢复资料与备份指纹，均继续保留且不提交到公开仓库。

启动见[根 README](../README.md)，展示场景见[演示数据](../docs/演示数据.md)，自动检查及手工功能清单见[验收记录](../docs/验收记录.md)。


## 展示数据核对 SQL（只读）

以下附录直接由核对脚本生成，阅读页面不会执行 SQL。脚本选择常用 xuexu 库，检查测试库时应使用对应连接。

```sql
-- Read-only checks for the V2 showcase data. Execute on the normal 3306/xuexu database.
USE xuexu;

SELECT '学生' AS 数据, COUNT(*) AS 数量 FROM eduflow_student
UNION ALL SELECT '班级', COUNT(*) FROM eduflow_class
UNION ALL SELECT '课程', COUNT(*) FROM eduflow_course
UNION ALL SELECT '选课', COUNT(*) FROM eduflow_enrollment
UNION ALL SELECT '考试', COUNT(*) FROM eduflow_exam
UNION ALL SELECT '成绩（含未录入）', COUNT(*) FROM eduflow_grade
UNION ALL SELECT '已录入成绩', COUNT(*) FROM eduflow_grade WHERE score IS NOT NULL
UNION ALL SELECT '考勤表', COUNT(*) FROM eduflow_attendance_sheet
UNION ALL SELECT '考勤明细', COUNT(*) FROM eduflow_attendance_record;

SELECT student_no, name, class_name, status
FROM eduflow_student WHERE student_no LIKE 'DEMO26%' ORDER BY student_no;

SELECT c.code, c.name, c.capacity, COUNT(e.student_id) AS enrolled
FROM eduflow_course c LEFT JOIN eduflow_enrollment e ON e.course_id = c.id
GROUP BY c.id ORDER BY c.code;

SELECT status, COUNT(*) AS count FROM eduflow_attendance_record GROUP BY status;

SELECT COUNT(*) AS orphan_enrollments
FROM eduflow_enrollment e
LEFT JOIN eduflow_student s ON s.id = e.student_id
LEFT JOIN eduflow_course c ON c.id = e.course_id
WHERE s.id IS NULL OR c.id IS NULL;

SELECT COUNT(*) AS orphan_grades
FROM eduflow_grade g
LEFT JOIN eduflow_student s ON s.id = g.student_id
LEFT JOIN eduflow_exam x ON x.id = g.exam_id
WHERE s.id IS NULL OR x.id IS NULL OR x.course_id <> g.course_id;

SELECT COUNT(*) AS orphan_attendance
FROM eduflow_attendance_record r
LEFT JOIN eduflow_student s ON s.id = r.student_id
LEFT JOIN eduflow_attendance_sheet a ON a.id = r.sheet_id
WHERE s.id IS NULL OR a.id IS NULL;
```
