// Windows launcher: no PowerShell scripts or execution-policy changes.
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = new Set(process.argv.slice(2));
const children = new Set();
let stopping = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function onPath(name) {
  const result = spawnSync("where.exe", [name], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
}

function readSettings() {
  const filename = path.join(root, "runtime", "local.env");
  if (!fs.existsSync(filename)) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, [
      "DB_URL=jdbc:mysql://127.0.0.1:3306/xuexu?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai",
      "DB_USERNAME=root", "DB_PASSWORD=",
      `JWT_SECRET=${randomBytes(32).toString("hex")}`,
      `ADMIN_PASSWORD=Xuexu-${randomBytes(16).toString("hex")}`, "PORT=8081", "",
    ].join("\r\n"), { flag: "wx" });
    throw new Error("已生成 runtime/local.env。请先填写数据库连接和密码，再双击 start.cmd。首次配置只需完成一次。");
  }
  const env = { ...process.env };
  for (const line of fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const pair = /^([A-Z_]+)=(.*)$/.exec(line);
    if (pair) env[pair[1]] = pair[2];
  }
  for (const key of ["DB_URL", "DB_USERNAME", "JWT_SECRET"]) {
    if (!env[key]) throw new Error(`请在 runtime/local.env 填写 ${key}。`);
  }
  if (env.DB_PASSWORD === undefined || env.DB_PASSWORD === "") {
    throw new Error("请在 runtime/local.env 填写 DB_PASSWORD。");
  }
  if (Buffer.byteLength(env.JWT_SECRET, "utf8") < 32) {
    throw new Error("runtime/local.env 中 JWT_SECRET 至少需要 32 字节。");
  }
  return env;
}

function javaHome(env) {
  const candidates = [
    env.JAVA_HOME && path.join(env.JAVA_HOME, "bin", "java.exe"),
    onPath("java.exe"), "D:\\JDK\\jdk-21\\bin\\java.exe",
  ];
  for (const candidate of candidates.filter(Boolean)) {
    if (!fs.existsSync(candidate)) continue;
    const result = spawnSync(candidate, ["-version"], { encoding: "utf8", windowsHide: true });
    if (result.status === 0 && /version "21(?:\.|\")/.test(result.stderr + result.stdout)) {
      return path.dirname(path.dirname(fs.realpathSync(candidate)));
    }
  }
  throw new Error("未找到 JDK 21。请安装 JDK 21，并设置 JAVA_HOME 或加入 PATH。");
}

function maven(env) {
  const candidates = [
    env.MAVEN_HOME && path.join(env.MAVEN_HOME, "bin", "mvn.cmd"),
    env.M2_HOME && path.join(env.M2_HOME, "bin", "mvn.cmd"), onPath("mvn.cmd"),
    "D:\\JetBrains\\IntelliJ IDEA\\plugins\\maven-plugin\\lib\\maven3\\bin\\mvn.cmd",
  ];
  const command = candidates.find((item) => item && fs.existsSync(item));
  if (!command) throw new Error("未找到 Maven。请安装 Maven 3.9 并加入 PATH，或设置 MAVEN_HOME。");
  return command;
}

async function databaseReady(env) {
  const match = /^jdbc:mysql:\/\/([^/?]+)\//.exec(env.DB_URL);
  if (!match) throw new Error("DB_URL 应为 jdbc:mysql://主机:端口/数据库 的形式。");
  const url = new URL("mysql://" + match[1]);
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 3306) });
    const fail = () => { socket.destroy(); reject(new Error(`无法连接 MySQL ${url.host}。请先启动 MySQL 服务，再运行 start.cmd。`)); };
    socket.setTimeout(3000);
    socket.once("connect", () => { socket.destroy(); resolve(); });
    socket.once("error", fail);
    socket.once("timeout", fail);
  });
}

async function portFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`${port} 端口已占用。如果已在 IDEA 或其他窗口启动，请先停止那份服务；本入口不会结束已有进程。`)));
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

function launch(command, args, env, cwd = root) {
  if (stopping) throw new Error("启动已取消。");
  const child = spawn(command, args, {
    cwd, env, stdio: "inherit", windowsHide: true,
    windowsVerbatimArguments: path.basename(command).toLowerCase() === "cmd.exe",
  });
  const record = { child, exited: false, error: null };
  children.add(record);
  child.on("error", (error) => { record.error = error; record.exited = true; });
  child.on("exit", () => {
    record.exited = true;
    if (!stopping) {
      console.error("\n一个服务已经退出，请查看上方错误；正在停止本次启动的其他服务。");
      void stop(1);
    }
  });
  return record;
}

