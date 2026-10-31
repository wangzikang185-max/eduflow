# 学序 × Tlias 学习与交付规划

版本：1.0 · 整理日期：2026-10-23。

> 学习基线仍是本人自述的 P83。2026-10-23 已按后续请求补建 V2 实现，软件状态以新版需求、接口和项目介绍为准；本文原有“当前项目基线”及阶段勾选保留为当时的学习路线，不作为现在的功能缺失清单，也不替你认定已掌握。

## V2 交付后的学习使用方式

正式前端入口现为 `src/v2/WorkspaceApp.tsx`：People（学生/班级）、Curriculum（课程/选课）、Assessment（考试/成绩/考勤）、Insights（工作台/报表/学生门户/审计）、Accounts（账户/改密）、client（真实 HTTP 与登录）、shared（表单/表格/异步状态），workspace.css 为界面样式。main.tsx 已切换该入口；原 App/pages/mock 代码保留作对照，不再参与 V2 页面运行。

继续按下方集数优先级学习，每学完一个主题就在 V2 代码中完成一次独立修改与验证。例如：分页 → StudentMapper；事务 → saveGrades/importCsv；登录 → SecurityConfig/AuthService；统计 → WorkspaceSql.REPORT；并发 → enroll 的行锁、READ COMMITTED 和 version。不要把 AI 已实现的功能直接等同于自己的学习进度。

投简历前至少独立演示“建档 → 开课 → 授权 → 选课 → 录分 → 点名 → 报表”，能解释一次失败为何回滚，并能手写或修改学生 CRUD、SQL 分页和一条事务规则。项目介绍已提供基于实际实现的简历表述，避免使用未经压测的并发/性能数字。

相关文档：[需求与验收](需求文档.md) · [接口与请求示例](接口文档.md) · [文档中心](index.html)。

## 1. 主路线与学习方法

继续使用 Java / Spring Boot / MyBatis / MySQL，沿用当前 React 前端。学习主线保持 `Controller → Service → Mapper → MySQL`。

顺序：学生管理完善 → 课程管理 → 成绩保存与事务 → 登录和权限 → 成绩统计 → 导入 → 部署。考勤和工作台完整化在起投版本之后继续做。

| 学习方式 | 具体做法 |
| --- | --- |
| 精看 | 理解问题和原理；暂停视频自己写；在学序实现同类功能；验证正常及失败路径。 |
| 快看 | 可以倍速；找与已会内容的差异；第一次出现的新知识要暂停研究。 |
| 暂缓 | 当前先放下，完成核心业务后按需要补回，不等于永久不学。 |

先看一个知识点，再落地一个小功能。把更多时间留给编码、SQL、调试和验证；视频已看、AI 已生成、构建通过分别只能证明对应的一小部分。

AI 可解释概念、给提示、审查代码和定位错误。关键业务先自己尝试；完成后至少能够独立改一条规则，并解释数据为什么这样变化。

## 2. 当前项目基线

| 内容 | 当前源码状态 | 下一步 |
| --- | --- | --- |
| 学生列表、新增、修改 | 前端已接 Java 接口 | 自己追踪请求与数据变化。 |
| 学生详情、单人删除 | Java 已有；当前页面未直接调用这两条接口 | 用 API 客户端单独练习。 |
| 条件筛选、分页 | Java 查询全部后遍历筛选、截取 | P94–98 改成数据库条件分页。 |
| 校验、查重、异常响应 | Service 校验和 Controller 局部异常处理已存在 | 理解规则，P115 抽为全局处理器。 |
| 日志 | 有 Logback 配置、控制器日志、LogTest | 学会全局 INFO、业务包 DEBUG/TRACE；保留有用信息。 |
| 课程、成绩、考勤、工作台 | 页面与 mock 已存在，真实 Java 接口待开发 | 按需求文档逐模块接入。 |
| 导入、批量删除 | 页面入口和契约已存在，后端待开发 | P100–103、P110–111 迁移批量与事务。 |
| 登录与权限 | 界面“管理员”只是展示，无真实认证 | P120–132 后完成后端认证与权限。 |

当前学生接口共五条：`GET /students`、`GET /students/{id}`、`POST /students`、`PUT /students/{id}`、`DELETE /students/{id}`。浏览器开发环境请求前缀为 `/api`。

## 3. 先用 P83 做一次独立检查

- [ ] 从浏览器 Network 找到一次修改请求，指出 method、URL、路径 ID 和 JSON 请求体。
- [ ] 沿 Controller、Service、Mapper 找到实际执行的 UPDATE。
- [ ] 解释 WHERE 条件怎样限定目标；路径 ID 为什么优先于 body.id。
- [ ] 保持自己的学号可以保存，改成其他人的学号应返回冲突。
- [ ] 修改不存在的 ID、非法输入分别得到明确错误，失败时数据未被改动。
- [ ] 在测试数据上修改并直接查询 MySQL，确认实际结果；练习后清理临时数据。

若讲不清，定点回看 P77–83 对应内容；无需重新从课程第一集开始。检查通过后继续 P84。

