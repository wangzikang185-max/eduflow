# 学序 EduFlow · 教务管理系统 V2

版本 2.0.0 · 更新：2026-10-24。[需求](需求文档.md) · [接口](接口文档.md) · [学习规划](学习规划.md)。

## 1. 项目介绍

学序是面向管理员、教师和学生的教务管理系统，使用 React/TypeScript 构建前端，以 Java 21、Spring Boot、MyBatis 和 MySQL 实现后端。系统贯通“班级维护 → 学生建档 → 开课与教师授权 → 独立选课 → 多次考试与成绩 → 课堂考勤 → 综合学业报表”，并提供学生自助门户、CSV 导入导出和服务端操作审计。

项目从学生单表 CRUD 扩展为有真实认证、数据范围控制、跨表事务和并发冲突处理的 V2。所有正式页面调用 Java HTTP 接口，业务数据写入 MySQL。旧 mock 前端保留作学习对照，正式入口不使用它。

## 2. 技术栈解决了哪些问题

代码定位以项目根目录 `xuexu/` 为起点；`文件路径:行号` 对应 2026-10-24 当前源码，箭头后为应搜索的方法、变量或 SQL 常量。后续修改导致行号移动时，以符号名称定位。每项同时指出入口、关键逻辑或验证位置，避免只列目录名。

阅读时先看“具体问题”的业务场景，再按“实现方式”的编号追踪处理过程，最后沿证据定位代码。表中的人数、分数和版本数字用于解释机制，不是当前数据库统计或性能测试结果。

