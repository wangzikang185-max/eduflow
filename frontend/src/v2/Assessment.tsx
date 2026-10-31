import { useEffect, useState } from "react";
import { Button, Modal } from "../components/ui";
import { csvCell, downloadFile } from "../lib/domain";
import { request, query } from "./client";
import type {
  VCourse,
  Exam,
  GradeSheet,
  Roll,
  AttendanceStatus,
} from "./client";
import {
  Confirm,
  Editor,
  Metric,
  Paged,
  State,
  Table,
  Title,
  useResource,
  message,
  today,
} from "./shared";
import type { Notify } from "./shared";
const csv = (headers: string[], rows: unknown[][]) =>
  "\uFEFF" +
  [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
const labels: Record<AttendanceStatus, string> = {
  present: "出勤",
  late: "迟到",
  absent: "缺勤",
  leave: "请假",
};

export function Assessment({
  notify,
  onDirty,
}: {
  notify: Notify;
  onDirty: (v: boolean) => void;
}) {
  const courses = useResource(() => request<VCourse[]>("/courses"));
  const [courseId, setCourse] = useState(""),
    [examId, setExam] = useState(""),
    [classFilter, setClassFilter] = useState(""),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [manage, setManage] = useState(false),
    [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [deleting, setDeleting] = useState<Exam | null>(null);
  const active = courseId || courses.data?.[0]?.id || "";
  const data = useResource(
    () =>
      active
        ? request<GradeSheet>("/grades" + query({ courseId: active, examId }))
        : Promise.resolve(null),
    [active, examId],
  );
  const grades = data.data?.grades || [];
  const dirty = Object.keys(draft).some((id) => {
    const original = grades.find((g) => g.studentId === id)?.score ?? null;
    return (draft[id] === "" ? null : Number(draft[id])) !== original;
  });
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    setDraft({});
  }, [data.data]);
  function switchTo(action: () => void) {
    if (!dirty || window.confirm("尚有未保存的成绩，放弃修改并切换？")) {
      setDraft({});
      action();
    }
  }
  const visible = (data.data?.students || []).filter(
    (s) =>
      (!classFilter || s.className === classFilter) &&
      `${s.name} ${s.studentNo} ${s.className}`.includes(search),
  );
  const recorded = grades.filter((g) => g.score !== null);
  const average =
    recorded.reduce((n, g) => n + (g.score ?? 0), 0) / (recorded.length || 1);
  async function save() {
    const scores = Object.entries(draft)
      .filter(
        ([id, value]) =>
          (value === "" ? null : Number(value)) !==
          (grades.find((g) => g.studentId === id)?.score ?? null),
      )
      .map(([studentId, value]) => ({
        studentId,
        score: value === "" ? null : Number(value),
        version: grades.find((g) => g.studentId === studentId)?.version,
      }));
    if (
      scores.some(
        (s) =>
          s.score !== null &&
          (!Number.isFinite(s.score) ||
            s.score < 0 ||
            s.score > 100 ||
            (Math.round(s.score * 100) !== s.score * 100 &&
              Math.abs(Math.round(s.score * 100) - s.score * 100) > 1e-8)),
      )
    ) {
      notify("分数应在 0–100 之间，最多两位小数", "error");
      return;
    }
    setBusy(true);
    try {
      await request("/grades/batch", "PUT", {
        courseId: active,
        examId: data.data?.examId,
        scores,
      });
      setDraft({});
      notify("成绩已全部保存");
      data.reload();
    } catch (e) {
      notify(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        title="成绩与考试"
        description="每门课程支持多次考核，成绩按权重汇总。空白表示未录入，0 分会参与统计。"
        actions={
          <>
            <Button disabled={!active || dirty} onClick={() => setManage(true)}>
              管理考试
            </Button>
            <Button
              disabled={!data.data || dirty || data.loading || !!data.error}
              onClick={() =>
                downloadFile(
                  "考试成绩.csv",
                  csv(
                    ["学号", "姓名", "班级", "成绩"],
                    visible.map((s) => [
                      s.studentNo,
                      s.name,
                      s.className,
                      grades.find((g) => g.studentId === s.id)?.score ?? "",
                    ]),
                  ),
                )
              }
            >
              导出已保存成绩
            </Button>
            <Button variant="primary" disabled={!dirty || busy} onClick={save}>
              {busy ? "保存中…" : "保存修改"}
            </Button>
          </>
        }
      />
      <div className="v2-toolbar">
        <select
          aria-label="成绩课程"
          value={active}
          onChange={(e) =>
            switchTo(() => {
              setCourse(e.target.value);
              setExam("");
            })
          }
        >
          {!courses.data?.length && <option value="">暂无课程</option>}
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="选择考试"
          value={examId || data.data?.examId || ""}
          onChange={(e) => switchTo(() => setExam(e.target.value))}
        >
          {data.data?.exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.examDate} · 权重 {e.weight}
            </option>
          ))}
        </select>
        <input
          placeholder="搜索姓名、学号或班级"
          aria-label="筛选成绩名单"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="成绩班级"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">全部班级</option>
          {Array.from(
            new Set(data.data?.students.map((s) => s.className) || []),
          ).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button
          disabled={!data.data || busy}
          onClick={() => switchTo(data.reload)}
        >
          重新加载
        </Button>
      </div>
      {dirty && (
        <p className="v2-banner">
          有未保存的修改。统计和导出使用已保存的成绩；发生版本冲突时请重新加载。
        </p>
      )}
      <State
        loading={courses.loading || data.loading}
        error={courses.error || data.error}
        retry={() => {
          courses.reload();
          data.reload();
        }}
      >
        <div className="v2-metrics">
          <Metric
            label="已录入"
            value={`${recorded.length} / ${grades.length}`}
          />
          <Metric
            label="平均分"
            value={recorded.length ? average.toFixed(2) : "—"}
          />
          <Metric
            label="及格率"
            value={
              recorded.length
                ? (
                    (recorded.filter((g) => g.score !== null && g.score >= 60)
                      .length /
                      recorded.length) *
                    100
                  ).toFixed(1) + "%"
                : "—"
            }
          />
          <Metric
            label="优秀人数"
            value={
              recorded.filter((g) => g.score !== null && g.score >= 90).length
            }
          />
        </div>
        <section className="v2-panel">
          <h2>已保存成绩分布 · 当前考试全部学生</h2>
          {[
            { name: "优秀", min: 90, max: 101 },
            { name: "良好", min: 80, max: 90 },
            { name: "合格", min: 60, max: 80 },
            { name: "待提升", min: 0, max: 60 },
          ].map((level) => {
            const count = recorded.filter(
              (g) =>
                g.score !== null && g.score >= level.min && g.score < level.max,
            ).length;
            return (
              <div className="v2-bar-row" key={level.name}>
                <span>{level.name}</span>
                <progress max={Math.max(recorded.length, 1)} value={count} />
                <strong>{count}</strong>
              </div>
            );
          })}
        </section>
        <div className="v2-panel">
          <Paged
            rows={visible}
            columns={[
              {
                title: "学生",
                cell: (s) => (
                  <>
                    <strong>{s.name}</strong>
                    <small className="v2-sub">{s.studentNo}</small>
                  </>
                ),
              },
              { title: "班级", cell: (s) => s.className },
              {
                title: "已保存成绩",
                cell: (s) =>
                  grades.find((g) => g.studentId === s.id)?.score ?? "未录入",
              },
              {
                title: "录入分数",
                cell: (s) => (
                  <input
                    className="v2-score"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    disabled={busy}
                    aria-label={`${s.name} 的成绩`}
                    placeholder="未录入"
                    value={
                      draft[s.id] ??
                      String(
                        grades.find((g) => g.studentId === s.id)?.score ?? "",
                      )
                    }
                    onChange={(e) =>
                      setDraft({ ...draft, [s.id]: e.target.value })
                    }
                  />
                ),
              },
            ]}
          />
        </div>
      </State>
      {manage && (
        <Modal
          title="管理课程考试"
          subtitle="权重按参与计算的考试归一化；未录入成绩不当作 0 分。"
          wide
          onClose={() => setManage(false)}
        >
          <Table
            rows={data.data?.exams || []}
            columns={[
              { title: "考试", cell: (e) => e.name },
              { title: "日期", cell: (e) => e.examDate },
              { title: "权重", cell: (e) => e.weight },
              {
                title: "操作",
                cell: (e) => (
                  <div className="v2-actions">
                    <Button
                      onClick={() => {
                        setManage(false);
                        setEditing({ ...e });
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      onClick={() => {
                        setManage(false);
                        setDeleting(e);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          <div className="modal-actions">
            <Button onClick={() => setManage(false)}>关闭</Button>
            <Button
              variant="primary"
              onClick={() => {
                setManage(false);
                setEditing({ name: "", examDate: today(), weight: 1 });
              }}
            >
              新增考试
            </Button>
          </div>
        </Modal>
      )}
      {editing && (
        <Editor
          title={editing.id ? "编辑考试" : "新增考试"}
          fields={[
            { key: "name", label: "考试名称", max: 40 },
            { key: "examDate", label: "考试日期", type: "date" },
            {
              key: "weight",
              label: "相对权重",
              type: "number",
              min: 0.01,
              max: 100,
              step: 0.01,
            },
          ]}
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await request(
              "/courses/" + active + "/exams" + (v.id ? "/" + v.id : ""),
              v.id ? "PUT" : "POST",
              v,
            );
            data.reload();
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="删除考试"
          text="只能删除尚未录入任何成绩的考试。"
          notify={notify}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(
              "/courses/" +
                active +
                "/exams/" +
                deleting.id +
                query({ version: deleting.version }),
              "DELETE",
            );
            setExam("");
            data.reload();
          }}
        />
      )}
    </>
  );
}

export function AttendancePage({
  notify,
  onDirty,
}: {
  notify: Notify;
  onDirty: (v: boolean) => void;
}) {
  const courses = useResource(() => request<VCourse[]>("/courses"));
  const [courseId, setCourse] = useState(""),
    [date, setDate] = useState(today()),
    [classFilter, setClassFilter] = useState(""),
    [draft, setDraft] = useState<Record<string, AttendanceStatus>>({}),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false);
  const active = courseId || courses.data?.[0]?.id || "";
  const data = useResource(
    () =>
      active
        ? request<Roll>("/attendance" + query({ courseId: active, date }))
        : Promise.resolve(null),
    [active, date],
  );
  const records = data.data?.records || [];
  const dirty = Object.keys(draft).some(
    (id) => draft[id] !== records.find((r) => r.studentId === id)?.status,
  );
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    setDraft({});
  }, [data.data]);
  function switchTo(action: () => void) {
    if (!dirty || window.confirm("尚有未保存的考勤，放弃修改并切换？")) {
      setDraft({});
      action();
    }
  }
  const roster = (data.data?.students || []).filter(
    (s) =>
      (!classFilter || s.className === classFilter) &&
      `${s.name} ${s.studentNo} ${s.className}`.includes(search),
  );
  return (
    <>
      <Title
        title="课堂考勤"
        description="首次点名只加载在读选课名单；历史点名表保留保存时的学生范围。"
        actions={
          <>
            <Button
              disabled={
                !data.data?.savedAt || dirty || data.loading || !!data.error
              }
              onClick={() =>
                downloadFile(
                  "课堂考勤.csv",
                  csv(
                    ["日期", "学号", "姓名", "考勤"],
                    roster.map((s) => [
                      date,
                      s.studentNo,
                      s.name,
                      labels[
                        records.find((r) => r.studentId === s.id)?.status ||
                          "present"
                      ],
                    ]),
                  ),
                )
              }
            >
              导出已保存考勤
            </Button>
            <Button
              variant="primary"
              disabled={
                !active ||
                data.loading ||
                busy ||
                !data.data ||
                (!!data.data.savedAt && !dirty)
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await request("/attendance/batch", "PUT", {
                    courseId: active,
                    date,
                    version: data.data?.version,
                    records: records.map((r) => ({
                      ...r,
                      status: draft[r.studentId] ?? r.status,
                    })),
                  });
                  setDraft({});
                  notify("完整点名表已保存");
                  data.reload();
                } catch (e) {
                  notify(message(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "保存中…" : "保存点名表"}
            </Button>
          </>
        }
      />
      <div className="v2-toolbar">
        <select
          aria-label="考勤课程"
          value={active}
          onChange={(e) => switchTo(() => setCourse(e.target.value))}
        >
          {!courses.data?.length && <option value="">暂无课程</option>}
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="考勤日期"
          value={date}
          onChange={(e) => {
            if (e.target.value) switchTo(() => setDate(e.target.value));
          }}
        />
        <input
          placeholder="搜索学生、学号或班级"
          aria-label="筛选考勤名单"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="考勤班级"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">全部班级</option>
          {Array.from(
            new Set(data.data?.students.map((s) => s.className) || []),
          ).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button onClick={() => switchTo(data.reload)} disabled={busy}>
          重新加载
        </Button>
        <Button
          disabled={!data.data || busy}
          onClick={() => {
            const next = { ...draft };
            roster.forEach((s) => (next[s.id] = "present"));
            setDraft(next);
          }}
        >
          当前筛选全部出勤
        </Button>
      </div>
      {data.data && (
        <p className="v2-banner">
          {data.data.savedAt
            ? `最近保存：${data.data.savedAt.replace("T", " ")}${dirty ? " · 有未保存修改" : ""}`
            : "尚未保存。这份预填点名表不参与统计，也不能导出。"}
        </p>
      )}
      <State
        loading={courses.loading || data.loading}
        error={courses.error || data.error}
        retry={() => {
          courses.reload();
          data.reload();
        }}
      >
        <div className="v2-panel">
          <Paged
            rows={roster}
            columns={[
              {
                title: "学生",
                cell: (s) => (
                  <>
                    <strong>{s.name}</strong>
                    <small className="v2-sub">{s.studentNo}</small>
                  </>
                ),
              },
              { title: "班级", cell: (s) => s.className },
              {
                title: "当前记录",
                cell: (s) => (
                  <select
                    aria-label={`${s.name} 的考勤`}
                    disabled={busy}
                    value={
                      draft[s.id] ??
                      records.find((r) => r.studentId === s.id)?.status ??
                      "present"
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [s.id]: e.target.value as AttendanceStatus,
                      })
                    }
                  >
                    {Object.entries(labels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                ),
              },
            ]}
          />
        </div>
      </State>
    </>
  );
}