## 4. P84–132 的观看优先级

| 集数与原课主题 | 建议 | 在学序的具体产出 |
| --- | --- | --- |
| P84–85 日志技术：Logback 入门、配置文件、日志级别 | 精看基础 | 能用日志定位一次失败，业务包开 DEBUG；避免全局 ALL 持续输出框架细节。 |
| P86–88 多表关系与设计案例 | 精看 | 画清学生、课程、成绩的关系；理解主键、关联字段、唯一约束。 |
| P89–92 多表查询：概述、内外连接、子查询、案例 | 精看 | 自己查询课程学生及成绩，解释 LEFT JOIN、NULL、重复行；不追求复杂嵌套技巧。 |
| P93 员工管理-准备工作 | 快看 | 学字段与接口分析，沿用当前工程。 |
| P94–95 分页查询-原理分析、代码实现 | 重点精看 | 手写 COUNT、LIMIT 和 offset，使用稳定排序。 |
| P96 分页查询-PageHelper 分页插件 | 理解用法后按需实践 | 先会手写分页；选插件前核对与当前 Boot/MyBatis 的兼容性，不叠加多套分页。 |
| P97–98 条件分页查询-基本实现、程序优化 | 重点精看 | 学生 search/className/status 在 SQL 中组合；列表与 total 使用相同条件。 |
| P99 新增员工-保存员工基本信息 | 快看，卡住再精看 | 独立实现新增课程，验证能否把已有 CRUD 迁移过去。 |
| P100 新增员工-批量保存员工工作经历 | 精看 | 学集合、关联数据和批量插入，迁移到课程成绩初始化/保存。 |
| P101–103 事务管理 | 重点精看 | 在 Service 划定事务；模拟中途失败，并核对真实数据库回滚。 |
| P104–105 文件上传介绍、本地存储 | 做上传时精看，可后移 | 理解 multipart。当前学生 CSV 契约是 JSON 字符串，不直接换成文件上传接口。 |
| P106–108 阿里云 OSS | 暂缓 | 首版核心流程暂不依赖云端图片。 |
| P109 程序优化：@Value、@ConfigurationProperties | 精看配置思想 | 把可变参数配置化，数据库密码使用环境变量。 |
| P110–111 删除员工-参数接收、逻辑实现 | 精看新增部分 | 批量 ID 校验、关联数据、事务；按需求文档明确删除后果。 |
| P112–113 修改员工-查询回显、修改数据 | 单表快看，多表精看 | 看关联集合的回显/修改及事务，复用已有单表基础。 |
| P114 程序优化-动态更新 | 精看 | 区分未传、空字符串、null；保留当前 PUT 完整更新语义。 |
| P115 全局异常处理器 | 精看，建议提前至分页后 | 统一参数错误、404、409 和未知异常的响应。 |
| P116–118 员工信息统计 | 后端精看，图表快看 | 迁移平均分、及格率、分数分布，以人工小样本核对分母和 NULL。 |
| P119 项目实战-需求说明 | 快看需求后独立练习 | 选一个小模块先做，再对照课程检查。 |
| P120–124 登录功能、Cookie、Session、令牌方案 | 重点精看 | 画清登录和后续请求怎样识别身份。 |
| P125–126 JWT 生成校验、下发令牌 | 重点精看 | 验证错误密码、篡改和过期；不得信任未校验的身份字段。 |
| P127–129 Filter | 精看 | 理解过滤范围、放行与失败出口。 |
| P130–132 Interceptor | 精看 | 理解与 Filter 的位置和职责；项目只保留一套正式认证入口。 |

员工管理虽然重复出现增删改查，但第一次出现的批量操作、多表关系、关联集合和事务不能一并略过。

## 5. P133–200 的安排

| 集数与主题 | 当前安排 | 补回时机 |
| --- | --- | --- |
| P133–134 AOP 入门、核心概念 | 基础看懂，做一个耗时记录例子 | 登录之后。 |
| P135–140 AOP 进阶、操作日志、获取登录员工 | 先快看，日志案例后续精看 | 成绩修改与登录完成后；先可在 Service 直接记录审计。 |
| P141–144 配置优先级、Bean、起步依赖、自动配置 | 理解基本思想，结合自己的工程找例子 | 不阻塞核心业务，之后复习解释。 |
| P145–147 自动配置源码、自定义 starter | 暂缓 | 首版完成之后。 |
| P148–151 Maven 分模块、继承、聚合、私服 | 暂缓 | 当前保持一个后端 Maven 模块。 |
| P152 Web后端开发-总结 | 看 | 用自己的项目复述一次请求到数据库的流程。 |
| P153–176 Vue、Element Plus、Tlias 前端开发 | 当前跳过，按需查阅 | 学序已有 React 前端；需要理解交互时参考。 |
| P177–180 前端登录、令牌、401、退出 | 看交互流程，迁移到 React | 后端认证接入时。 |
| P181 Tlias案例-打包部署 | 看构建和产物概念 | 前端生产构建时。 |
| P182 Linux 介绍与安装 | 快看，已有环境可略过安装 | 部署阶段。 |
| P183–186 Linux 连接、目录、文件、文本与查找 | 部署时精看并操作 | 自己定位一次配置和错误日志。 |
| P187–188 JDK、MySQL 安装与防火墙 | 按所选部署方式看 | 容器部署可避免重复手动安装。 |
| P189–190 Nginx 与项目部署 | 精看并部署 | 验证静态前端 → Java → MySQL。 |
| P191–199 Docker、数据卷、镜像、网络、Compose | 部署阶段精看 | 核心闭环完成后；验证重启和数据保留。 |
| P200 Web开发-完结 | 看总结即可 | 无需把看完此集当作投递前提。 |

