import { useState } from "react";
import { BookOpen, Users } from "lucide-react";
import { Button, Modal } from "../components/ui";
import { request, query, allStudents } from "./client";
import type { VCourse, VStudent, User } from "./client";
import {
  Confirm,
  Editor,
  Paged,
  State,
  Title,
  options,
  useResource,
  message,
} from "./shared";
import type { Field, Notify } from "./shared";

export const courseFields: Field[] = [
  { key: "code", label: "课程代码", min: 2, max: 20 },
  { key: "name", label: "课程名称", max: 40 },
  { key: "teacher", label: "授课教师", max: 50 },
  {
    key: "category",
    label: "课程类别",
    type: "select",
    options: options(["专业必修", "专业选修", "公共基础"]),
  },
  {
    key: "credits",
    label: "学分",
    type: "number",
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  { key: "hours", label: "课时", type: "number", min: 1, max: 300 },
  { key: "capacity", label: "容量", type: "number", min: 1, max: 10000 },
  { key: "room", label: "教室", max: 100 },
  { key: "weekday", label: "星期（1–7）", type: "number", min: 1, max: 7 },
  { key: "time", label: "上课时间（09:00–10:30）" },
  {
    key: "color",
    label: "标识颜色",
    type: "select",
    options: options(["orange", "blue", "purple", "amber", "pink", "teal"]),
  },
  {
    key: "description",
    label: "课程简介",
    type: "textarea",
    optional: true,
    max: 200,
  },
];
export function Curriculum({ user, notify }: { user: User; notify: Notify }) {
  const data = useResource(() => request<VCourse[]>("/courses"));
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [layout, setLayout] = useState<"cards" | "list">("cards"),
    [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [detail, setDetail] = useState<VCourse | null>(null),
    [deleting, setDeleting] = useState<VCourse | null>(null);
  const rows = (data.data || []).filter(
    (c) =>
      (!category || c.category === category) &&
      `${c.name} ${c.code} ${c.teacher} ${c.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Title
        title="课程管理"
        description="课程容量由独立选课维护；创建课程时建立一项默认考核。"
        actions={
          user.role === "ADMIN" && (
            <Button
              variant="primary"
              onClick={() =>
                setEditing({
                  code: "",
                  name: "",
                  teacher: "",
                  category: "专业必修",
                  credits: 3,
                  hours: 48,
                  capacity: 50,
                  room: "",
                  weekday: 1,
                  time: "09:00–10:30",
                  color: "orange",
                  description: "",
                })
              }
            >
              新增课程
            </Button>
          )
        }
      />
      <div className="v2-toolbar">
        <select
          aria-label="课程类别"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">全部类别</option>
          {["专业必修", "公共基础", "专业选修"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button
          onClick={() => setLayout((v) => (v === "cards" ? "list" : "cards"))}
        >
          {layout === "cards" ? "切换列表" : "切换卡片"}
        </Button>
        <input
          aria-label="搜索课程"
          placeholder="搜索课程、代码、教师或类别"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <State {...data} retry={data.reload}>
        {layout === "list" ? (
          <div className="v2-panel">
            <Paged
              rows={rows}
              columns={[
                { title: "课程代码", cell: (c) => c.code },
                { title: "课程", cell: (c) => <strong>{c.name}</strong> },
                { title: "教师", cell: (c) => c.teacher },
                { title: "类别", cell: (c) => c.category },
                {
                  title: "人数 / 容量",
                  cell: (c) => `${c.enrolled} / ${c.capacity}`,
                },
                {
                  title: "操作",
                  cell: (c) => (
                    <div className="v2-actions">
                      <Button onClick={() => setDetail(c)}>详情</Button>
                      {user.role === "ADMIN" && (
                        <Button onClick={() => setEditing({ ...c })}>
                          编辑
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <div className="v2-course-grid">
            {rows.map((c) => (
              <article className="v2-course" key={c.id}>
                <div className={`v2-course-icon ${c.color}`}>
                  <BookOpen size={22} />
                  <span>{c.code}</span>
                </div>
                <span className="v2-tag">{c.category}</span>
                <h2>{c.name}</h2>
                <p>{c.description || "暂未填写课程简介"}</p>
                <dl>
                  <div>
                    <dt>授课教师</dt>
                    <dd>{c.teacher}</dd>
                  </div>
                  <div>
                    <dt>学分 / 课时</dt>
                    <dd>
                      {c.credits} / {c.hours}
                    </dd>
                  </div>
                  <div>
                    <dt>课程安排</dt>
                    <dd>
                      周{"一二三四五六日"[c.weekday - 1]} {c.time}
                    </dd>
                  </div>
                  <div>
                    <dt>教室</dt>
                    <dd>{c.room}</dd>
                  </div>
                </dl>
                <div className="v2-capacity">
                  <span>
                    <Users size={14} /> {c.enrolled} / {c.capacity} 人
                  </span>
                  <progress max={c.capacity} value={c.enrolled} />
                </div>
                <div className="v2-actions">
                  <Button onClick={() => setDetail(c)}>详情</Button>
                  {user.role === "ADMIN" && (
                    <>
                      <Button onClick={() => setEditing({ ...c })}>编辑</Button>
                      <Button
                        disabled={c.enrolled > 0}
                        onClick={() => setDeleting(c)}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {!rows.length && (
          <div className="v2-panel v2-note">
            暂无课程。管理员可创建课程，教师需先获得课程授权。
          </div>
        )}
      </State>
      {editing && (
        <Editor
          title={editing.id ? "编辑课程" : "新增课程"}
          fields={courseFields}
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await request(
              "/courses" + (v.id ? "/" + v.id : ""),
              v.id ? "PUT" : "POST",
              v,
            );
            data.reload();
          }}
        />
      )}
      {detail && (
        <Modal
          title={detail.name}
          subtitle={detail.code}
          onClose={() => setDetail(null)}
        >
          <dl className="detail-grid">
            {courseFields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{String(detail[f.key as keyof VCourse] ?? "—")}</dd>
              </div>
            ))}
          </dl>
          <div className="modal-actions">
            <Button onClick={() => setDetail(null)}>关闭</Button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title="删除课程"
          text="仅无选课和历史记录的课程可以删除，空白考核一并清理。"
          notify={notify}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(
              "/courses/" + deleting.id + query({ version: deleting.version }),
              "DELETE",
            );
            data.reload();
          }}
        />
      )}
    </>
  );
}

export function Enrollments({ notify }: { notify: Notify }) {
  const courses = useResource(() => request<VCourse[]>("/courses"));
  const [id, setId] = useState(""),
    [picker, setPicker] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [deleting, setDeleting] = useState<VStudent | null>(null),
    [busy, setBusy] = useState(false);
  const active = id || courses.data?.[0]?.id || "";
  const roster = useResource(
    async () =>
      active ? request<VStudent[]>("/courses/" + active + "/students") : [],
    [active],
  );
  const candidates = useResource(
    () => (picker ? allStudents() : Promise.resolve([])),
    [picker],
  );
  const existing = new Set(roster.data?.map((s) => s.id));
  return (
    <>
      <Title
        title="独立选课"
        description="按学生建立课程关系；选课时锁定课程容量，初始化该课程的全部考核记录。"
        actions={
          <Button
            variant="primary"
            disabled={!active}
            onClick={() => {
              setPicker(true);
              setSelected([]);
            }}
          >
            添加选课学生
          </Button>
        }
      />
      <div className="v2-toolbar">
        <select
          aria-label="选择选课课程"
          value={active}
          onChange={(e) => setId(e.target.value)}
        >
          {!courses.data?.length && <option value="">暂无课程</option>}
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.enrolled}/{c.capacity})
            </option>
          ))}
        </select>
      </div>
      <State
        loading={courses.loading || roster.loading}
        error={courses.error || roster.error}
        retry={() => {
          courses.reload();
          roster.reload();
        }}
      >
        <div className="v2-panel">
          <Paged
            rows={roster.data || []}
            columns={[
              { title: "姓名", cell: (s) => s.name },
              { title: "学号", cell: (s) => s.studentNo },
              { title: "班级", cell: (s) => s.className },
              { title: "学籍", cell: (s) => s.status },
              {
                title: "操作",
                cell: (s) => (
                  <Button onClick={() => setDeleting(s)}>退课</Button>
                ),
              },
            ]}
          />
        </div>
      </State>
      {picker && (
        <Modal
          title="选择学生"
          subtitle="仅在读学生可选课，单次最多 500 人。"
          wide
          onClose={() => {
            if (!busy) setPicker(false);
          }}
        >
          <div className="v2-toolbar">
            <input
              placeholder="搜索姓名或学号"
              aria-label="查找可选课学生"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>已选 {selected.length} 人</span>
          </div>
          <State {...candidates} retry={candidates.reload}>
            <Paged
              rows={(candidates.data || []).filter(
                (s) =>
                  s.status === "在读" &&
                  !existing.has(s.id) &&
                  `${s.name} ${s.studentNo}`.includes(search),
              )}
              columns={[
                {
                  title: "选择",
                  cell: (s) => (
                    <input
                      aria-label={`为 ${s.name} 选课`}
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() =>
                        setSelected((v) =>
                          v.includes(s.id)
                            ? v.filter((id) => id !== s.id)
                            : [...v, s.id],
                        )
                      }
                    />
                  ),
                },
                { title: "学号", cell: (s) => s.studentNo },
                { title: "姓名", cell: (s) => s.name },
                { title: "班级", cell: (s) => s.className },
              ]}
            />
          </State>
          <div className="modal-actions">
            <Button disabled={busy} onClick={() => setPicker(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={busy || !selected.length || selected.length > 500}
              onClick={async () => {
                setBusy(true);
                try {
                  await request("/courses/" + active + "/enrollments", "POST", {
                    studentIds: selected,
                  });
                  notify("选课成功");
                  setPicker(false);
                  courses.reload();
                  roster.reload();
                } catch (e) {
                  notify(message(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认选课
            </Button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title="退课确认"
          text={`${deleting.name} 将退出此课程；已有成绩或考勤时会拒绝退课。`}
          notify={notify}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(
              "/courses/" + active + "/enrollments/" + deleting.id,
              "DELETE",
            );
            roster.reload();
            courses.reload();
          }}
        />
      )}
    </>
  );
}