async function waitFor(url, record, accept, seconds = 120) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (stopping || record.exited) throw new Error(record.error?.message || "服务在就绪前退出，请查看上方启动日志。");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok && await accept(response)) return;
    } catch { /* Service is still starting. */ }
    await delay(500);
  }
  throw new Error(`等待 ${url} 超时，请查看上方服务日志。`);
}

async function stop(code) {
  if (stopping) return;
  stopping = true;
  // Ctrl+C reaches the shared console's children too; allow their normal shutdown first.
  const deadline = Date.now() + 2500;
  while ([...children].some((item) => !item.exited) && Date.now() < deadline) await delay(100);
  // Only PIDs spawned by this launcher are candidates for process-tree cleanup.
  await Promise.all([...children].filter((item) => !item.exited && item.child.pid).map(({ child }) =>
    new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", resolve);
      killer.once("exit", resolve);
    })));
  if (children.size) console.log("本次启动的服务已停止。");
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) {
  process.on(signal, () => { void stop(0); });
}

async function main() {
  if (options.has("--help")) {
    console.log("start.cmd              启动开发版（自动编译后端，前端热更新）\nstart.cmd --preview    启动已有 JAR 与前端打包产物\nstart.cmd --check      只检查配置、依赖、数据库连接与端口\nstart.cmd --no-open    启动但不自动打开浏览器");
    return;
  }
  for (const option of options) {
    if (!["--preview", "--check", "--no-open"].includes(option)) throw new Error(`未知参数 ${option}，可运行 start.cmd --help。`);
  }
  if (process.platform !== "win32") throw new Error("此入口用于 Windows；其他系统请参考 README 的构建说明。");
  const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
  if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 6)) throw new Error("请使用 Node.js 22.6 或更新版本。");
  const env = readSettings();
  env.JAVA_HOME = javaHome(env);
  const port = Number(env.PORT || 8081);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT 必须是 1–65535 的整数。");
  const preview = options.has("--preview");
  const webPort = preview ? 5180 : 5173;
  if (port === webPort) throw new Error("后端 PORT 不能与前端端口相同。");
  env.PORT = String(port);
  const host = env.SERVER_ADDRESS && !["0.0.0.0", "::"].includes(env.SERVER_ADDRESS) ? env.SERVER_ADDRESS : "127.0.0.1";
  env.API_TARGET = `http://${host}:${port}`;
  const java = path.join(env.JAVA_HOME, "bin", "java.exe");
  const jar = path.join(root, "backend", "target", "xuexu-backend-2.0.0.jar");
  const mvn = preview ? null : maven(env);
  if (preview && (!fs.existsSync(jar) || !fs.existsSync(path.join(root, "frontend", "dist", "index.html")))) {
    throw new Error("缺少打包产物，请先按 README 构建后端和前端，或直接运行 start.cmd 开发版。");
  }
  if (!preview && !fs.existsSync(path.join(root, "frontend", "node_modules", "vite", "bin", "vite.js"))) {
    throw new Error("缺少前端依赖。请先运行 pnpm.cmd --dir frontend install --frozen-lockfile。");
  }
  await databaseReady(env);
  await portFree(port);
  await portFree(webPort);
  console.log(`检查通过：JDK 21、${preview ? "已有构建产物" : "Maven 和前端依赖"}、MySQL、${port}/${webPort} 端口。`);
  if (options.has("--check")) return;
  console.log("[1/3] 正在启动后端，请等待编译与数据库连接完成……");
  // Maven is a Windows batch file. Only fixed flags and quoted executable/project paths enter cmd.exe.
  const backend = preview
    ? launch(java, ["-jar", jar], env)
    : launch(env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", `""${mvn}" -B -ntp -f "${path.join(root, "backend", "pom.xml")}" spring-boot:run"`], env);
  const healthy = async (response) => {
    const result = await response.json();
    return result.code === 1 && result.data?.status === "UP" && result.data?.version === "2.0.0";
  };
  await waitFor(`${env.API_TARGET}/health`, backend, healthy);
  console.log("[2/3] 后端已就绪，正在启动前端……");
  const frontend = preview
    ? launch(process.execPath, [path.join(root, "tools", "serve-production.mjs")], env)
    : launch(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--clearScreen", "false"], env, path.join(root, "frontend"));
  const url = `http://127.0.0.1:${webPort}/`;
  await waitFor(url + "api/health", frontend, healthy, 30);
  console.log(`[3/3] 学序已启动：${url}\n保持这个窗口打开；按 Ctrl+C 停止本次启动的前后端。\n登录密码见 runtime/local.env；已有演示数据无需重复导入。`);
  if (!options.has("--no-open")) {
    const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], { windowsHide: true, detached: true, stdio: "ignore" });
    browser.on("error", () => console.log(`请手动打开 ${url}`));
    browser.unref();
  }
}

main().catch((error) => {
  if (!stopping) console.error("\n启动失败：" + error.message);
  void stop(1);
});