当前 Boot/MyBatis 版本以项目 `pom.xml` 为准。迁移课程思路，不整段覆盖依赖版本；Boot 已管理的日志组件优先交给它统一管理。

## 6. 按产出推进的阶段清单

### S1：基础 CRUD 与日志

- [ ] 完成第 3 节的 P83 独立检查。
- [ ] 读懂 Logback 的 appender、root 和 logger；能说明为什么全局 ALL 会刷屏。
- [ ] 记录一次正常操作和一次失败，能从日志找到目标接口。

### S2：数据库条件分页（下一项主要功能）

- [ ] 为 `StudentMapper` 增加条件查询与总数查询。
- [ ] Service 不再先 `findAll()` 再遍历全表完成分页。
- [ ] 验证第一页、第二页、空结果、末页、非法 page/pageSize，以及组合条件。
- [ ] total 和列表使用同一组筛选条件，固定排序并用 ID 兜底。
- [ ] 接口响应仍为 `{items,total,page,pageSize}`，现有前端正常翻页。

### S3：课程、成绩与事务

- [ ] 按需求文档实现课程列表、新增、修改，不增加当前没有页面的课程删除功能。
- [ ] 实现课程成绩查询、批量保存，分清 0 分和未录入。
- [ ] 成绩/考勤页先加载真实课程再选择 ID；移除对演示课程 `c1` 的启动依赖，处理无课程空状态。
- [ ] 保证同一课程同一学生只有一条成绩记录。
- [ ] 事务中途失败时数据库没有部分成功；重复提交不生成重复记录。
- [ ] 把局部异常处理整理为全局处理，保持 HTTP 与 JSON 契约。

### S4：登录、权限与起投版本

- [ ] 接入真实登录、密码哈希、令牌校验和退出交互。
- [ ] 管理员/教师的操作范围由后端检查；教师跨课程操作被拒绝。
- [ ] 使用 JUnit/MockMvc 验证正常和失败路径；另用真实测试库验证事务和唯一约束。
- [ ] 做完最小统计：均值、及格率、成绩分布；不填虚构历史数据。
- [ ] README、建表/初始化脚本、接口示例、截图或短演示可供他人复现。
- [ ] 能独立讲解和修改关键业务。

Spring Security、密码哈希和对象级权限属于课外补充；P132 是主题里程碑，不代表课程已替你实现这些能力。认证设计见接口文档第 7 节。

### S5：完整化与部署

- [ ] CSV 导入：固定模板、行数/大小上限、全量校验、失败整批不写入。
- [ ] 批量删除：按明确的关联删除规则执行，全批次失败不产生部分删除。
- [ ] 完成考勤和真实工作台，处理未保存状态与空数据。
- [ ] 完成部署、反向代理、日志定位和重启后数据保留验证。
- [ ] 后续再补 AOP 审计、CI 与需要的工程增强。

## 7. GitHub 与简历节点

| 节点 | 门槛 | 行动 |
| --- | --- | --- |
| 现在：P83 学习版 | 学生 CRUD 可复现，README 清楚区分已完成/待完成 | 可以上传 GitHub，开始整理简历；不上传密码、Token、真实学生资料和运行产物。 |
| 主要起投节点：P132 相关内容落地 + S3/S4 | 课程成绩闭环、事务、认证权限、核心验证、可复现文档、能自己讲清 | 开始小批量投匹配岗位，边投边补；不必等待所有页面完成。 |
| 后续部署版：P190 或 P199 对应能力 | 另一套环境能启动并完成演示，数据可持久保存 | 更新仓库与简历，补部署证据和改进记录。 |

这里是项目展示的学习里程碑，不是所有公司的统一录用标准。投递时另核对毕业时间、到岗和在岗时长等要求。Java、SQL、集合、HTTP 等基础与面试练习应同时进行。

简历只写实际实现、亲自验证且能解释的内容。前端使用 AI 辅助可以据实说明，重点展示自己独立完成的接口、业务规则、联调、测试和问题定位。

## 8. 前端阅读顺序与文件速查

先读 `types.ts → pages/Students.tsx → lib/api.ts → Java Controller`。保存学生流程是：表单 → POST/PUT → Controller → Service → Mapper → MySQL → 返回结果 → 刷新列表。

