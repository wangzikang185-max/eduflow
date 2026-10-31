import { useState } from "react";
import { Button } from "../components/ui";
import { csvCell, downloadFile } from "../lib/domain";
import { request, query } from "./client";
import type {
  ClassRoom,
  VCourse,
  Report,
  Overview,
  Portal,
  Audit,
  Page,
} from "./client";
import {
  Confirm,
  Metric,
  Paged,
  State,
  Table,
  Title,
  useResource,
} from "./shared";
import type { Notify } from "./shared";

export function DashboardPage() {
  const data = useResource(() => request<Overview>("/dashboard/overview"));
  const schedule = useResource(() => request<VCourse[]>("/courses"));
  const d = data.data;
  return (
    <>
      <Title
        title="教务工作台"
        description="根据当前账户的可访问范围汇总真实数据；尚未保存的成绩与考勤不参与统计。"
      />
      <State {...data} retry={data.reload}>
        {d && (
          <>
            <div className="v2-metrics">
              <Metric
                label="学生总数"
                value={d.studentCount}
                detail={`${d.activeCount} 名在读`}
              />
              <Metric label="可访问课程" value={d.courseCount} />
              <Metric
                label="课程加权均分"
                value={d.gradeRecorded ? d.averageScore.toFixed(2) : "—"}
                detail="先按学生课程加权，再取均值"
              />
              <Metric
                label="出勤率"
                value={d.attendanceRecorded ? d.attendanceRate + "%" : "—"}
                detail="出勤与迟到 / 已保存点名记录"
              />
            </div>
            <section className="v2-panel">
              <h2>本周课程安排</h2>
              <div className="v2-toolbar">
                <a className="btn btn-default" href="#students">
                  学生档案
                </a>
                <a className="btn btn-default" href="#grades">
                  成绩录入
                </a>
                <a className="btn btn-default" href="#attendance">
                  课堂点名
                </a>
              </div>
              <State {...schedule} retry={schedule.reload}>
                <Table
                  rows={[...(schedule.data || [])].sort(
                    (a, b) =>
                      a.weekday - b.weekday || a.time.localeCompare(b.time),
                  )}
                  columns={[
                    {
                      title: "星期",
                      cell: (c) => "周" + "一二三四五六日"[c.weekday - 1],
                    },
                    { title: "时间", cell: (c) => c.time },
                    { title: "课程", cell: (c) => c.name },
                    {
                      title: "教师 / 教室",
                      cell: (c) => c.teacher + " · " + c.room,
                    },
                  ]}
                />
              </State>
            </section>
            <div className="v2-two-col">
              <section className="v2-panel">
                <h2>班级学生分布</h2>
                {d.classes.length ? (
                  d.classes.map((c) => (
                    <div className="v2-bar-row" key={c.name}>
                      <span>{c.name}</span>
                      <progress
                        value={c.count}
                        max={Math.max(1, ...d.classes.map((x) => x.count))}
                      />
                      <strong>{c.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="v2-note">暂无可访问班级数据。</p>
                )}
              </section>
              <section className="v2-panel">
                <h2>学生建档趋势</h2>
                <p className="v2-note">
                  按档案创建月份统计，删除档案后重新计算。
                </p>
                {d.trend.length ? (
                  d.trend.map((t) => (
                    <div className="v2-bar-row" key={t.month}>
                      <span>{t.month}</span>
                      <progress
                        value={t.current}
                        max={Math.max(1, ...d.trend.map((t) => t.current))}
                      />
                      <strong>{t.current}</strong>
                    </div>
                  ))
                ) : (
                  <p className="v2-note">没有可显示的全校历史趋势。</p>
                )}
              </section>
            </div>
            <section className="v2-panel">
              <h2>最近建档学生</h2>
              <Table
                rows={d.recentStudents}
                columns={[
                  { title: "姓名", cell: (s) => s.name },
                  { title: "学号", cell: (s) => s.studentNo },
                  { title: "班级", cell: (s) => s.className },
                  { title: "学籍", cell: (s) => s.status },
                ]}
              />
            </section>
          </>
        )}
      </State>
    </>
  );
}

export function ReportsPage() {
  const filters = useResource(() =>
    Promise.all([
      request<VCourse[]>("/courses"),
      request<ClassRoom[]>("/classes"),
    ]),
  );
  const [courseId, setCourse] = useState(""),
    [className, setClass] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [risk, setRisk] = useState(false);
  const data = useResource(
    () =>
      request<Report[]>("/reports" + query({ courseId, className, from, to })),
    [courseId, className, from, to],
  );
  const rows = (data.data || []).filter(
    (r) =>
      !risk ||
      (r.averageScore !== null && r.averageScore < 60) ||
      (r.attendanceRate !== null && r.attendanceRate < 80),
  );
  const scored = rows.filter((r) => r.averageScore !== null);
  return (
    <>
      <Title
        title="综合学业报表"
        description="按课程、班级和日期联查选课、考试、成绩与考勤，支持缺失数据识别及学业预警。"
        actions={
          <Button
            disabled={!data.data || data.loading || !!data.error}
            onClick={() =>
              downloadFile(
                "综合学业报表.csv",
                "\uFEFF" +
                  [
                    [
                      "学号",
                      "姓名",
                      "班级",
                      "课程",
                      "加权均分",
                      "已录入考试",
                      "考试总数",
                      "出勤率",
                    ],
                    ...rows.map((r) => [
                      r.studentNo,
                      r.name,
                      r.className,
                      r.courseName,
                      r.averageScore ?? "",
                      r.recorded,
                      r.expected,
                      r.attendanceRate ?? "",
                    ]),
                  ]
                    .map((row) => row.map(csvCell).join(","))
                    .join("\r\n"),
              )
            }
          >
            导出报表
          </Button>
        }
      />
      <div className="v2-toolbar">
        <select
          aria-label="报表课程"
          value={courseId}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">全部课程</option>
          {filters.data?.[0].map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="报表班级"
          value={className}
          onChange={(e) => setClass(e.target.value)}
        >
          <option value="">全部班级</option>
          {filters.data?.[1].map((c) => (
            <option key={c.id}>{c.name}</option>
          ))}
        </select>
        <label>
          从{" "}
          <input
            type="date"
            aria-label="报表开始日期"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          至{" "}
          <input
            type="date"
            aria-label="报表结束日期"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={risk}
            onChange={(e) => setRisk(e.target.checked)}
          />{" "}
          仅显示预警
        </label>
      </div>
      <State
        loading={data.loading || filters.loading}
        error={data.error || filters.error}
        retry={() => {
          filters.reload();
          data.reload();
        }}
      >
        <div className="v2-metrics">
          <Metric label="学生课程记录" value={rows.length} />
          <Metric label="有成绩记录" value={scored.length} />
          <Metric
            label="有成绩的均分"
            value={
              scored.length
                ? (
                    scored.reduce((a, r) => a + (r.averageScore ?? 0), 0) /
                    scored.length
                  ).toFixed(2)
                : "—"
            }
          />
          <Metric
            label="未完成录入"
            value={rows.filter((r) => r.recorded < r.expected).length}
          />
        </div>
        <div className="v2-panel">
          <Paged
            rows={rows}
            columns={[
              {
                title: "学生",
                cell: (r) => (
                  <>
                    {r.name}
                    <small className="v2-sub">{r.studentNo}</small>
                  </>
                ),
              },
              { title: "班级", cell: (r) => r.className },
              { title: "课程", cell: (r) => r.courseName },
              {
                title: "考试完成度",
                cell: (r) => `${r.recorded} / ${r.expected}`,
              },
              {
                title: "加权均分",
                cell: (r) => (
                  <span
                    className={
                      r.averageScore !== null && r.averageScore < 60
                        ? "v2-error"
                        : ""
                    }
                  >
                    {r.averageScore ?? "未录入"}
                  </span>
                ),
              },
              {
                title: "出勤率",
                cell: (r) =>
                  r.attendanceRate === null ? "未点名" : r.attendanceRate + "%",
              },
            ]}
          />
        </div>
        <p className="v2-note">
          考试满分均为 100。加权均分 = Σ(已录入分数 × 对应权重) /
          Σ(已录入权重)。预警：均分低于 60 或出勤率低于
          80%；未录入不按零分处理。
        </p>
      </State>
    </>
  );
}

export function PortalPage({ notify }: { notify: Notify }) {
  const data = useResource(() => request<Portal>("/portal"));
  const [action, setAction] = useState<{
    course: VCourse;
    add: boolean;
  } | null>(null);
  const d = data.data;
  return (
    <>
      <Title
        title="我的学业"
        description="查看自己的选课、各次考试成绩和历史考勤。"
      />
      <State {...data} retry={data.reload}>
        {d && (
          <>
            <section className="v2-panel">
              <h2>
                {d.student.name} · {d.student.studentNo}
              </h2>
              <p className="v2-note">
                {d.student.className} · {d.student.major} · {d.student.status} ·
                入学 {d.student.enrollmentDate}
              </p>
            </section>
            <section className="v2-panel">
              <h2>选课中心</h2>
              <Paged
                rows={d.courses}
                columns={[
                  {
                    title: "课程",
                    cell: (c) => (
                      <>
                        {c.name}
                        <small className="v2-sub">
                          {c.teacher} · 周{"一二三四五六日"[c.weekday - 1]}{" "}
                          {c.time}
                        </small>
                      </>
                    ),
                  },
                  {
                    title: "人数 / 容量",
                    cell: (c) => `${c.enrolled} / ${c.capacity}`,
                  },
                  {
                    title: "选课状态",
                    cell: (c) =>
                      d.enrolledIds.includes(c.id) ? "已选" : "未选",
                  },
                  {
                    title: "操作",
                    cell: (c) => (
                      <Button
                        disabled={
                          !d.enrolledIds.includes(c.id) &&
                          (c.enrolled >= c.capacity ||
                            d.student.status !== "在读")
                        }
                        onClick={() =>
                          setAction({
                            course: c,
                            add: !d.enrolledIds.includes(c.id),
                          })
                        }
                      >
                        {d.enrolledIds.includes(c.id) ? "退课" : "选课"}
                      </Button>
                    ),
                  },
                ]}
              />
            </section>
            <section className="v2-panel">
              <h2>我的考试成绩</h2>
              <Paged
                rows={d.grades}
                columns={[
                  { title: "课程", cell: (g) => g.courseName },
                  { title: "考试", cell: (g) => g.examName },
                  { title: "日期", cell: (g) => g.examDate },
                  { title: "权重", cell: (g) => g.weight },
                  { title: "成绩", cell: (g) => g.score ?? "未录入" },
                ]}
              />
            </section>
            <section className="v2-panel">
              <h2>我的历史考勤</h2>
              <Paged
                rows={d.attendance}
                columns={[
                  { title: "日期", cell: (r) => r.date },
                  { title: "课程", cell: (r) => r.courseName },
                  {
                    title: "考勤",
                    cell: (r) =>
                      ({
                        present: "出勤",
                        late: "迟到",
                        absent: "缺勤",
                        leave: "请假",
                      })[r.status],
                  },
                ]}
              />
            </section>
          </>
        )}
      </State>
      {action && (
        <Confirm
          title={action.add ? "确认选课" : "确认退课"}
          text={`${action.course.name}：${action.add ? "选课后将建立该课程各次考试的空白成绩。" : "已有成绩或考勤的课程不能退课。"}`}
          notify={notify}
          onClose={() => setAction(null)}
          onConfirm={async () => {
            await request(
              "/courses/" +
                action.course.id +
                "/enrollments" +
                (action.add ? "" : "/" + d?.student.id),
              action.add ? "POST" : "DELETE",
              action.add ? { studentIds: [d?.student.id] } : undefined,
            );
            data.reload();
          }}
        />
      )}
    </>
  );
}

export function AuditPage() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const data = useResource(
    () =>
      request<Page<Audit>>("/audit" + query({ search, page, pageSize: 20 })),
    [search, page],
  );
  return (
    <>
      <Title
        title="操作审计"
        description="记录服务端业务写操作的操作者、目标及结果。失败记录使用独立事务保存，不存密码或令牌。"
      />
      <div className="v2-toolbar">
        <input
          placeholder="按操作搜索，如 PUT_GRADES"
          aria-label="搜索操作日志"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <State {...data} retry={data.reload}>
        <div className="v2-panel">
          <Table
            rows={data.data?.items || []}
            columns={[
              { title: "时间", cell: (r) => r.createTime.replace("T", " ") },
              {
                title: "操作人",
                cell: (r) => r.operator || "匿名 / 已删除账户",
              },
              { title: "操作", cell: (r) => r.action },
              { title: "目标", cell: (r) => r.targetId || r.targetType },
              {
                title: "结果",
                cell: (r) => (
                  <span
                    className={r.result === "FAILURE" ? "v2-error" : "v2-tag"}
                  >
                    {r.result}
                  </span>
                ),
              },
              { title: "状态", cell: (r) => r.message },
            ]}
          />
          <div className="v2-toolbar">
            <Button disabled={page === 1} onClick={() => setPage((v) => v - 1)}>
              上一页
            </Button>
            <span>
              第 {page} 页 · 共 {data.data?.total || 0} 条
            </span>
            <Button
              disabled={page * 20 >= (data.data?.total || 0)}
              onClick={() => setPage((v) => v + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </State>
    </>
  );
}
