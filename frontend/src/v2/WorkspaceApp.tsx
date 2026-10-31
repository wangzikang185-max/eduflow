import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Button, Loading, Toast } from "../components/ui";
import { request, session } from "./client";
import type { User } from "./client";
import { People, Classes } from "./People";
import { Curriculum, Enrollments } from "./Curriculum";
import { Assessment, AttendancePage } from "./Assessment";
import { AuditPage, DashboardPage, PortalPage, ReportsPage } from "./Insights";
import { Accounts, PersonalSettings } from "./Accounts";
import type { Notify } from "./shared";
import "./workspace.css";

const navigation = [
  {
    id: "dashboard",
    label: "教务工作台",
    icon: LayoutDashboard,
    roles: ["ADMIN", "TEACHER"],
  },
  {
    id: "students",
    label: "学生档案",
    icon: Users,
    roles: ["ADMIN", "TEACHER"],
  },
  { id: "classes", label: "班级管理", icon: GraduationCap, roles: ["ADMIN"] },
  {
    id: "courses",
    label: "课程管理",
    icon: BookOpen,
    roles: ["ADMIN", "TEACHER"],
  },
  {
    id: "enrollments",
    label: "独立选课",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    id: "grades",
    label: "成绩与考试",
    icon: ChartColumn,
    roles: ["ADMIN", "TEACHER"],
  },
  {
    id: "attendance",
    label: "课堂考勤",
    icon: CalendarCheck,
    roles: ["ADMIN", "TEACHER"],
  },
  {
    id: "reports",
    label: "综合报表",
    icon: ChartColumn,
    roles: ["ADMIN", "TEACHER"],
  },
  { id: "accounts", label: "账户与授权", icon: ShieldCheck, roles: ["ADMIN"] },
  { id: "audit", label: "操作审计", icon: ClipboardList, roles: ["ADMIN"] },
  { id: "portal", label: "我的学业", icon: GraduationCap, roles: ["STUDENT"] },
];
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="v2-fatal">
        <h1>页面显示异常</h1>
        <p>请重新加载页面。如果仍有问题，请检查运行日志。</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function WorkspaceApp() {
  return (
    <Boundary>
      <Workspace />
    </Boundary>
  );
}
const route = () => location.hash.slice(1).replace(/^\//, "").split("?")[0];
const localName = (user: User): User => {
  const name = localStorage.getItem("xuexu.display." + user.id)?.trim();
  return name && name.length <= 50 ? { ...user, displayName: name } : user;
};
function Workspace() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [page, setPage] = useState(route() || ""),
    [globalSearch, setGlobalSearch] = useState(""),
    [menu, setMenu] = useState(false),
    [password, setPassword] = useState(false),
    [toast, setToast] = useState<{
      message: string;
      kind: "success" | "error";
    } | null>(null);
  const dirty = useRef(false),
    pageRef = useRef(page);
  pageRef.current = page;
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (
        user &&
        user.role !== "STUDENT" &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [user]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback<Notify>((message, kind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  useEffect(() => {
    let active = true;
    if (session.get())
      request<User>("/auth/me")
        .then((u) => {
          if (active) setUser(localName(u));
        })
        .catch((e) => {
          if (active) notify(e.message, "error");
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    else setChecking(false);
    const unauth = () => {
      session.clear();
      dirty.current = false;
      setUser(null);
      notify("请重新登录后继续", "error");
    };
    window.addEventListener("xuexu:unauthorized", unauth);
    return () => {
      active = false;
      window.removeEventListener("xuexu:unauthorized", unauth);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notify]);
  useEffect(() => {
    const hash = () => {
      if (
        dirty.current &&
        !window.confirm("有未保存的修改，确认离开当前页面？")
      ) {
        history.replaceState(null, "", "#" + pageRef.current);
        return;
      }
      dirty.current = false;
      setPage(route());
      setMenu(false);
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  if (checking) return <Loading />;
  if (!user)
    return (
      <>
        <Login onLogin={(u) => setUser(localName(u))} />
        {toast && <Toast {...toast} />}
      </>
    );
  const available = navigation.filter((n) => n.roles.includes(user.role));
  const current = available.find((n) => n.id === page) || available[0];
  const active = current.id;
  const roleLabel = {
    ADMIN: "教务管理员",
    TEACHER: "课程教师",
    STUDENT: "学生",
  }[user.role];
  function content() {
    switch (active) {
      case "students":
        return <People user={user!} notify={notify} />;
      case "classes":
        return <Classes notify={notify} />;
      case "courses":
        return <Curriculum user={user!} notify={notify} />;
      case "enrollments":
        return <Enrollments notify={notify} />;
      case "grades":
        return <Assessment notify={notify} onDirty={onDirty} />;
      case "attendance":
        return <AttendancePage notify={notify} onDirty={onDirty} />;
      case "reports":
        return <ReportsPage />;
      case "accounts":
        return <Accounts user={user!} notify={notify} />;
      case "audit":
        return <AuditPage />;
      case "portal":
        return <PortalPage notify={notify} />;
      default:
        return <DashboardPage />;
    }
  }
  return (
    <div className="v2-shell">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      {menu && (
        <button
          className="v2-scrim"
          aria-label="关闭菜单"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`v2-sidebar ${menu ? "open" : ""}`}>
        <a href={"#" + available[0].id} className="v2-brand">
          <span>
            <GraduationCap size={27} />
          </span>
          <div>
            学序 <em>·</em>
            <small>EDUFLOW / V2</small>
          </div>
        </a>
        <div className="v2-workspace">
          <span className="v2-live" /> 教务工作空间{" "}
          <small>真实后端 · MySQL</small>
        </div>
        <nav aria-label="主要导航">
          {available.map((n) => (
            <a
              key={n.id}
              href={"#" + n.id}
              className={active === n.id ? "active" : ""}
              aria-current={active === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              {n.label}
              {active === n.id && <i />}
            </a>
          ))}
        </nav>
        <div className="v2-sidebar-foot">
          <a href="https://github.com/wangzikang185-max/eduflow#readme" target="_blank" rel="noreferrer">
            项目文档与接口说明 ↗
          </a>
          <span>学序教务管理系统 · 2.0</span>
        </div>
      </aside>
      <div className="v2-main">
        <header className="v2-topbar">
          <button
            className="icon-btn v2-menu"
            aria-label="打开导航菜单"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <span>
            工作空间 <span className="muted">/ {current.label}</span>
          </span>
          {user.role !== "STUDENT" && (
            <form
              className="v2-global-search"
              onSubmit={(e) => {
                e.preventDefault();
                const hash =
                  "#students?search=" + encodeURIComponent(globalSearch);
                if (location.hash === hash)
                  window.dispatchEvent(
                    new CustomEvent("xuexu:student-search", {
                      detail: globalSearch,
                    }),
                  );
                else location.hash = hash;
              }}
            >
              <input
                ref={searchRef}
                aria-label="全局学生搜索"
                placeholder="搜索学生 · Ctrl K"
                maxLength={100}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <button type="submit" aria-label="搜索学生并跳转">
                <Search size={16} />
              </button>
            </form>
          )}
          <div className="v2-user">
            <span className="v2-avatar">{user.displayName.slice(-2)}</span>
            <div>
              <strong>{user.displayName}</strong>
              <small>{roleLabel}</small>
            </div>
            <button
              className="icon-btn"
              aria-label="个人设置"
              title="个人设置"
              onClick={() => setPassword(true)}
            >
              <Settings size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                if (
                  dirty.current &&
                  !window.confirm("尚有未保存修改，确认退出？")
                )
                  return;
                try {
                  await request("/auth/logout", "POST");
                } catch (e) {
                  notify((e as Error).message, "error");
                } finally {
                  session.clear();
                  dirty.current = false;
                  setUser(null);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="main" className="v2-content" key={active}>
          {content()}
        </main>
        <footer className="v2-footer">
          <span>
            <i /> 学序 EduFlow
          </span>
          <span>教务流程 · 数据有据可查</span>
        </footer>
      </div>
      {password && (
        <PersonalSettings
          user={user}
          onUser={setUser}
          notify={notify}
          onClose={() => setPassword(false)}
        />
      )}{" "}
      {toast && <Toast {...toast} />}
    </div>
  );
}
function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="v2-login">
      <section className="v2-login-story">
        <span className="v2-login-kicker">EDUFLOW · ACADEMIC WORKSPACE</span>
        <h1>
          让教务有序，
          <br />
          让成长有迹可循。
        </h1>
        <p>
          学生档案、独立选课、多次考核与课堂考勤，汇聚在一个清晰的工作空间。
        </p>
        <div className="v2-login-orbit">
          <GraduationCap size={68} />
          <span>学籍</span>
          <span>课程</span>
          <span>成长</span>
        </div>
        <small>学序教务管理系统 · V2</small>
      </section>
      <section className="v2-login-form">
        <div className="v2-brand">
          <span>
            <GraduationCap size={28} />
          </span>
          <div>
            学序 <em>·</em>
            <small>EDUFLOW</small>
          </div>
        </div>
        <h2>登录工作空间</h2>
        <p>使用管理员为你开通的账户继续。</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await request<{ token: string; user: User }>(
                "/auth/login",
                "POST",
                { username, password },
              );
              session.set(result.token);
              onLogin(result.user);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            用户名
            <input
              autoComplete="username"
              required
              maxLength={50}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              type="password"
              required
              maxLength={100}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </label>
          {error && (
            <p className="v2-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "正在验证…" : "登录"}
          </Button>
        </form>
        <p className="v2-login-help">
          首次使用：由启动脚本初始化管理员，密码见本机 runtime/local.env。
          <br />
          <a href="https://github.com/wangzikang185-max/eduflow#readme" target="_blank" rel="noreferrer">
            查看启动与项目说明 ↗
          </a>
        </p>
      </section>
    </div>
  );
}
