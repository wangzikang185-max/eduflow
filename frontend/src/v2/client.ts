import type { Student, Course } from "../types";
export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  studentId: string | null;
  enabled?: number;
  version?: number;
}
export interface ClassRoom {
  id: string;
  name: string;
  major: string;
  studentCount: number;
  version: number;
}
export interface Exam {
  id: string;
  courseId: string;
  name: string;
  examDate: string;
  weight: number;
  version: number;
}
export interface Mark {
  id: string;
  studentId: string;
  courseId: string;
  examId: string;
  score: number | null;
  version: number;
}
export type VStudent = Student & { version: number };
export type VCourse = Course & { version: number };
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface GradeSheet {
  examId: string;
  exams: Exam[];
  students: VStudent[];
  grades: Mark[];
}
export type AttendanceStatus = "present" | "late" | "absent" | "leave";
export interface Roll {
  courseId: string;
  date: string;
  savedAt: string | null;
  version: number;
  students: VStudent[];
  records: { studentId: string; status: AttendanceStatus }[];
}
export interface Report {
  id: string;
  studentNo: string;
  name: string;
  className: string;
  courseId: string;
  courseName: string;
  recorded: number;
  expected: number;
  averageScore: number | null;
  attendanceTotal: number;
  attendancePresent: number;
  attendanceRate: number | null;
}
export interface Portal {
  student: VStudent;
  courses: VCourse[];
  enrolledIds: string[];
  grades: (Mark & {
    examName: string;
    examDate: string;
    courseName: string;
    weight: number;
  })[];
  attendance: {
    courseId: string;
    courseName: string;
    date: string;
    status: AttendanceStatus;
  }[];
}
export interface Audit {
  id: string;
  operator: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: string;
  message: string;
  createTime: string;
}
export interface Overview {
  studentCount: number;
  activeCount: number;
  courseCount: number;
  averageScore: number;
  attendanceRate: number;
  attendanceRecorded: number;
  gradeRecorded: number;
  recentStudents: VStudent[];
  classes: { name: string; count: number }[];
  trend: { month: string; current: number }[];
}
export const session = {
  get: () => sessionStorage.getItem("xuexu.token"),
  set: (token: string) => sessionStorage.setItem("xuexu.token", token),
  clear: () => sessionStorage.removeItem("xuexu.token"),
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  try {
    const token = session.get();
    const response = await fetch(
      (import.meta.env.VITE_API_BASE || "/api") + path,
      {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      },
    );
    let result: { code: number; msg: string; data: T };
    try {
      result = await response.json();
    } catch {
      throw new ApiError(response.status, "接口返回格式异常，请检查服务和代理");
    }
    if (response.status === 401 && path !== "/auth/login") {
      session.clear();
      window.dispatchEvent(new Event("xuexu:unauthorized"));
    }
    if (!response.ok || result.code !== 1)
      throw new ApiError(
        response.status,
        result.msg || `请求失败 (${response.status})`,
      );
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      error instanceof DOMException && error.name === "AbortError"
        ? "请求超时，请检查服务后重试"
        : "无法连接服务，请检查后端是否运行",
    );
  } finally {
    clearTimeout(timer);
  }
}
export function query(values: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  return "?" + p;
}
export async function allStudents() {
  let page = 1;
  const rows: VStudent[] = [];
  for (;;) {
    const data = await request<Page<VStudent>>(
      "/students" + query({ page, pageSize: 200 }),
    );
    rows.push(...data.items);
    if (rows.length >= data.total) return rows;
    page++;
  }
}
