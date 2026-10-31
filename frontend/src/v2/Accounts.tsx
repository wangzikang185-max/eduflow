import { useState } from "react";
import { Button, Modal } from "../components/ui";
import { request, allStudents } from "./client";
import type { User, VCourse } from "./client";
import {
  Editor,
  State,
  Table,
  Title,
  useResource,
  options,
  message,
} from "./shared";
import type { Field, Notify } from "./shared";
export function Accounts({ user, notify }: { user: User; notify: Notify }) {
  const data = useResource(() =>
    Promise.all([
      request<User[]>("/users"),
      request<VCourse[]>("/courses"),
      allStudents(),
    ]),
  );
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [granting, setGranting] = useState<User | null>(null),
    [busy, setBusy] = useState(false);
  const grants = useResource(
    () =>
      granting
        ? request<{ courseId: string }[]>("/users/" + granting.id + "/courses")
        : Promise.resolve([]),
    [granting],
  );
  const fields: Field[] = editing?.id
    ? [
        { key: "displayName", label: "显示名称", max: 50 },
        {
          key: "enabled",
          label: "启用状态（1 启用 / 0 禁用）",
          type: "number",
          min: 0,
          max: 1,
        },
      ]
    : [
        { key: "username", label: "用户名（字母数字 . _ -）", min: 4, max: 50 },
        { key: "displayName", label: "显示名称", max: 50 },
        {
          key: "password",
          label: "初始密码（12–72 UTF-8 字节）",
          type: "password",
          min: 12,
          max: 72,
        },
        {
          key: "role",
          label: "账户角色",
          type: "select",
          options: options(["TEACHER", "STUDENT", "ADMIN"]),
        },
        {
          key: "studentId",
          label: "学生账户绑定学生（其他角色可留空）",
          type: "select",
          optional: true,
          options: (data.data?.[2] || []).map((s) => ({
            value: s.id,
            label: s.name + " · " + s.studentNo,
          })),
        },
      ];
  return (
    <>
      <Title
        title="账户与授权"
        description="密码使用 BCrypt 存储。教师需要逐课程授权；学生账户只能绑定一个学生。禁用与改密会立即使旧令牌失效。"
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setEditing({
                username: "",
                displayName: "",
                password: "",
                role: "TEACHER",
                studentId: "",
              })
            }
          >
            新增账户
          </Button>
        }
      />
      <State {...data} retry={data.reload}>
        <div className="v2-panel">
          <Table
            rows={data.data?.[0] || []}
            columns={[
              { title: "用户名", cell: (u) => u.username },
              { title: "显示名称", cell: (u) => u.displayName },
              { title: "角色", cell: (u) => u.role },
              { title: "状态", cell: (u) => (u.enabled ? "启用" : "禁用") },
              {
                title: "操作",
                cell: (u) => (
                  <div className="v2-actions">
                    <Button onClick={() => setEditing({ ...u })}>编辑</Button>
                    {u.role === "TEACHER" && (
                      <Button onClick={() => setGranting(u)}>课程授权</Button>
                    )}
                    {u.id === user.id && (
                      <small className="muted">当前账户</small>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </State>
      {editing && (
        <Editor
          title={editing.id ? "编辑账户" : "新增账户"}
          fields={fields}
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await request(
              "/users" + (v.id ? "/" + v.id : ""),
              v.id ? "PUT" : "POST",
              v,
            );
            data.reload();
          }}
        />
      )}
      {granting && (
        <Modal
          title={granting.displayName + " · 课程授权"}
          subtitle="每次切换即时保存。撤销后，教师下次请求即失去该课程权限。"
          onClose={() => {
            if (!busy) setGranting(null);
          }}
        >
          <State {...grants} retry={grants.reload}>
            <div className="v2-grants">
              {data.data?.[1].map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={
                      grants.data?.some((g) => g.courseId === c.id) || false
                    }
                    onChange={async (e) => {
                      setBusy(true);
                      try {
                        await request(
                          "/users/" + granting.id + "/courses/" + c.id,
                          e.target.checked ? "PUT" : "DELETE",
                        );
                        grants.reload();
                        notify("授权已更新");
                      } catch (e) {
                        notify(message(e), "error");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  {c.name}
                  <small>{c.code}</small>
                </label>
              ))}
            </div>
          </State>
          <div className="modal-actions">
            <Button disabled={busy} onClick={() => setGranting(null)}>
              关闭
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Password({
  notify,
  onClose,
}: {
  notify: Notify;
  onClose: () => void;
}) {
  return (
    <Editor
      title="修改密码"
      fields={[
        { key: "oldPassword", label: "原密码", type: "password" },
        {
          key: "password",
          label: "新密码（12–72 UTF-8 字节）",
          type: "password",
          min: 12,
          max: 72,
        },
      ]}
      initial={{ oldPassword: "", password: "" }}
      notify={notify}
      onClose={onClose}
      onSave={async (v) => {
        await request("/auth/password", "PUT", v);
        window.dispatchEvent(new Event("xuexu:unauthorized"));
      }}
    />
  );
}

export function PersonalSettings({
  user,
  onUser,
  notify,
  onClose,
}: {
  user: User;
  onUser: (user: User) => void;
  notify: Notify;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "name" | "password">("menu");
  if (mode === "password")
    return <Password notify={notify} onClose={onClose} />;
  if (mode === "name")
    return (
      <Editor
        title="本机显示名称"
        fields={[{ key: "displayName", label: "显示名称", max: 50 }]}
        initial={{ displayName: user.displayName }}
        notify={notify}
        onClose={onClose}
        onSave={async (value) => {
          const name = String(value.displayName ?? "").trim();
          if (!name || name.length > 50)
            throw new Error("显示名称应为 1–50 个字符");
          localStorage.setItem("xuexu.display." + user.id, name);
          onUser({ ...user, displayName: name });
        }}
      />
    );
  return (
    <Modal
      title="个人设置"
      subtitle="显示名称保存在当前浏览器；账户身份和数据权限由服务器管理。"
      onClose={onClose}
    >
      <div className="v2-grants">
        <Button onClick={() => setMode("name")}>修改本机显示名称</Button>
        <Button onClick={() => setMode("password")}>修改登录密码</Button>
      </div>
      <div className="modal-actions">
        <Button onClick={onClose}>关闭</Button>
      </div>
    </Modal>
  );
}
