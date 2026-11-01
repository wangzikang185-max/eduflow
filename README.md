# 学序 EduFlow

学序是一个面向管理员、教师和学生的教务管理 Web 应用。后端提供身份认证、数据范围控制、学生与课程管理、选课、考试、成绩、考勤、报表和操作审计；前端通过 HTTP API 读写 MySQL 数据。开发过程使用了 AI 辅助，功能与边界以源码和可复现测试为准。

本仓库是面向开发者与技术评审的公开版本。文档围绕业务规则、技术取舍、具体代码位置和复现方法组织；个人课程进度、学习安排和面试备忘单独保存在个人学习工作区。

**技术栈：** Java 21 · Spring Boot 4.0.8 · Spring Security · MyBatis · MySQL 8 · Flyway · React 19 · TypeScript · Vite

## 功能概览

| 模块 | 实现内容 |
| --- | --- |
| 身份与权限 | 管理员、教师、学生三种角色；JWT 登录、改密与令牌撤销；教师按课程授权，学生仅能查看本人数据。 |
| 学生与班级 | 档案增删改查、SQL 条件分页、CSV 批量导入与导出、班级维护。 |
| 课程与选课 | 课程管理、批量选课、学生自助选退课；课程行锁控制容量。 |
| 考试与考勤 | 多次考试、成绩录入及版本冲突检查、按日点名和历史回显。 |
| 报表与审计 | 授权范围内的工作台与学业报表；写操作的结果及版本摘要审计。 |

[架构与实现证据](docs/项目介绍.md) · [需求与业务规则](docs/需求文档.md) · [API 契约](docs/接口文档.md) · [验证方法与结果](docs/验收记录.md) · [演示数据](docs/演示数据.md)

## 本地运行

需要 JDK 21、Maven 3.9、Node.js 22.6+、pnpm 10.11.0 和 MySQL 8.0.16+。先安装前端依赖并创建空库：

```sh
corepack enable
pnpm --dir frontend install --frozen-lockfile
```

```sql
CREATE DATABASE xuexu CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

**Windows：** 运行 `start.cmd`。首次运行会生成 `runtime/local.env` 并退出；填写数据库连接和密码，保留脚本生成的随机 `JWT_SECRET`、`ADMIN_PASSWORD`，再次运行。启动完成后打开 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)，管理员用户名为 `admin`，密码见本机配置。

**Linux/macOS：** 参照 [.env.example](.env.example) 设置环境变量，在两个终端分别运行：

```sh
mvn -B -ntp -f backend/pom.xml spring-boot:run
pnpm --dir frontend dev
```

首次启动由 Flyway 执行 `V1`、`V2` 迁移。已有数据库升级前请先备份；不要修改已执行的迁移文件。公开仓库不包含真实业务数据、数据库密码或通用管理员密码。需要虚构演示资料时，按[演示数据说明](docs/演示数据.md)在专用数据库运行种子脚本。

## 验证

```sh
mvn -B -ntp -f backend/pom.xml package
pnpm --dir frontend test
pnpm --dir frontend build
```

当前清理分支本机检查为 21 项后端测试、5 项前端 CSV 导出测试，以及前端类型检查和生产构建。此前的[GitHub Actions 运行记录](https://github.com/wangzikang185-max/eduflow/actions/runs/41184645714)在独立 MySQL 环境通过 13 组真实 HTTP 验收；当时的 22 项后端测试和 10 项前端测试含本次移除的旧代码检查。当前分支合并后的云端结果以[工作流](.github/workflows/verify.yml)为准。范围、原始结果和复现步骤见[验证记录](docs/验收记录.md)。

## 代码结构

```text
backend/                 Spring Boot API、业务规则、权限、MyBatis、Flyway、测试
frontend/src/v2/         正式 React 界面与 HTTP 客户端
frontend/src/components/ 复用的界面组件
frontend/src/lib/        复用的 CSV 导出工具
docs/                    对外技术说明、API 契约与验证证据
sql/                     只读数据库核对脚本；实际建表由 Flyway 管理
tools/                   本地启动、预览、演示数据和集成验证脚本
```

新增业务功能时，从 `docs/需求文档.md` 明确规则与角色范围，新增 Flyway 迁移（如需改表），再依次修改 Controller、Service、Mapper、`frontend/src/v2` 与测试。现有 V1/V2 迁移是历史链，不应重写。

## 当前边界

课程内名单与部分报表仍面向小规模工作区，未做大规模吞吐验证；容器配置已提供，但不把本地容器部署当作已验证结果。没有公网演示地址。
