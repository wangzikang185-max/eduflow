# 学序 EduFlow

面向管理员、教师和学生的教务管理系统。以学生 CRUD 学习原型为起点，借助 AI 辅助开发和调试，扩展为包含身份权限、选课、考试、成绩、考勤、报表及操作审计的个人项目。

**Java 21 · Spring Boot 4.0.8 · Spring Security · MyBatis · MySQL 8 · Flyway · React 19 · TypeScript**

[项目介绍](docs/项目介绍.md) · [需求文档](docs/需求文档.md) · [接口文档](docs/接口文档.md) · [验证记录](docs/验收记录.md)

## 功能与实现

- 3 类角色：管理员维护业务与授权；教师只操作获授权课程；学生仅访问本人学业信息。
- 11 张业务表：班级、学生、课程、独立选课、多次考试、成绩、点名、账户与审计。
- JWT + BCrypt + token_version：登录、改密、禁用和退出后的令牌撤销。
- 选课通过课程行锁及 READ COMMITTED 控制名额；成绩和点名以版本条件更新检测冲突。
- CSV 导入和批量保存通过 Service 事务保持全成全败；学生目录使用 SQL 条件分页。
- Flyway V1/V2 管理数据库结构；前后端分离，同源代理联调。

## 本地运行

准备 JDK 21、Maven 3.9、Node 22.6+、pnpm 10.11.0，以及 MySQL 8.0.16+（已验证版本 8.0.34）。

```sh
git clone https://github.com/wangzikang185-max/eduflow.git
cd eduflow
corepack enable
pnpm --dir frontend install --frozen-lockfile
```

创建空库（无需手动运行迁移 SQL）：

```sql
CREATE DATABASE xuexu CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

Windows 下运行 `start.cmd`，首次会生成并提示 `runtime/local.env` 后退出。填写 DB_URL、DB_USERNAME、DB_PASSWORD，保留随机生成的 JWT_SECRET 和 ADMIN_PASSWORD，然后再次运行 `start.cmd`。默认入口 http://127.0.0.1:5173/，管理员用户名为 `admin`，密码取自本机配置。项目不包含真实用户数据、数据库备份或共享默认管理员密码。

Linux/macOS 可以按 `.env.example` 设置环境变量，再在两个终端分别执行：

```sh
mvn -B -ntp -f backend/pom.xml spring-boot:run
pnpm --dir frontend dev
```

已有数据升级前先备份；Flyway 会从旧学生表 baseline 后执行迁移。MySQL DDL 不保证整段事务回滚。

## 测试与证据

2026-10-31 本地重新执行：**22 项后端测试、10 项前端领域测试全部通过，JAR 打包及 TypeScript/Vite 构建成功**。

另保留 2026-10-23 的 **13 组真实 HTTP/MySQL 验收**原始报告，覆盖教师课程越权、学生仅本人、批量回滚、最后名额竞争、版本冲突及令牌撤销。本次发布没有把历史报告改成新日期，也没有进行 100 并发容量压测。

```sh
mvn -B -ntp -f backend/pom.xml package
pnpm --dir frontend test
pnpm --dir frontend build
```

真实业务验收使用独立空库和测试服务；设置 V2_TEST_PASSWORD、V2_TEST_JWT_SECRET 后运行：

```sh
python tools/verify_v2.py --base http://127.0.0.1:8086
```

具体设置见[验证记录](docs/验收记录.md)。GitHub Actions 自动构建并执行独立 MySQL 验收，云端结果以仓库 Actions 为准。

## 文档与演示数据

`docs/index.html` 为离线文档中心，应用内 `/project-docs.html` 可阅读同一份文档。修改 Markdown 后运行 `python tools/build_docs.py`，再运行 `python tools/build_docs.py --check`（需要 Python-Markdown）。虚构演示数据可以用 `tools/seed_demo.py` 通过真实 API 创建，见[演示数据说明](docs/演示数据.md)。

提供 Dockerfile 和 Compose，尚未在本机执行容器验证；无公网演示地址。课程内列表与报表主要面向小规模工作区，未宣称高吞吐或生产级部署。
