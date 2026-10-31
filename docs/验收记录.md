# 验证记录

## 2026年10月31日发布前重新检查

Windows / JDK 21：后端 Maven package 成功，22 项 JUnit/MockMvc 等测试，0 失败、0 错误、0 跳过；前端 10 项领域测试通过；TypeScript/Vite production build 成功。详见[机器可读记录](verification/release-checks-20261031.json)。这些测试不等于全系统覆盖率。

## 2026年10月31日云端真实 HTTP 与 MySQL 验收

[GitHub Actions](https://github.com/wangzikang185-max/eduflow/actions/runs/41184645714) 全流程通过：前端测试及构建、后端22项测试及打包、独立 MySQL 8.0.34 的13组真实业务检查。[下载本轮原始报告](verification/cloud-http-acceptance-20261031.json)。

首次云端运行在超大请求的 urllib 上传阶段出现 BrokenPipeError；服务端提前拒绝上传时客户端未能读取响应。现将这一检查改为声明超限 Content-Length 并在上传前明确读取及断言 HTTP 413，不再将断连当成通过。其余验收场景保留，修正后13组全部通过。

## 历史真实 HTTP 与 MySQL 验收

2026-10-23 在隔离 MySQL 8.0.34 完成 13 组检查，保留[原始 JSON](verification/http-acceptance.json)及原日期。本轮重新执行结果见上一节，未进行 100 并发压测。历史检查内容：

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


## 2026年10月31日本机并发与事务实测

本轮在 Windows 11 / Ryzen 7 5800H（8核16线程）上启动独立 MySQL 8.0.34 实例和全新测试库，使用 JDK 21、Spring Boot 4.0.8 的实际 JAR。与常用数据库分开，全部资料均为新建虚构学生和课程。先重新执行完整13组 HTTP 验收，再运行下面实验。

使用 Python 标准库 urllib、ThreadPoolExecutor 和 Barrier 同时释放请求，无客户端自动重试。100个请求使用同一管理员会话，为100名不同学生选课；这与100个独立用户持续访问、完整容量压测并不相同。Hikari 连接池使用默认10连接。应用实现未为本实验临时替换成内存模型。

| 实验 | 操作与核对方法 | 实际结果 |
| --- | --- | --- |
| 名额竞争 | 100个线程向30容量课程各发一次选课请求，每轮新课程，重复3轮；核对响应、名单和独立SQL计数 | 每轮30个HTTP 200、70个HTTP 400且原因均为“课程容量不足”；3门课程实际人数均30，无超额、无意外传输异常 |
| 同版本写入 | 两个请求使用同一成绩版本提交不同分数，重复20轮；核对版本及最终胜出值 | 每轮1个200、1个409；版本仅增加1，最终分数均与成功请求一致 |
| 批量中途回滚 | 构造2条成绩更新，按实际SQL顺序将第2条版本置旧；重复10轮，比较整张成绩表的分数及版本 | 全部返回409；第1条已执行的更新也被回滚，整张表分数与版本变化均为0 |
| CSV整批校验 | 500行导入数据，第500行手机号非法；比较该批次学生数 | HTTP 400，新增0条；这是写入前整批校验，不能当成第500条SQL失败后的回滚测试 |

3轮100请求实验的客户端单请求P95分别为551.60、552.93、534.41ms。该值包含本机客户端、线程调度、连接及HTTP开销，混合了成功与预期拒绝；没有设置持续负载、独立发压机和系统资源隔离，不用于宣称生产吞吐、优化倍数或性能上限。简历采用可重复核对的一致性结果。

[完整机器可读实测记录](verification/consistency-benchmark-20261031.json) · [本轮13组验收原始记录](verification/local-http-acceptance-20261031.json)

复测脚本为仓库 `tools/benchmark_consistency.py`。先按上节创建独立测试库、启动测试服务，设置 V2_TEST_PASSWORD 为该服务的管理员密码，然后执行：

```sh
python tools/benchmark_consistency.py --base http://127.0.0.1:8086 --report runtime/consistency-benchmark.json
```

脚本保留虚构测试数据供查询核对，不会自动清理。报告中的 `database_cross_check` 是本轮通过 MySQL CLI 额外执行的只读SQL核对，通用HTTP脚本本身不读取数据库密码。独立SQL核对可执行：

```sql
SELECT c.capacity, COUNT(e.student_id)
FROM eduflow_course c
LEFT JOIN eduflow_enrollment e ON e.course_id = c.id
WHERE c.code LIKE 'B%'
GROUP BY c.id, c.capacity;
SELECT COUNT(*) FROM eduflow_student WHERE student_no LIKE 'B%CSV%';
```

首次使用新空库时，本轮预期为3组(30,30)及CSV计数0。反复运行脚本会产生更多独立课程，需要按当次虚构数据前缀筛选，不应把所有历史课程合并成单轮统计。