| 技术 | 具体问题 | 实现方式 | 可核查证据 |
| --- | --- | --- | --- |
| React 19 + TypeScript | 学生、课程、成绩等页面都需要加载数据、提交表单和显示错误。若每页各写一套，容易把 studentNo 写成别的字段名，或者遗漏登录令牌与超时处理。教师录入一半成绩后切换课程，还可能丢失尚未保存的修改；不同角色也需要看到各自的功能菜单。 | ① TypeScript 定义学生、课程及 `Page<T>` 等类型，在开发和编译阶段检查字段与组件参数；实际输入仍由后端校验。<br>② `request<T>` 统一附带 Bearer 令牌、解析响应、处理 20 秒超时与 401 失效，页面直接使用返回的 data。<br>③ useResource、Editor、Table 复用加载、错误、表单和表格行为，角色菜单集中管理。<br>④ 草稿与已保存数据分开，通过 dirty 判断是否修改；切换前确认，保存失败时保留草稿。 | `frontend/src/v2/client.ts:124` → `request<T>` 统一请求；`client.ts:37` → `Page<T>` 分页类型。<br>`frontend/src/v2/shared.tsx:12` → `useResource` 加载/错误状态；同文件第 96 行 `Editor`、第 266 行 `Table`。<br>`frontend/src/v2/WorkspaceApp.tsx:206` → `available` 按角色筛选菜单。<br>`frontend/src/v2/Assessment.tsx:61` → `dirty` 判断未保存成绩草稿。 |
| Vite + 同源 /api 代理 | 开发页面在 5173，Java 接口在 8081，浏览器直接请求不同端口会涉及跨域。若每个页面都写死 http://127.0.0.1:8081，换端口或部署后就要到处修改，容易出现页面能打开、接口却连错地址的问题。 | ① 页面统一请求 /api/students 等相对地址，浏览器先访问提供页面的同一站点。<br>② 开发时 Vite 把请求转发到 API_TARGET 指定的后端，并去掉 /api 前缀，例如 /api/students → Java 的 /students。<br>③ 本机 5180 产物服务器提供相同转发规则，仓库另提供 Nginx 配置供容器部署使用。<br>页面代码与具体后端地址分开，切换环境主要调整代理配置。 | `frontend/vite.config.ts:9` → `server.proxy`，第 11 行 `target`、第 13 行 `rewrite`。<br>`frontend/nginx.conf:9` → `/api/` 的 `proxy_pass`。<br>`tools/serve-production.mjs:36` → `/api` 分支和上游转发。 |
| Spring Boot + 分层 Java | 新增一个学生，既要读取姓名和手机号，又要判断班级是否存在、学号是否重复，最后才能写数据库。如果都混在一个 HTTP 方法里，发生“添加失败”时很难定位是参数、业务规则还是 SQL 的问题，不同接口也容易重复编写相同规则。 | ① Controller 是 HTTP 入口，接收路径、查询参数和请求体，再调用业务方法。<br>② Service 负责“允不允许这样做”：校验字段和权限、组织数据库操作，并划定事务范围。<br>③ Mapper/数据库访问层执行绑定参数的 SQL，页面不直接操作数据库。<br>④ 全局异常处理把输入错误、目标不存在、版本冲突等映射为对应 HTTP 状态和统一的 code/msg/data，前端按同一种格式显示结果。 | `backend/src/main/java/com/xuexu/controller/StudentController.java:30` → `list` 接参。<br>`backend/src/main/java/com/xuexu/service/impl/StudentServiceImpl.java:32` → `findPage` 校验和业务编排。<br>`backend/src/main/java/com/xuexu/mapper/StudentMapper.java:26` → `page` 绑定 SQL 参数。<br>`backend/src/main/java/com/xuexu/controller/GlobalErrors.java:40` → `duplicate`；第 59 行 `unexpected` 统一异常响应。 |
| Spring Security + JWT + BCrypt | 前端隐藏“删除学生”按钮，仍无法阻止用户自己构造删除请求。教师可能把课程 A 的 URL 改成课程 B，学生可能提交别人的 studentId。后端必须同时确认“你是谁”和“你能访问哪一条数据”，账户密码也不能明文保存。 | ① 登录时用 BCrypt 核对密码哈希；数据库保存带盐哈希，验证时不需要还原明文密码。<br>② 服务器签发 JWT，前端请求时携带令牌；Spring Security 检查签名、发行者（issuer）、有效期和账户启用状态。<br>③ CurrentUser 从真实账户取得角色，在查询和课程操作中检查教师的授权范围。<br>④ 学生门户按账户绑定的 student_id 限定本人，权限范围不由前端提交的角色或学生 ID 决定。 | `backend/src/main/java/com/xuexu/security/SecurityConfig.java:24` → `passwordEncoder`；第 41 行 `decoder`；第 66 行 `filterChain`。<br>`backend/src/main/java/com/xuexu/service/AuthService.java:38` → `login` 检查密码并签发 JWT。<br>`backend/src/main/java/com/xuexu/security/CurrentUser.java:45` → `course` 检查课程权限；第 53 行 `scope` 取得真实身份范围。 |
| token_version | JWT 在有效期内通常仍能通过签名检查。如果退出时只清除浏览器中的令牌，另一处保存的旧令牌仍可能继续使用。用户改密或管理员停用账户后，也希望旧登录马上失效，而不必等待令牌自然过期。 | ① 账户表保存 token_version，登录时把当前值写入 JWT 的 ver。<br>② 每次请求除了验签，还比较 JWT ver 与数据库最新版本，并检查 enabled。例如两边都是 3 时允许访问；退出或改密后数据库变成 4，旧令牌 3 随即被拒绝。<br>③ 退出、改密及账户更新通过 SQL 递增版本。<br>这是账户级撤销：该账户此前的全部旧令牌都会失效；为了及时生效，验证过程需要查询数据库状态。 | `backend/src/main/java/com/xuexu/security/SecurityConfig.java:41` → `decoder` 内比较 `ver` 与 `tokenVersion`。<br>`backend/src/main/java/com/xuexu/controller/AuthController.java:44` → `logout`。<br>`backend/src/main/java/com/xuexu/service/AuthService.java:116` → `passwordChange`；第 124 行 `updateUser`。<br>`backend/src/main/java/com/xuexu/mapper/WorkspaceSql.java:59` → `USER_UPDATE`；第 63 行 `PASSWORD`；第 66 行 `LOGOUT`，均递增版本。 |
| MyBatis + MySQL LIMIT/OFFSET | 假设有 1 万名学生，页面只显示第 3 页的 10 人：若先查询所有学生，再用 Java 筛选和切片，服务仍要加载大量暂时用不到的数据。总人数查询与当前页使用不同筛选或权限条件，还会让分页显示对不上。 | ① SQL 的 WHERE 统一组合关键词、班级、学籍和教师授权范围。<br>② COUNT 查询符合条件的总数，LIMIT/OFFSET 只取当前页；每页 10 人、第 3 页时 offset=(3-1)×10=20，两次查询共用筛选条件。<br>③ 按 create_time、id 倒序，保证同一创建时间的记录也有明确顺序；用户输入通过 `#{参数}` 绑定到固定 SQL。<br>本项针对学生目录，减少 Java 加载的记录；其他部分名单和报表仍有前端分页，项目没有大规模性能实测。 | `backend/src/main/java/com/xuexu/mapper/StudentMapper.java:13` → `FILTER` 共用筛选条件；第 26 行 `page`；第 35 行 `count`。<br>`backend/src/main/java/com/xuexu/service/impl/StudentServiceImpl.java:32` → `findPage` 计算 offset、传入教师范围。<br>`backend/src/test/java/com/xuexu/StudentServiceTest.java:63` → `paginationIsDelegatedToDatabaseAndNeverLoadsAll`；第 79 行验证教师范围与联系方式脱敏。 |
| InnoDB 行锁 + READ COMMITTED | 课程容量 30 人、当前有 29 人。甲乙同时选课，若都先读到 29，再各自判断“还能加入 1 人”，两次判断都通过，最终可能变成 31 人。“先查人数、再插入”的多步代码不会自动成为一个不可插队的操作。 | ① 选课事务用 `SELECT ... FOR UPDATE` 锁住同一门课程的记录，让修改这门课名额的请求依次处理；不是锁住整个数据库。<br>② 拿到锁后查询人数、检查容量，再写入选课关系和各次考试的空成绩，最后提交并释放锁。<br>③ READ COMMITTED 让等待锁的请求随后统计人数时，能看到上一事务已提交的结果。<br>甲成功后人数为 30，乙再检查就被拒绝：锁负责排队，隔离级别负责读取可见性，两者配合。 | `backend/src/main/java/com/xuexu/service/AcademicService.java:159` → `enroll` 的隔离级别注解及方法，先 `course(id)` 再查人数。<br>`backend/src/main/java/com/xuexu/mapper/WorkspaceSql.java:33` → `COURSE` 的 `FOR UPDATE`；第 76 行 `ENROLLED` 人数统计。<br>`backend/src/main/resources/application.yml:10` → 连接池隔离级别。<br>`tools/verify_v2.py:123` 附近 → 最后一个名额并发验收断言。 |
| version 乐观锁 | 两位教师同时打开同一条成绩，都读到 80 分、version=3。甲先保存为 85 分，乙随后还拿旧页面提交 75 分。若只按成绩 ID 更新，乙会覆盖甲的新结果，双方却没有收到冲突提示。 | ① 前端保存时附带当初读取的 version。<br>② SQL 同时匹配记录 ID 与旧版本，例如 `WHERE id=? AND version=3`；成功后把版本增加到 4。<br>③ 乙继续提交 3 时，更新影响 0 行，Service 识别出陈旧数据，返回 HTTP 409。<br>④ 前端保留失败草稿，提示重新加载后处理差异，不自动覆盖。相当于保存时检查“你看到的那一版是否仍是最新”，无需在用户整个编辑期间一直占着数据库锁。 | `backend/src/main/java/com/xuexu/mapper/StudentMapper.java:60` → 学生 `update` 的版本条件。<br>`backend/src/main/java/com/xuexu/mapper/WorkspaceSql.java:112` → `GRADE_UPDATE`；第 121 行 `SHEET_UPDATE`。<br>`backend/src/main/java/com/xuexu/service/AcademicService.java:266` → `saveGrades`；第 336 行 `saveAttendance`，检查更新结果并抛出冲突。<br>`backend/src/test/java/com/xuexu/StudentServiceTest.java:91` → `staleStudentDoesNotReportSuccess`。 |
| Spring 事务 + 唯一索引/CHECK | 批量保存 20 条成绩，前 10 条成功、第 11 条发现版本冲突，若前面已经提交，一次点击就只成功了一半。两次新增请求还可能同时通过“学号不存在”的检查，随后插入相同学号；单靠 Java 的事前判断兜不住这种竞争。 | ① 先检查整批数据的格式、身份、范围及重复项，再开始写入。<br>② @Transactional 将一批写入放在同一事务；任一项抛出异常，包括写到中途才发现版本过期，前面的修改也一起回滚。<br>③ 唯一索引/主键兜住学号、选课和每次考试成绩的重复，CHECK 兜住配置的合法数值范围；并发绕过事前检查时仍由数据库拒绝。<br>④ 关联删除由 Service 在事务中显式清理；本项目未设外键，不能依赖数据库自动级联删除。 | `backend/src/main/java/com/xuexu/service/impl/StudentServiceImpl.java:102` → `deleteMany` 事务；第 126 行 `importCsv` 事务。<br>`backend/src/main/java/com/xuexu/service/AcademicService.java:265` → `saveGrades` 事务；第 335 行 `saveAttendance` 事务。<br>`backend/src/main/resources/db/migration/V1__workspace_baseline.sql:34` → 学号唯一索引；第 64 行起为课程 CHECK。<br>`backend/src/main/resources/db/migration/V2__academic_workspace.sql:27` → 课程内考试名称唯一；第 34 行起调整考试成绩唯一关系。 |
| 独立 enrollment/exam 模型 | “教师获准管理这门课”和“学生选了这门课”是两种关系，不能混用授权表。所有学生自动关联所有课程会让名单失真；成绩只按学生和课程保存一条，则无法分别表达平时考核、期中和期末考试。 | ① enrollment 保存学生—课程选课关系，user_course 单独保存教师—课程操作授权。<br>② exam 保存同一课程下不同考试的日期和权重，grade 按 exam_id + student_id 保持唯一，同一学生同一课程可以有多次考试成绩。<br>③ 新选课时初始化这门课各次考试的 null 成绩，表示尚未录入；新增考试也为已有选课学生初始化空成绩。<br>④ 人数从 enrollment 统计，课程页面不能提交一个人数覆盖真实选课关系。 | `backend/src/main/resources/db/migration/V2__academic_workspace.sql:14` → `eduflow_enrollment`；第 24 行 `eduflow_exam`；第 34 行成绩关系迁移。<br>`backend/src/main/java/com/xuexu/service/AcademicService.java:160` → `enroll`；第 203 行 `saveExam`。<br>`backend/src/main/java/com/xuexu/mapper/WorkspaceSql.java:83` → `ENROLL_GRADES` 为新增选课初始化每次考试的空成绩。 |
| SQL 多表聚合 + BigDecimal/DECIMAL | 0 分是已经录入的真实成绩，空分是尚未录入，混用会算错完成度和均分。多次考试也不能总取简单平均：平时 80 分、权重 40，期末 100 分、权重 60，加权结果应为 92。点名页面预填但未保存的状态，也不能当作真实出勤记录。 | ① DECIMAL(5,2) 保存成绩，Java 用 BigDecimal 校验 0–100 范围及最多两位小数，减少十进制精度与非法输入问题。<br>② SQL 联查选课、学生、课程、考试和成绩，按 Σ(已录入分数×权重) / Σ(已录入考试权重) 计算，四舍五入到两位。未录入不进分母，0 分参与计算，全未录入返回 null；上例只有平时成绩时结果为 80，不会当作 32。<br>③ 出勤率只统计已保存明细；按本项目口径，present/late 计入出勤数，全部已保存点名明细作分母，并按授权范围与日期筛选。 | `backend/src/main/java/com/xuexu/mapper/WorkspaceSql.java:156` → `REPORT` 的 `SUM/COUNT/NULLIF/ROUND` 加权聚合。<br>`backend/src/main/java/com/xuexu/service/ReportService.java:28` → `report` 处理出勤率与授权范围；第 55 行 `overview`。<br>`backend/src/main/java/com/xuexu/service/Rules.java:37` → `decimal` 使用 BigDecimal 校验范围、小数位和步长。<br>`backend/src/main/java/com/xuexu/service/AcademicService.java:266` → `saveGrades` 区分 null 与实际分数。 |
| Apache Commons CSV + 全批事务 | CSV 的带引号字段可以包含逗号和换行，例如“王,小明”仍可能只占一个姓名字段；直接按每个逗号或换行拆分会拆错记录。文件还可能带 BOM、重复学号或错误日期；导出内容以 = 等符号开头时，表格软件可能把它当公式。 | ① Apache Commons CSV 按格式识别引号、逗号、字段内换行和双引号转义，去掉开头 UTF-8 BOM，并核对固定的 8 列表头。<br>② 限制内容不超过 2 MiB、单次最多 500 条；按 CSV 记录号定位错误，字段内换行不另算一条记录。<br>③ 检查所有记录的字段、文件内重复和已有学号，全部通过后才批量写入；同一事务兜住写入阶段的异常。<br>④ 导出给字段加引号、转义内部双引号，对可能被识别为公式的开头加单引号前缀。 | `backend/src/main/java/com/xuexu/service/impl/StudentServiceImpl.java:127` → `importCsv` 中 CSVFormat/CSVParser、表头与全量校验。<br>`frontend/src/lib/domain.ts:39` → `csvCell` 转义与公式保护；第 44 行 `studentCSV` 固定导出模板。<br>`backend/src/test/java/com/xuexu/StudentServiceTest.java:127` → `csvValidationCompletesBeforeFirstWrite`；第 138 行验证大小写重复。 |
| Flyway | 项目原先已有学生和主键，升级时要增加班级、选课、考试及版本字段，不能为了换结构就丢掉旧数据。手工执行 ALTER 时，又容易记不清哪些库已经改过，造成重复执行或不同环境之间的结构不一致。 | ① 把结构演进保存为带版本号的 V1、V2 SQL，用 flyway_schema_history 记录执行历史与校验信息。<br>② 对本项目已适配的旧非空库建立 baseline 0，再依次执行兼容迁移；V1 保留已有学生表，V2 增加新模型，把已有成绩/考勤关系迁到选课和默认考试中。<br>③ 启动时验证历史，只执行尚未执行的版本；之后改表应新增迁移文件，不随意修改已执行的版本。<br>目标是升级可追踪、原学生 ID 和资料保留；升级前仍要备份，不能假设 MySQL 改表能整段回滚。 | `backend/src/main/resources/application.yml:11` → `spring.flyway` 的 baseline 配置。<br>`backend/src/main/resources/db/migration/V1__workspace_baseline.sql:1` → 兼容已有学生表的基线结构。<br>`backend/src/main/resources/db/migration/V2__academic_workspace.sql:14` → 显式选课迁移；第 24 行考试表及其后成绩迁移。<br>数据库执行历史核对 `flyway_schema_history`；历史升级/恢复结果见本文档中心“验收记录”的迁移恢复附件。 |
| REQUIRES_NEW 审计 + Logback | 这里包含两类问题：一是失败审计若和业务共用事务，业务回滚时“这次改分失败了”的记录也可能消失；二是同步向控制台写日志时，终端暂停或不再消费输出，可能让请求线程一直等待，表现为页面请求超时。 | ① 请求完成后拦截器汇总操作者、动作、目标及 HTTP 结果，通过 REQUIRES_NEW 独立事务保存审计，使业务回滚失败的记录仍能留下。单目标变更只保存存在性/版本摘要，不是逐分值历史。<br>② Logback 全局使用 INFO，日志文件按天及 10MB 大小滚动，保留 30 天。<br>③ 控制台走容量 256 的异步队列，neverBlock=true；队列满时允许丢控制台副本，让业务线程继续，文件通道保留对应日志。数据库审计用于业务留痕，运行日志用于诊断故障。 | `backend/src/main/java/com/xuexu/security/AuditConfig.java:72` → `afterCompletion` 调用审计；第 28 行 `snapshot`。<br>`backend/src/main/java/com/xuexu/service/AuditService.java:18` → `REQUIRES_NEW` 与 `record`。<br>`backend/src/main/resources/logback.xml:13` → `ASYNC_STDOUT`；第 22 行滚动文件；第 39 行 root。<br>`backend/src/test/java/com/xuexu/ConsoleLoggingTest.java:26` → 模拟控制台堵塞，验证 1000 条记录不拖住业务且全部写文件。 |
| JUnit/Mockito/MockMvc + 真实 HTTP/MySQL + 浏览器 | 编译通过只说明代码能够构建，不能单独证明权限、数据库回滚和页面都正确。模拟 Service 返回成功，测不到真实 MySQL 的约束和名额竞争；即使后端接口正确，前端也可能仍有保存、筛选、草稿或刷新回显的问题。 | ① JUnit/Mockito 检查业务分支和调用行为，例如校验失败前没有写库、分页交给 Mapper、旧版本不返回成功。<br>② MockMvc 模拟 HTTP 请求，核对参数、状态码和响应结构；学生接口测试使用模拟 Service，不冒充真实数据库集成测试。<br>③ 独立测试库启动真实 Java 服务，用 HTTP 脚本验证并发选课、批量回滚、401/403 及令牌撤销等 13 组场景。<br>④ 浏览器核对新增、录分、点名、角色范围和保存回显；各层结果分别记录，历史通过不等于本次重测，也不等于吞吐压测。 | `backend/src/test/java/com/xuexu/StudentHttpTest.java:32` → `setup` 用模拟 Service 组装 MockMvc；第 38 行列表响应测试。<br>`backend/src/test/java/com/xuexu/StudentServiceTest.java:63` → 数据库分页委托；第 91 行陈旧版本；第 127 行 CSV 写入前校验。<br>`tools/verify_v2.py:30` → 真实 HTTP 调用；第 50 行并发工具；第 123/161 行附近为容量竞争和批量回滚验收。<br>`docs/验收记录.md` 第 2 节保存浏览器实测；第 4 节给出重新验收步骤，历史结果不等同本轮全量重测。 |