| 文件（相对 frontend/） | 职责 |
| --- | --- |
| `index.html` | 网页外壳、标题、图标、React 挂载位置。 |
| `src/main.tsx` | 启动 React，加载 App 和样式。 |
| `src/App.tsx` | 总布局、导航、搜索、设置、通知、页面切换与错误兜底。 |
| `src/styles.css` | 颜色、排版、布局与响应式适配。 |
| `src/pages/Students.tsx` | 学生列表、表单、筛选、分页、导入导出和删除入口。 |
| `src/pages/Courses.tsx` | 课程卡片/列表、详情、新增和修改。 |
| `src/pages/Grades.tsx` | 成绩录入、保存、统计、导出。 |
| `src/pages/Attendance.tsx` | 按课程和日期点名、保存和导出。 |
| `src/pages/Dashboard.tsx` | 汇总卡片、趋势、课程安排等工作台信息。 |
| `src/types.ts` | 学生、课程、成绩、考勤等 TypeScript 数据结构。 |
| `src/lib/api.ts` | HTTP 请求、响应/错误处理，以及独立 mock 适配器。 |
| `src/lib/domain.ts` | 校验、成绩等级、CSV 解析和导出工具。 |
| `src/lib/hooks.ts` | 加载/错误/重试，以及搜索防抖。 |
| `src/lib/seed.ts` | 虚构演示数据，不能当作真实数据库。 |
| `src/components/ui.tsx` | 按钮、弹窗、分页、提示、空数据等公共组件。 |
| `src/components/charts.tsx` | 趋势、迷你折线、环形图等公共图表。 |
| `package.json` | 依赖与 dev/build/test 命令。 |
| `pnpm-lock.yaml` | 锁定依赖版本。 |
| `vite.config.ts` | React 插件、开发端口、/api 转发。 |
| `tsconfig.json` | TypeScript 检查规则。 |
| `src/vite-env.d.ts` | Vite 环境类型声明。 |
| `tests/domain.test.ts` | CSV、字段校验与成绩等级等工具测试，不替代真实 HTTP/MySQL 验证。 |
| `public/favicon.svg` | 标签页图标。 |
| `public/api.md`、`public/api-docs.html` | 由 docs/接口文档.md 同步的接口阅读入口。 |
| `public/project-docs.html`、`public/requirements.md`、`public/study-plan.md` | 本次文档中心和下载副本，由构建脚本生成。 |

`node_modules/`、构建产物与 `.openai/` 工具配置不作为当前业务学习重点。

## 9. 每个任务怎样算完成

```text
日期：
看了哪几集：
本次要实现的需求 ID：
自己写了什么：
正常路径如何验证：
失败路径如何验证：
数据库结果：
遇到的问题与原因：
文件 / Git 提交：
下一小步：
```

同一时间只做一个主要功能。需求 → 读对应课程 → 自己实现 → 正常/失败验证 → 检查数据库 → 解释数据流 → 记录提交。

## 10. 分集索引

下面按本机课程视频文件名核对标题与编号，链接指向同一套 B 站课程。只核对了分集元数据，没有逐分钟观看或替你勾选完成。建议和产出含义见第 4–6 节。

