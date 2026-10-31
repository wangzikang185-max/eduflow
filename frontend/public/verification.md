# 验证记录

## 2026年10月31日发布前重新检查

Windows / JDK 21：后端 Maven package 成功，22 项 JUnit/MockMvc 等测试，0 失败、0 错误、0 跳过；前端 10 项领域测试通过；TypeScript/Vite production build 成功。详见[机器可读记录](verification/release-checks-20261031.json)。这些测试不等于全系统覆盖率。

## 历史真实 HTTP 与 MySQL 验收

2026-10-23 在隔离 MySQL 8.0.34 完成 13 组检查，保留[原始 JSON](verification/http-acceptance.json)及原日期。本次发布未重跑该集成验收，未进行 100 并发压测。历史检查内容：

1. JWT authentication, malformed token and bad password rejected
2. Student validation, case-insensitive uniqueness and MySQL pagination
3. Class rename updates students atomically; stale and occupied deletion rejected
4. CSV BOM and quoted comma accepted; malformed row and duplicate leave no partial insert
5. Explicit enrollment rolls back invalid batches; concurrent final seat cannot oversubscribe
6. Teacher course scopes enforced in directory, grades, reports and administration
7. Multiple exams, null/zero, weighted report, decimal validation and stale batch rollback
8. Attendance first-save race, complete roster validation and historical roster preservation
9. Student portal is self-scoped; self enrollment and protected withdrawal work
10. Date-filtered report and dashboard use real scoped denominators
11. Batch deletion is atomic, cascades grades/attendance and revokes bound student login
12. Authorization revocation, password changes and logout invalidate existing access
13. Success and rolled-back failure audits persist without password/token disclosure

## 重新执行集成验收

1. 创建独立空测试库（例如 xuexu_acceptance）及仅授权该库的账号。
2. 设置 DB_URL、DB_USERNAME、DB_PASSWORD、随机 JWT_SECRET、随机 ADMIN_PASSWORD、PORT=8086；不要复用常用库。启动 `java -jar backend/target/xuexu-backend-2.0.0.jar`。
3. 等待 http://127.0.0.1:8086/health 返回 UP；在另一个终端设置同一管理员密码为 V2_TEST_PASSWORD，同一 JWT 密钥为 V2_TEST_JWT_SECRET。
4. 执行 `python tools/verify_v2.py --base http://127.0.0.1:8086`。脚本会写入虚构测试资料，包含删除、改密及并发；不自动清理全部资料。
5. 预期 13 组通过、退出码 0，runtime/acceptance.json 中 passed=true。随后在隔离前端核对三类角色、实际保存与重启后的持久化。

## 边界

最后一个名额两请求竞争属于功能一致性验证，不是吞吐或容量指标。教师已授权/未授权课程、学生本人/他人、管理员接口拒绝、撤权及退出后的旧令牌是验收场景；未给出权限测试覆盖率百分比。Docker/Compose 尚未在本机验证，公网部署未完成。
