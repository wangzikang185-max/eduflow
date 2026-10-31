import { useEffect, useRef, useState } from "react";
import { Button, Modal, Pagination } from "../components/ui";
import { studentCSV } from "../lib/domain";
import { downloadFile } from "../lib/domain";
import { request, query, allStudents } from "./client";
import type { ClassRoom, Page, VStudent, User } from "./client";
import {
  Confirm,
  Editor,
  State,
  Table,
  Title,
  options,
  useResource,
  message,
  today,
} from "./shared";
import type { Field, Notify } from "./shared";

export function People({ user, notify }: { user: User; notify: Notify }) {
  const admin = user.role === "ADMIN";
  const [search, setSearch] = useState(
      new URLSearchParams(location.hash.split("?")[1] || "").get("search") ||
        "",
    ),
    [className, setClass] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [detail, setDetail] = useState<VStudent | null>(null),
    [deleting, setDeleting] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fromHash = () => {
      setSearch(
        new URLSearchParams(location.hash.split("?")[1] || "").get("search") ||
          "",
      );
      setPage(1);
    };
    const fromEvent = (event: Event) => {
      setSearch(String((event as CustomEvent).detail));
      setPage(1);
    };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("xuexu:student-search", fromEvent);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("xuexu:student-search", fromEvent);
    };
  }, []);
  useEffect(() => setSelected([]), [search, className, status]);
  const data = useResource(
    () =>
      Promise.all([
        request<Page<VStudent>>(
          "/students" +
            query({ search, className, status, page, pageSize: 10 }),
        ),
        request<ClassRoom[]>("/classes"),
      ]),
    [search, className, status, page],
  );
  const refresh = () => {
    setSelected([]);
    data.reload();
  };
  const classes = data.data?.[1] || [];
  const fields: Field[] = [
    { key: "studentNo", label: "学号", min: 4, max: 20 },
    { key: "name", label: "姓名", max: 30 },
    {
      key: "gender",
      label: "性别",
      type: "select",
      options: options(["男", "女", "未说明"]),
    },
    {
      key: "className",
      label: "班级",
      type: "select",
      options: options(classes.map((c) => c.name)),
    },
    { key: "phone", label: "手机号", optional: true, max: 11 },
    { key: "email", label: "邮箱", type: "email", optional: true, max: 254 },
    {
      key: "status",
      label: "学籍状态",
      type: "select",
      options: options(["在读", "休学", "已毕业"]),
    },
    { key: "enrollmentDate", label: "入学日期", type: "date" },
  ];
  async function exportRows() {
    setBusy(true);
    try {
      const rows = await allStudents();
      downloadFile(
        "学序-学生档案.csv",
        studentCSV(
          rows.filter(
            (s) =>
              (!selected.length || selected.includes(s.id)) &&
              (!className || s.className === className) &&
              (!status || s.status === status) &&
              (!search ||
                `${s.name} ${s.studentNo} ${s.phone}`
                  .toLowerCase()
                  .includes(search.toLowerCase())),
          ),
        ),
      );
      notify("已导出当前筛选结果");
    } catch (e) {
      notify(message(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        title="学生档案"
        description="在 MySQL 中筛选与分页；班级、学籍和联系方式统一维护。"
        actions={
          <>
            {admin && (
              <>
                <Button onClick={() => file.current?.click()} disabled={busy}>
                  导入 CSV
                </Button>
                <Button
                  onClick={() =>
                    downloadFile("学生导入模板.csv", studentCSV([]))
                  }
                >
                  下载模板
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    setEditing({
                      studentNo: "",
                      name: "",
                      gender: "未说明",
                      className: classes[0]?.name || "",
                      phone: "",
                      email: "",
                      status: "在读",
                      enrollmentDate: today(),
                    })
                  }
                >
                  新增学生
                </Button>
              </>
            )}
            <Button disabled={busy} onClick={exportRows}>
              导出 CSV
            </Button>
          </>
        }
      />
      <input
        ref={file}
        hidden
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) {
            notify("文件不能超过 2 MiB", "error");
            return;
          }
          setBusy(true);
          try {
            const result = await request<{ imported: number }>(
              "/students/import",
              "POST",
              { csv: await f.text() },
            );
            notify(`已导入 ${result.imported} 名学生`);
            refresh();
          } catch (e) {
            notify(message(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className="v2-toolbar">
        <input
          aria-label="搜索学生"
          placeholder="搜索姓名、学号、手机号"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="按班级筛选"
          value={className}
          onChange={(e) => {
            setClass(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部班级</option>
          {classes.map((c) => (
            <option key={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          aria-label="按学籍筛选"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">全部学籍</option>
          {["在读", "休学", "已毕业"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {admin && (
          <Button
            variant="danger"
            disabled={!selected.length}
            onClick={() => setDeleting(selected)}
          >
            删除已选 ({selected.length})
          </Button>
        )}
      </div>
      <State {...data} retry={data.reload}>
        {data.data && (
          <div className="v2-panel">
            <Table
              rows={data.data[0].items}
              columns={[
                ...(admin
                  ? [
                      {
                        title: "选择",
                        cell: (s: VStudent) => (
                          <input
                            type="checkbox"
                            aria-label={`选择 ${s.name}`}
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
                    ]
                  : []),
                {
                  title: "学号 / 姓名",
                  cell: (s) => (
                    <>
                      <strong>{s.name}</strong>
                      <small className="v2-sub">{s.studentNo}</small>
                    </>
                  ),
                },
                { title: "班级", cell: (s) => s.className },
                { title: "专业", cell: (s) => s.major },
                {
                  title: "学籍",
                  cell: (s) => <span className="v2-tag">{s.status}</span>,
                },
                {
                  title: "操作",
                  cell: (s) => (
                    <div className="v2-actions">
                      <Button
                        onClick={async () => {
                          try {
                            setDetail(
                              await request<VStudent>("/students/" + s.id),
                            );
                          } catch (e) {
                            notify(message(e), "error");
                          }
                        }}
                      >
                        详情
                      </Button>
                      {admin && (
                        <>
                          <Button onClick={() => setEditing({ ...s })}>
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setDeleting([s.id])}
                          >
                            删除
                          </Button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <Pagination
              page={page}
              pageSize={10}
              total={data.data[0].total}
              onChange={setPage}
            />
          </div>
        )}
      </State>
      {editing && (
        <Editor
          title={editing.id ? "编辑学生" : "新增学生"}
          fields={fields}
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSave={async (value) => {
            await request(
              "/students" + (value.id ? "/" + value.id : ""),
              value.id ? "PUT" : "POST",
              value,
            );
            refresh();
          }}
        />
      )}
      {detail && (
        <Modal
          title={detail.name + " · 学生详情"}
          onClose={() => setDetail(null)}
        >
          <dl className="detail-grid">
            {fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{String(detail[f.key as keyof VStudent] || "—")}</dd>
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
          title={`删除 ${deleting.length} 名学生`}
          text="学生档案、选课、成绩及考勤记录将一并删除，关联学生账号会禁用。请确认已经导出需要保留的数据。"
          notify={notify}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request("/students/batch-delete", "POST", { ids: deleting });
            setPage(1);
            refresh();
          }}
        />
      )}
    </>
  );
}

export function Classes({ notify }: { notify: Notify }) {
  const data = useResource(() => request<ClassRoom[]>("/classes"));
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [deleting, setDeleting] = useState<ClassRoom | null>(null);
  return (
    <>
      <Title
        title="班级管理"
        description="修改名称和专业时，同一事务同步学生档案。已有学生的班级不能删除。"
        actions={
          <Button
            variant="primary"
            onClick={() => setEditing({ name: "", major: "" })}
          >
            新增班级
          </Button>
        }
      />
      <State {...data} retry={data.reload}>
        <div className="v2-panel">
          <Table
            rows={data.data || []}
            columns={[
              { title: "班级名称", cell: (c) => <strong>{c.name}</strong> },
              { title: "专业", cell: (c) => c.major },
              { title: "学生人数", cell: (c) => c.studentCount },
              {
                title: "操作",
                cell: (c) => (
                  <div className="v2-actions">
                    <Button onClick={() => setEditing({ ...c })}>编辑</Button>
                    <Button
                      onClick={() => setDeleting(c)}
                      disabled={c.studentCount > 0}
                    >
                      删除
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </State>
      {editing && (
        <Editor
          title={editing.id ? "编辑班级" : "新增班级"}
          fields={[
            { key: "name", label: "班级名称", max: 40 },
            { key: "major", label: "专业", max: 40 },
          ]}
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSave={async (value) => {
            await request(
              "/classes" + (value.id ? "/" + value.id : ""),
              value.id ? "PUT" : "POST",
              value,
            );
            data.reload();
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="删除班级"
          text={`确认删除 ${deleting.name}？`}
          notify={notify}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await request(
              "/classes/" + deleting.id + query({ version: deleting.version }),
              "DELETE",
            );
            data.reload();
          }}
        />
      )}
    </>
  );
}