### 2.1 技术栈快速学习路线（中文视频）

本路线用于理解上表技术为什么存在、如何解决学序中的问题。先学数据库分页 → 事务与约束 → 行锁与隔离级别 → 乐观锁 → 登录权限 → 测试，再补前端和辅助工具。课程只看指定章节；表中“建议投入”是第一轮学习时间，不是整套视频长度。

视频依据页面、简介和选集目录筛选，未逐条完整观看。链接与章节整理于 2026-10-24，选集变化时以章节标题为准。看完还应回到实际代码验证，不能把视频观看或 AI 已生成代码等同于个人掌握。

#### 先学：后端核心

| 技术 | 中文视频与观看范围 | 学完应能解释 | 建议投入 |
| --- | --- | --- | --- |
| MyBatis + MySQL LIMIT/OFFSET | [Tilas P94–95：分页原理与实现](https://www.bilibili.com/video/BV1yGydYEE3H/?p=94) | COUNT 和当前页查询为什么分开；offset=(page-1)×pageSize；为什么不先把全表查进 Java 内存 | 30–45 分钟 |
| Spring 事务 + 唯一约束/CHECK | [Tilas P101–103：事务](https://www.bilibili.com/video/BV1yGydYEE3H/?p=101)；[黑马 MySQL](https://www.bilibili.com/video/BV1Kr4y1i7ru/)基础篇的约束部分 | 批量导入中途失败为什么要全部回滚；为什么 Service 校验后还需要数据库约束 | 60–90 分钟 |
| InnoDB 行锁 + READ COMMITTED | [黑马 MySQL 并发事务与隔离级别](https://www.bilibili.com/video/BV1Kr4y1i7ru/?p=54)；[行锁专题第 8–9 节](https://www.bilibili.com/video/BV1Z8411F7M3/?p=8) | 两人抢最后一个名额时，FOR UPDATE 如何让操作排队；READ COMMITTED 下普通查询的可见性 | 45–60 分钟 |
| version 乐观锁 | [尚硅谷 MyBatis-Plus](https://www.bilibili.com/video/BV12R4y157Be/)，选看标题编号 45–47 | 两人读到同一个旧版本时，UPDATE WHERE id=? AND version=? 为什么只允许一次成功 | 20–30 分钟 |
| Spring Security + JWT + BCrypt | [三更草堂 Spring Security](https://www.bilibili.com/video/BV1mm4y1X7Hc/)，先看标题编号 04、06、08、13、14、23–24（编号从 00 开始，非播放器 P 编号） | 身份认证和权限校验的区别；JWT 验签与有效期；BCrypt 如何验证密码 | 60–90 分钟 |
| JUnit + Mockito + MockMvc | [Mockito + JUnit 5 快速入门](https://www.bilibili.com/video/BV15S4y1F7Xr/)，约 25 分钟；[图灵 Spring Boot 课程](https://www.bilibili.com/video/BV1aU4y187uT/)中 MockMVC 一节，约 23 分钟 | 断言、模拟依赖、接口格式测试分别做什么；为什么还要连接真实 MySQL 验证 | 60–90 分钟 |

MyBatis-Plus 视频只用于理解乐观锁原理；当前学序使用 MyBatis 手写版本条件更新，无需为看视频而引入插件。三更课程是较早版本，重点学习流程；项目使用 Spring Boot 4，实际配置对照 SecurityConfig 中的 SecurityFilterChain，保留当前依赖体系。

#### 再补：前端、数值与辅助工具

| 技术 | 中文视频与范围 | 第一轮目标 |
| --- | --- | --- |
| TypeScript | [尚硅谷：三小时快速上手 TypeScript](https://www.bilibili.com/video/BV1YS411w7Bf/)；先上篇，再补 interface/type、联合类型、可选属性和泛型 | 看懂接口返回类型和组件参数；暂缓装饰器 |
| Vite + 同源 /api 代理 | [付金权的 Vite 课程](https://www.bilibili.com/video/BV1GN4y1M7P5/)中“跨域原理简单了解以及 vite 配置跨域”，约 42 分钟；部署时补 [Tilas P189–190](https://www.bilibili.com/video/BV1yGydYEE3H/?p=189) | 画出浏览器 → Vite/Nginx → Java 的请求路径；区分开发代理和生产部署 |
| BigDecimal / DECIMAL | [黑马 Java 进阶](https://www.bilibili.com/video/BV1TE41177mP/)中“BigDecimal解决精度运算问题”，约 8 分钟；DECIMAL 对照 MySQL 数据类型章节 | 理解浮点误差、精确十进制计算和舍入；区分 0 与 null |
| Logback | [Tilas P84–85](https://www.bilibili.com/video/BV1yGydYEE3H/?p=84) | 理解级别、logger/root/appender、文件输出；能解释全局 DEBUG 刷屏，以及同步控制台阻塞为何拖住请求 |
| Apache Commons CSV + 全批事务 | [小枫 Geek：CSV 文件入门](https://www.bilibili.com/video/BV1sV4y1f7V1/)，约 5 分钟；Java 用法补 [Commons CSV 官方示例](https://commons.apache.org/proper/commons-csv/apidocs/index.html) | 视频使用 Python，仅用于了解 CSV 格式，不是该 Java 库的教程；对照 importCsv 理解解析、全量校验和事务写入 |
| Flyway | [使用 flyway 完成 SQL 迁移](https://www.bilibili.com/video/BV1zm421K7Wn/)，约 101 分钟，作为开发实录备选；快速理解可先看 [官方工作流程图解](https://documentation.red-gate.com/flyway/getting-started-with-flyway) | 本次未筛到足够合适的中文速成短课；先理解扫描版本脚本、比对历史表、顺序执行待迁移脚本；对照当前 V1/V2 文件 |

#### 两个结合代码理解的设计方法

**token_version：**先理解 JWT，再看三更课程标题编号 21 的退出登录。这节用于理解退出登录的问题，并不等于讲解学序的版本号方案。学序登录时将数据库当前版本写入 JWT；退出、改密或停用账户时递增数据库版本；每次请求比较数据库 tokenVersion 与 JWT ver，旧令牌的版本不符即拒绝。示例：令牌版本 3、数据库版本 3 时允许访问；退出后数据库变为 4，旧令牌 3 被拒绝。实现入口：SecurityConfig.decoder、AuthService 和账户更新 SQL。

**REQUIRES_NEW 审计：**观看 [尚硅谷 SSM](https://www.bilibili.com/video/BV1AP411s7D7/)中标题编号 065 的事务传播行为，约 14 分钟。然后读 AuditService.record：业务失败需要回滚，记录“这次操作失败了”的审计仍需保留，因此通过独立事务提交。不要把该数据库审计事务与 Logback 的普通运行日志混为一谈。

#### 每组看完做一个小实验

| 知识点 | 学序中的验证动作 |
| --- | --- |
| 分页 | 切换第一页/第二页和搜索条件，检查 items、total、page 与数据库一致 |
| 事务和约束 | 在独立测试库中让批量操作中途失败，检查前面的写入也没有保留 |
| 行锁与隔离级别 | 在独立测试库中让两人竞争最后一个选课名额，检查仅一人成功 |
| 乐观锁 | 保存后再次提交旧 version，检查返回 409，原值不被覆盖 |
| 认证和权限 | 检查未登录 401、越权 403，以及退出后旧令牌无法继续使用 |
| 日志 | 对照日志定位一次接口失败，了解控制台输出与滚动文件的区别 |
| 测试 | 为正常和失败路径写断言，再通过真实接口及数据库核对一次 |

验证层次：JUnit/Mockito 检查业务判断并可模拟依赖；MockMvc 检查 Web 请求和响应行为；真实 HTTP/MySQL 检查实际服务、SQL、约束及事务；浏览器操作检查用户能否完成流程并看到正确结果。四层互相补充。

## 3. 三个适合重点讲解的难点

### 3.1 最后一个名额的并发竞争

先查询人数、再判断、再插入不是原子操作，两个请求都可能看到还有一个名额。实现时锁定同一门课程，把容量判断和选课、空成绩初始化放进一个事务，所有修改此课程参与人数的操作遵守同一锁顺序。

真实测试中还发现：虽然已加课程行锁，事务早先读取账户建立的 REPEATABLE READ 快照仍可能让后续普通人数查询读到旧值。因此将连接隔离设为 READ COMMITTED，并在选课事务明确指定该隔离级别。修正后同时抢一个名额的两次请求结果为一个成功、一个容量不足，数据库只增加一个关联。这是两请求竞争的功能验收，不是高并发压测。

这一设计与 MySQL 官方关于[事务隔离和一致性读](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)、[锁定读](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html)的说明相对应。

### 3.2 防止批量成绩出现部分成功或覆盖

每个成绩行有独立 version。两个人读到 version=0 后，一方保存使其变为 1；另一方继续提交 0 时，条件更新影响 0 行，后端返回 409。对一批成绩，哪怕前几条已经执行更新，只要后面一条发生版本冲突，整个事务都回滚。

前端保留失败草稿，提示重新加载后处理冲突，不自动重试覆盖他人的数据。验收特意让批量中的后一条使用旧版本，再查询数据库确认前一条也没有留下修改。

### 3.3 角色权限和对象范围同时控制

管理员、教师和学生不是只在前端显示不同菜单。教师查询课程、学生、成绩、考勤及报表时都带自己的授权范围；改 URL 请求另一门课程同样会被后端拒绝。学生账户以数据库 student_id 绑定身份，门户和报表按该绑定限制，不能靠请求传 studentId 看别人。

JWT 的签名和有效期由 Spring Security Resource Server 处理，密码用 BCrypt；另外通过 token_version 补上退出、改密和禁用后的即时撤销。选用成熟认证组件的依据见 [Spring Security JWT 文档](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)。

## 4. 核心业务和数据库设计

数据关系：班级有学生；学生和课程通过 enrollment 多对多；课程有多次 exam；每名选课学生在每次考试有一条 grade；课程每天有一张 attendance_sheet，其下是学生点名明细。user_course 只控制教师权限，不承担学生选课含义。

11 张业务表均不设置外键，保留用户此前的建模约定。Service 负责关联存在性、删除顺序、引用保护和事务；数据库仍通过主键、唯一键、索引和 CHECK 兜底。这样的设计适合学习显式业务一致性，也意味着绕过 Service 手动修改数据库可能产生孤儿记录，不能宣称没有外键仍自动级联。

旧学生库升级由 Flyway 追踪，已有 ID 不变；已有 V1 课程成绩迁入默认考试，已有成绩/点名关联转换为显式选课。没有现成关联的学生不自动加入所有课程。关于 Boot 集成迁移的依据见 [Spring Boot 数据库初始化文档](https://docs.spring.io/spring-boot/how-to/data-initialization.html)。

## 5. 可以放进简历的项目表述

**学序 EduFlow 教务管理系统｜Java 21、Spring Boot、Spring Security、MyBatis、MySQL、React、TypeScript**

- 实现管理员、教师和学生的完整教务流程，包括学生档案、班级/课程、独立选课、多次考试、成绩、考勤和学业报表。
- 通过 JWT/BCrypt、角色及课程范围校验实现后端授权，并使用账户令牌版本处理退出、改密和禁用后的访问撤销。
- 使用 InnoDB 行锁与 READ COMMITTED 保护选课容量，以版本条件更新防止成绩和点名覆盖；通过事务保证 CSV 导入、批量成绩和关联删除全成全败。
- 使用 MyBatis 完成数据库条件分页与多表加权统计，以 Flyway 管理旧库升级，结合 JUnit/MockMvc、真实 MySQL HTTP 验收和浏览器联调核查关键流程。

以上是实现内容摘要，不等于个人已独立掌握。投递前应能脱离 AI 讲清请求链路、写出学生 CRUD/分页、解释事务和版本冲突，并独立修改一条规则。不要补写“已服务多少用户”“高并发吞吐提升多少”“生产零事故”等未经测量的成果。

## 6. 实际验证与交付边界

2026-10-23 的 V2 验证执行后端 Maven package（21 项 JUnit/MockMvc/日志练习测试）、前端 10 项领域测试、TypeScript/Vite 构建，以及独立 MySQL 上的 13 组真实 HTTP 业务验收。另验证旧学生单表库升级保留原有样例、浏览器学生新增和成绩保存。最终执行明细、备份恢复与产物启动证据见[完整验收记录](验收记录.md)。

2026-10-24 补充修复学生档案请求被同步控制台日志阻塞的问题：新增 ConsoleLoggingTest，模拟终端不消费输出，1000 条业务日志全部写入滚动文件且请求线程不等待控制台。后端 22 项测试及前端构建通过，常用库学生分页/搜索真实 HTTP 与 Chrome 页面验证通过。本次没有重跑前述 13 组全量业务验收，具体范围见验收记录第 6 节。

提供 Dockerfile、Nginx、Compose 和 GitHub Actions；本机没有 Docker，未实测容器构建或 GitHub 云端执行，也没有发布公网。生产还需要 HTTPS、真实环境密钥、备份计划和运行监控。项目面向小规模工作区，除学生外部分名单/报表仍整组读取，没有大规模压测。业务审计记录动作/结果及版本摘要，不提供逐单元格成绩修改历史，也不覆盖进入控制器前被安全过滤链拒绝的请求。

## 7. 代码阅读入口

从 `frontend/src/v2/WorkspaceApp.tsx` 选一页，再看 client.ts 中请求；Java 依次追踪 controller → service → mapper → MySQL。建议先读 StudentController/StudentServiceImpl/StudentMapper，再读 AcademicService 的 enroll/saveGrades/saveAttendance，最后看 SecurityConfig、CurrentUser、ReportService 和迁移。

旧版前端保留在 src/App.tsx、src/pages、src/lib/api.ts/seed.ts，正式 main.tsx 已使用 V2。学习时可比较相同 CRUD 的前后差异，避免把旧 mock 当作当前后端行为。