| 集数 | 原课标题 | 建议 | 对应产出 |
| --- | --- | --- | --- |
| [P84](https://www.bilibili.com/video/BV1yGydYEE3H/?p=84) | 日志技术-Logback入门程序 | 精看基础 | S1 日志与独立检查 |
| [P85](https://www.bilibili.com/video/BV1yGydYEE3H/?p=85) | 日志技术-Logback配置文件&日志级别 | 精看基础 | S1 日志与独立检查 |
| [P86](https://www.bilibili.com/video/BV1yGydYEE3H/?p=86) | 多表关系-一对多 | 精看 | S3 多表 SQL 练习 |
| [P87](https://www.bilibili.com/video/BV1yGydYEE3H/?p=87) | 多表关系-一对一&多对多 | 精看 | S3 多表 SQL 练习 |
| [P88](https://www.bilibili.com/video/BV1yGydYEE3H/?p=88) | 多表关系-多表设计案例 | 精看 | S3 多表 SQL 练习 |
| [P89](https://www.bilibili.com/video/BV1yGydYEE3H/?p=89) | 多表查询-概述 | 精看 | S3 多表 SQL 练习 |
| [P90](https://www.bilibili.com/video/BV1yGydYEE3H/?p=90) | 多表查询-内连接&外连接 | 精看 | S3 多表 SQL 练习 |
| [P91](https://www.bilibili.com/video/BV1yGydYEE3H/?p=91) | 多表查询-子查询 | 精看 | S3 多表 SQL 练习 |
| [P92](https://www.bilibili.com/video/BV1yGydYEE3H/?p=92) | 多表查询-案例 | 精看 | S3 多表 SQL 练习 |
| [P93](https://www.bilibili.com/video/BV1yGydYEE3H/?p=93) | 员工管理-准备工作 | 快看 | 沿用当前工程 |
| [P94](https://www.bilibili.com/video/BV1yGydYEE3H/?p=94) | 员工管理-分页查询-原理分析 | 重点精看 | S2 数据库条件分页 |
| [P95](https://www.bilibili.com/video/BV1yGydYEE3H/?p=95) | 员工管理-分页查询-代码实现 | 重点精看 | S2 数据库条件分页 |
| [P96](https://www.bilibili.com/video/BV1yGydYEE3H/?p=96) | 员工管理-分页查询-PageHelper分页插件 | 理解后按需实操 | S2 先会手写分页 |
| [P97](https://www.bilibili.com/video/BV1yGydYEE3H/?p=97) | 员工管理-条件分页查询-基本实现 | 重点精看 | S2 数据库条件分页 |
| [P98](https://www.bilibili.com/video/BV1yGydYEE3H/?p=98) | 员工管理-条件分页查询-程序优化 | 重点精看 | S2 数据库条件分页 |
| [P99](https://www.bilibili.com/video/BV1yGydYEE3H/?p=99) | 员工管理-新增员工-保存员工基本信息 | 快看/按需精看 | S3 新增课程 |
| [P100](https://www.bilibili.com/video/BV1yGydYEE3H/?p=100) | 员工管理-新增员工-批量保存员工工作经历 | 重点精看 | S3 批量与事务 |
| [P101](https://www.bilibili.com/video/BV1yGydYEE3H/?p=101) | 事务管理-介绍与操作 | 重点精看 | S3 批量与事务 |
| [P102](https://www.bilibili.com/video/BV1yGydYEE3H/?p=102) | 事务管理-Spring事务管理-介绍 | 重点精看 | S3 批量与事务 |
| [P103](https://www.bilibili.com/video/BV1yGydYEE3H/?p=103) | 事务管理-Spring事务管理-进阶&事务四大特性 | 重点精看 | S3 批量与事务 |
| [P104](https://www.bilibili.com/video/BV1yGydYEE3H/?p=104) | 文件上传-介绍 | 需要上传时精看 | S5 当前 CSV 为 JSON |
| [P105](https://www.bilibili.com/video/BV1yGydYEE3H/?p=105) | 文件上传-本地存储 | 需要上传时精看 | S5 当前 CSV 为 JSON |
| [P106](https://www.bilibili.com/video/BV1yGydYEE3H/?p=106) | 文件上传-阿里云OSS-准备工作 | 暂缓 | OSS 不阻塞首版 |
| [P107](https://www.bilibili.com/video/BV1yGydYEE3H/?p=107) | 文件上传-阿里云OSS-入门程序 | 暂缓 | OSS 不阻塞首版 |
| [P108](https://www.bilibili.com/video/BV1yGydYEE3H/?p=108) | 文件上传-阿里云OSS-案例集成 | 暂缓 | OSS 不阻塞首版 |
| [P109](https://www.bilibili.com/video/BV1yGydYEE3H/?p=109) | 文件上传-阿里云OSS-程序优化(@Value&@ConfigurationProperties) | 精看配置思想 | 配置化练习 |
| [P110](https://www.bilibili.com/video/BV1yGydYEE3H/?p=110) | 员工管理-删除员工-请求参数接收 | 精看新增部分 | S5 批量删除 |
| [P111](https://www.bilibili.com/video/BV1yGydYEE3H/?p=111) | 员工管理-删除员工-逻辑实现 | 精看新增部分 | S5 批量删除 |
| [P112](https://www.bilibili.com/video/BV1yGydYEE3H/?p=112) | 员工管理-修改员工-查询回显 | 单表快看/多表精看 | S3 关联回显与修改 |
| [P113](https://www.bilibili.com/video/BV1yGydYEE3H/?p=113) | 员工管理-修改员工-修改数据 | 单表快看/多表精看 | S3 关联回显与修改 |
| [P114](https://www.bilibili.com/video/BV1yGydYEE3H/?p=114) | 员工管理-修改员工-程序优化(动态更新) | 精看 | 理解完整更新与空值 |
| [P115](https://www.bilibili.com/video/BV1yGydYEE3H/?p=115) | 全局异常处理器 | 精看，可提前 | S2 全局异常 |
| [P116](https://www.bilibili.com/video/BV1yGydYEE3H/?p=116) | 员工信息统计-职位统计-分析 | 后端精看/图表快看 | S4 成绩统计 |
| [P117](https://www.bilibili.com/video/BV1yGydYEE3H/?p=117) | 员工信息统计-职位统计-实现 | 后端精看/图表快看 | S4 成绩统计 |
| [P118](https://www.bilibili.com/video/BV1yGydYEE3H/?p=118) | 员工信息统计-性别统计 | 后端精看/图表快看 | S4 成绩统计 |
| [P119](https://www.bilibili.com/video/BV1yGydYEE3H/?p=119) | 项目实战-需求说明 | 快看后独立做 | 需求迁移练习 |
| [P120](https://www.bilibili.com/video/BV1yGydYEE3H/?p=120) | 登录认证-登录功能-实现 | 重点精看 | S4 认证与权限 |
| [P121](https://www.bilibili.com/video/BV1yGydYEE3H/?p=121) | 登录认证-登录校验-会话技术-介绍 | 重点精看 | S4 认证与权限 |
| [P122](https://www.bilibili.com/video/BV1yGydYEE3H/?p=122) | 登录认证-登录校验-会话技术-Cookie | 重点精看 | S4 认证与权限 |
| [P123](https://www.bilibili.com/video/BV1yGydYEE3H/?p=123) | 登录认证-登录校验-会话技术-Session | 重点精看 | S4 认证与权限 |
| [P124](https://www.bilibili.com/video/BV1yGydYEE3H/?p=124) | 登录认证-登录校验-会话技术-令牌方案 | 重点精看 | S4 认证与权限 |
| [P125](https://www.bilibili.com/video/BV1yGydYEE3H/?p=125) | 登录认证-登录校验-JWT-生成与校验 | 重点精看 | S4 认证与权限 |
| [P126](https://www.bilibili.com/video/BV1yGydYEE3H/?p=126) | 登录认证-登录校验-JWT-登录成功后下发令牌 | 重点精看 | S4 认证与权限 |
| [P127](https://www.bilibili.com/video/BV1yGydYEE3H/?p=127) | 登录认证-登录校验-Filter-入门 | 重点精看 | S4 认证与权限 |
| [P128](https://www.bilibili.com/video/BV1yGydYEE3H/?p=128) | 登录认证-登录校验-Filter-令牌校验Filter | 重点精看 | S4 认证与权限 |
| [P129](https://www.bilibili.com/video/BV1yGydYEE3H/?p=129) | 登录认证-登录校验-Filter-详解 | 重点精看 | S4 认证与权限 |
| [P130](https://www.bilibili.com/video/BV1yGydYEE3H/?p=130) | 登录认证-登录校验-Interceptor-入门 | 重点精看 | S4 认证与权限 |
| [P131](https://www.bilibili.com/video/BV1yGydYEE3H/?p=131) | 登录认证-登录校验-Interceptor-令牌校验Interceptor | 重点精看 | S4 认证与权限 |
| [P132](https://www.bilibili.com/video/BV1yGydYEE3H/?p=132) | 登录认证-登录校验-Interceptor-详解 | 重点精看 | S4 认证与权限 |
| [P133](https://www.bilibili.com/video/BV1yGydYEE3H/?p=133) | SpringAOP-基础-AOP入门程序 | 理解并做小例子 | AOP 基础 |
| [P134](https://www.bilibili.com/video/BV1yGydYEE3H/?p=134) | SpringAOP-基础-核心概念 | 理解并做小例子 | AOP 基础 |
| [P135](https://www.bilibili.com/video/BV1yGydYEE3H/?p=135) | SpringAOP-进阶-通知类型 | 先快看，案例后补 | S5 审计 |
| [P136](https://www.bilibili.com/video/BV1yGydYEE3H/?p=136) | SpringAOP-进阶-通知顺序 | 先快看，案例后补 | S5 审计 |
| [P137](https://www.bilibili.com/video/BV1yGydYEE3H/?p=137) | SpringAOP-进阶-切入点表达式 | 先快看，案例后补 | S5 审计 |
| [P138](https://www.bilibili.com/video/BV1yGydYEE3H/?p=138) | SpringAOP-进阶-连接点JoinPoint | 先快看，案例后补 | S5 审计 |
| [P139](https://www.bilibili.com/video/BV1yGydYEE3H/?p=139) | SpringAOP-案例-记录操作日志 | 先快看，案例后补 | S5 审计 |
| [P140](https://www.bilibili.com/video/BV1yGydYEE3H/?p=140) | SpringAOP-案例-获取当前登录员工 | 先快看，案例后补 | S5 审计 |
| [P141](https://www.bilibili.com/video/BV1yGydYEE3H/?p=141) | 原理篇-SpringBoot配置优先级 | 理解基础 | 原理回顾 |
| [P142](https://www.bilibili.com/video/BV1yGydYEE3H/?p=142) | 原理篇-Bean管理 | 理解基础 | 原理回顾 |
| [P143](https://www.bilibili.com/video/BV1yGydYEE3H/?p=143) | 原理篇-SpringBoot原理-起步依赖原理 | 理解基础 | 原理回顾 |
| [P144](https://www.bilibili.com/video/BV1yGydYEE3H/?p=144) | 原理篇-SpringBoot原理-自动配置-两种方案 | 理解基础 | 原理回顾 |
| [P145](https://www.bilibili.com/video/BV1yGydYEE3H/?p=145) | 原理篇-SpringBoot原理-自动配置-源码跟踪 | 暂缓 | 首版之后补 |
| [P146](https://www.bilibili.com/video/BV1yGydYEE3H/?p=146) | 原理篇-SpringBoot原理-自动配置-源码跟踪(@Conditional) | 暂缓 | 首版之后补 |
| [P147](https://www.bilibili.com/video/BV1yGydYEE3H/?p=147) | 原理篇-SpringBoot原理-自动配置-自定义starter | 暂缓 | 首版之后补 |
| [P148](https://www.bilibili.com/video/BV1yGydYEE3H/?p=148) | Maven高级-分模块设计与开发 | 暂缓 | 首版之后补 |
| [P149](https://www.bilibili.com/video/BV1yGydYEE3H/?p=149) | Maven高级-继承 | 暂缓 | 首版之后补 |
| [P150](https://www.bilibili.com/video/BV1yGydYEE3H/?p=150) | Maven高级-聚合 | 暂缓 | 首版之后补 |
| [P151](https://www.bilibili.com/video/BV1yGydYEE3H/?p=151) | Maven高级-私服 | 暂缓 | 首版之后补 |
| [P152](https://www.bilibili.com/video/BV1yGydYEE3H/?p=152) | Web后端开发-总结 | 看总结 | 复述数据流 |
| [P153](https://www.bilibili.com/video/BV1yGydYEE3H/?p=153) | Vue工程化-介绍&环境准备 | 当前跳过/按需查 | 沿用 React |
| [P154](https://www.bilibili.com/video/BV1yGydYEE3H/?p=154) | Vue工程化-vue项目介绍&开发流程 | 当前跳过/按需查 | 沿用 React |
| [P155](https://www.bilibili.com/video/BV1yGydYEE3H/?p=155) | Vue工程化-API风格&案例 | 当前跳过/按需查 | 沿用 React |
| [P156](https://www.bilibili.com/video/BV1yGydYEE3H/?p=156) | ElementPlus-快速入门 | 当前跳过/按需查 | 沿用 React |
| [P157](https://www.bilibili.com/video/BV1yGydYEE3H/?p=157) | ElementPlus-常见组件-表格组件&分页组件 | 当前跳过/按需查 | 沿用 React |
| [P158](https://www.bilibili.com/video/BV1yGydYEE3H/?p=158) | ElementPlus-常见组件-对话框组件&表单组件 | 当前跳过/按需查 | 沿用 React |
| [P159](https://www.bilibili.com/video/BV1yGydYEE3H/?p=159) | ElementPlus-案例 | 当前跳过/按需查 | 沿用 React |
| [P160](https://www.bilibili.com/video/BV1yGydYEE3H/?p=160) | Tlias案例-准备工作 | 当前跳过/按需查 | 沿用 React |
| [P161](https://www.bilibili.com/video/BV1yGydYEE3H/?p=161) | Tlias案例-整体布局-动态菜单(VueRouter) | 当前跳过/按需查 | 沿用 React |
| [P162](https://www.bilibili.com/video/BV1yGydYEE3H/?p=162) | Tlias案例-整体布局-动态菜单(VueRouter-嵌套路由) | 当前跳过/按需查 | 沿用 React |
| [P163](https://www.bilibili.com/video/BV1yGydYEE3H/?p=163) | Tlias案例-部门管理-列表查询 | 当前跳过/按需查 | 沿用 React |
| [P164](https://www.bilibili.com/video/BV1yGydYEE3H/?p=164) | Tlias案例-部门管理-列表查询-程序优化 | 当前跳过/按需查 | 沿用 React |
| [P165](https://www.bilibili.com/video/BV1yGydYEE3H/?p=165) | Tlias案例-部门管理-新增部门 | 当前跳过/按需查 | 沿用 React |
| [P166](https://www.bilibili.com/video/BV1yGydYEE3H/?p=166) | Tlias案例-部门管理-修改&删除部门 | 当前跳过/按需查 | 沿用 React |
| [P167](https://www.bilibili.com/video/BV1yGydYEE3H/?p=167) | Tlias案例-员工管理-列表查询-页面布局(搜索栏) | 当前跳过/按需查 | 沿用 React |
| [P168](https://www.bilibili.com/video/BV1yGydYEE3H/?p=168) | Tlias案例-员工管理-列表查询-页面布局(搜索栏-watch侦听) | 当前跳过/按需查 | 沿用 React |
| [P169](https://www.bilibili.com/video/BV1yGydYEE3H/?p=169) | Tlias案例-员工管理-列表查询-页面布局(表格) | 当前跳过/按需查 | 沿用 React |
| [P170](https://www.bilibili.com/video/BV1yGydYEE3H/?p=170) | Tlias案例-员工管理-列表查询-页面交互 | 当前跳过/按需查 | 沿用 React |
| [P171](https://www.bilibili.com/video/BV1yGydYEE3H/?p=171) | Tlias案例-员工管理-新增员工-页面布局(引入) | 当前跳过/按需查 | 沿用 React |
| [P172](https://www.bilibili.com/video/BV1yGydYEE3H/?p=172) | Tlias案例-员工管理-新增员工-页面布局(展示优化) | 当前跳过/按需查 | 沿用 React |
| [P173](https://www.bilibili.com/video/BV1yGydYEE3H/?p=173) | Tlias案例-员工管理-新增员工-页面交互(工作经历) | 当前跳过/按需查 | 沿用 React |
| [P174](https://www.bilibili.com/video/BV1yGydYEE3H/?p=174) | Tlias案例-员工管理-新增员工-页面交互(保存员工) | 当前跳过/按需查 | 沿用 React |
| [P175](https://www.bilibili.com/video/BV1yGydYEE3H/?p=175) | Tlias案例-员工管理-修改员工-修改数据 | 当前跳过/按需查 | 沿用 React |
| [P176](https://www.bilibili.com/video/BV1yGydYEE3H/?p=176) | Tlias案例-员工管理-删除员工-批量删除 | 当前跳过/按需查 | 沿用 React |
| [P177](https://www.bilibili.com/video/BV1yGydYEE3H/?p=177) | Tlias案例-登录-登录功能实现 | 看流程，迁移 React | S4 登录交互 |
| [P178](https://www.bilibili.com/video/BV1yGydYEE3H/?p=178) | Tlias案例-登录-携带令牌访问服务端 | 看流程，迁移 React | S4 登录交互 |
| [P179](https://www.bilibili.com/video/BV1yGydYEE3H/?p=179) | Tlias案例-登录-响应401跳转登录页面 | 看流程，迁移 React | S4 登录交互 |
| [P180](https://www.bilibili.com/video/BV1yGydYEE3H/?p=180) | Tlias案例-退出-功能实现 | 看流程，迁移 React | S4 登录交互 |
| [P181](https://www.bilibili.com/video/BV1yGydYEE3H/?p=181) | Tlias案例-打包部署 | 构建时看 | S5 前端打包 |
| [P182](https://www.bilibili.com/video/BV1yGydYEE3H/?p=182) | Linux-概述-介绍&系统安装 | 快看/按需 | S5 部署准备 |
| [P183](https://www.bilibili.com/video/BV1yGydYEE3H/?p=183) | Linux-概述-远程连接&目录结构 | 部署时精看 | S5 Linux 操作 |
| [P184](https://www.bilibili.com/video/BV1yGydYEE3H/?p=184) | Linux-常用命令-目录&文件操作命令 | 部署时精看 | S5 Linux 操作 |
| [P185](https://www.bilibili.com/video/BV1yGydYEE3H/?p=185) | Linux-常用命令-拷贝移动&打包压缩命令 | 部署时精看 | S5 Linux 操作 |
| [P186](https://www.bilibili.com/video/BV1yGydYEE3H/?p=186) | Linux-常用命令-文本编辑&查找命令 | 部署时精看 | S5 Linux 操作 |
| [P187](https://www.bilibili.com/video/BV1yGydYEE3H/?p=187) | Linux-软件安装-JDK安装 | 按部署方式看 | 避免重复安装 |
| [P188](https://www.bilibili.com/video/BV1yGydYEE3H/?p=188) | Linux-软件安装-MySQL安装&防火墙 | 按部署方式看 | 避免重复安装 |
| [P189](https://www.bilibili.com/video/BV1yGydYEE3H/?p=189) | Linux-软件安装-Nginx安装 | 部署时精看 | S5 真实部署验证 |
| [P190](https://www.bilibili.com/video/BV1yGydYEE3H/?p=190) | Linux-项目部署 | 部署时精看 | S5 真实部署验证 |
| [P191](https://www.bilibili.com/video/BV1yGydYEE3H/?p=191) | Docker-入门-MySQL安装 | 部署时精看 | S5 真实部署验证 |
| [P192](https://www.bilibili.com/video/BV1yGydYEE3H/?p=192) | Docker-入门-命令解读 | 部署时精看 | S5 真实部署验证 |
| [P193](https://www.bilibili.com/video/BV1yGydYEE3H/?p=193) | Docker-核心-常见命令 | 部署时精看 | S5 真实部署验证 |
| [P194](https://www.bilibili.com/video/BV1yGydYEE3H/?p=194) | Docker-核心-数据卷挂载 | 部署时精看 | S5 真实部署验证 |
| [P195](https://www.bilibili.com/video/BV1yGydYEE3H/?p=195) | Docker-核心-本地目录挂载 | 部署时精看 | S5 真实部署验证 |
| [P196](https://www.bilibili.com/video/BV1yGydYEE3H/?p=196) | Docker-核心-自定义镜像 | 部署时精看 | S5 真实部署验证 |
| [P197](https://www.bilibili.com/video/BV1yGydYEE3H/?p=197) | Docker-核心-网络 | 部署时精看 | S5 真实部署验证 |
| [P198](https://www.bilibili.com/video/BV1yGydYEE3H/?p=198) | Docker-部署-服务端&前端部署 | 部署时精看 | S5 真实部署验证 |
| [P199](https://www.bilibili.com/video/BV1yGydYEE3H/?p=199) | Docker-部署-DockerCompose | 部署时精看 | S5 真实部署验证 |
| [P200](https://www.bilibili.com/video/BV1yGydYEE3H/?p=200) | Web开发-完结 | 看总结 | 无需等待本集起投 |
