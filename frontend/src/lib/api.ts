import type { AttendanceSheet, AttendanceStatus, Course, Grade, Overview, PageResult, Student, StudentInput, StudentQuery } from '../types';
import { courses, makeGrades, makeStudents } from './seed';
import { parseStudentCSV, validateStudent } from './domain';

export const IS_MOCK = import.meta.env.VITE_API_MODE === 'mock';
const KEY = 'xuexu.workspace.v1';
interface Database { version: 1; students: Student[]; courses: Course[]; grades: Grade[]; attendance: Record<string, AttendanceSheet>; }
function read(): Database {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { const data = JSON.parse(raw); if (data.version === 1 && Array.isArray(data.students) && Array.isArray(data.courses) && Array.isArray(data.grades) && data.attendance) return data; }
    catch { /* Show an actionable error without overwriting saved data. */ }
    throw new Error('本地演示数据无法读取，请在设置中重置演示数据');
  }
  const students = makeStudents();
  return { version: 1, students, courses: structuredClone(courses), grades: makeGrades(students), attendance: {} };
}
function write(data: Database) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { throw new Error('浏览器存储不可用或空间不足，本次修改未保存'); }
}
async function mock<T>(run: () => T): Promise<T> { await new Promise(r => setTimeout(r, 180)); return run(); }
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, credentials: 'include', signal: controller.signal });
    // 先读响应体：后端出错时（400/404/409）也会返回 {code:0,msg}，要把 msg 显示给用户。
    const result = await response.json().catch(() => null);
    if (response.ok && result?.code === 1) return result.data;
    if (result?.msg) throw new Error(result.msg);
    if (response.status === 401) throw new Error('登录已过期，请重新登录');
    throw new Error(response.ok ? '操作失败，请稍后重试' : `请求失败（HTTP ${response.status}）`);
  } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') throw new Error('请求超时，请检查网络后重试'); throw e; }
  finally { clearTimeout(timeout); }
}
function query(data: object) { return new URLSearchParams(Object.entries(data).filter(([,v]) => v !== undefined && v !== '').map(([k,v]) => [k,String(v)])).toString(); }
function checkedStudent(input: StudentInput, students: Student[], id?: string) {
  const normalized = { ...input, name: input.name.trim(), studentNo: input.studentNo.trim(), email: input.email.trim(), phone: input.phone.trim() };
  const error = validateStudent(normalized); if (error) throw new Error(error);
  if (students.some(s => s.studentNo === normalized.studentNo && s.id !== id)) throw new Error('该学号已存在，请检查后重试');
  return normalized;
}
export const api = {
  getOverview: (): Promise<Overview> => IS_MOCK ? mock(() => {
    const db = read(); const scores = db.grades.map(g => g.score).filter((x): x is number => x !== null);
    const saved = Object.values(db.attendance).flatMap(s => s.records);
    return { studentCount: db.students.length, activeCount: db.students.filter(s => s.status === '在读').length, courseCount: db.courses.length,
      averageScore: scores.length ? +(scores.reduce((a,b) => a+b,0) / scores.length).toFixed(1) : 0,
      attendanceRate: saved.length ? +(saved.filter(r => r.status === 'present' || r.status === 'late').length / saved.length * 100).toFixed(1) : 96.8,
      recentStudents: db.students.slice(-5).reverse(),
      trend: [{month:'5月',current:76,previous:72},{month:'6月',current:81,previous:76},{month:'7月',current:79,previous:74},{month:'8月',current:86,previous:79},{month:'9月',current:83,previous:77},{month:'10月',current:scores.length?+(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1):0,previous:80}],
      classes: ['计算机 2601','软件工程 2601','数据科学 2601','人工智能 2601'].map(name => ({name,count:db.students.filter(s=>s.className===name).length})),
    };
  }) : http('/dashboard/overview'),
  getStudents: (params: StudentQuery = {}): Promise<PageResult<Student>> => IS_MOCK ? mock(() => {
    const { search = '', className, status, page = 1, pageSize = 10 } = params;
    const items = read().students.filter(s => (!search || `${s.name} ${s.studentNo} ${s.phone}`.toLowerCase().includes(search.toLowerCase())) && (!className || s.className === className) && (!status || s.status === status));
    return { items: items.slice((page-1)*pageSize, page*pageSize), total: items.length, page, pageSize };
  }) : http(`/students?${query(params)}`),
  saveStudent: (input: StudentInput, id?: string): Promise<Student> => IS_MOCK ? mock(() => {
    const db = read(); if (id && !db.students.some(s=>s.id===id)) throw new Error('学生记录不存在');
    const student = { ...checkedStudent(input, db.students, id), id: id || crypto.randomUUID() };
    db.students = id ? db.students.map(s => s.id === id ? student : s) : [...db.students, student];
    if (!id) { if(db.courses.some(c=>c.enrolled>=c.capacity))throw new Error('有课程已达人数上限，请先调整课程容量'); db.grades.push(...db.courses.map(c => ({ id:`${c.id}-${student.id}`, courseId:c.id, studentId:student.id, score:null }))); db.courses.forEach(c => c.enrolled++); }
    write(db); return student;
  }) : http(id ? `/students/${id}` : '/students', { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }),
  deleteStudents: (ids: string[]): Promise<void> => IS_MOCK ? mock(() => {
    const db = read(); const count = db.students.filter(s => ids.includes(s.id)).length;
    db.students = db.students.filter(s => !ids.includes(s.id)); db.grades = db.grades.filter(g => !ids.includes(g.studentId));
    Object.values(db.attendance).forEach(sheet => sheet.records = sheet.records.filter(r => !ids.includes(r.studentId)));
    db.courses.forEach(c => c.enrolled = Math.max(0, c.enrolled-count)); write(db);
  }) : http('/students/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  importStudents: (csv: string): Promise<{ imported: number }> => IS_MOCK ? mock(() => {
    const db = read(); const added = parseStudentCSV(csv, db.students).map(s => ({ ...s, id: crypto.randomUUID() }));
    if(db.courses.some(c=>c.enrolled+added.length>c.capacity))throw new Error('导入后将超过课程容量，请先在课程管理中调整容量');
    db.students.push(...added); db.grades.push(...db.courses.flatMap(c=>added.map(s=>({ id:`${c.id}-${s.id}`,courseId:c.id,studentId:s.id,score:null }))));
    db.courses.forEach(c=>c.enrolled+=added.length); write(db); return { imported: added.length };
  }) : http('/students/import', { method:'POST', body: JSON.stringify({ csv }) }),
  getCourses: (): Promise<Course[]> => IS_MOCK ? mock(() => read().courses) : http('/courses'),
  saveCourse: (input: Course): Promise<Course> => IS_MOCK ? mock(() => {
    const db = read(); const creating = !input.id;
    if (!creating && !db.courses.some(c=>c.id===input.id)) throw new Error('课程不存在');
    if (!input.name.trim() || !input.teacher.trim() || !input.room.trim()) throw new Error('请填写课程名称、教师和上课地点');
    if (!/^[A-Za-z0-9-]{2,20}$/.test(input.code)) throw new Error('课程编号应为 2–20 位字母、数字或短横线');
    if(input.name.length>40 || !['专业必修','公共基础','专业选修'].includes(input.category))throw new Error('课程名称或类别无效');
    if(!Number.isFinite(input.credits)||input.credits<0.5||input.credits>10||!Number.isInteger(input.hours)||input.hours<1||input.hours>300)throw new Error('学分应为 0.5–10，课时应为 1–300 的整数');
    const enrolled=creating?db.students.length:db.courses.find(c=>c.id===input.id)!.enrolled;
    if (!Number.isInteger(input.capacity) || input.capacity < Math.max(1,enrolled) || input.capacity > 10000) throw new Error('课程容量不可小于已选人数，且须为 1–10000 的整数');
    if(!Number.isInteger(input.weekday)||input.weekday<1||input.weekday>7||!['orange','blue','purple','teal','pink','amber'].includes(input.color))throw new Error('上课星期或课程颜色无效');
    const time=input.time.match(/^([01]\d|2[0-3]):([0-5]\d)[–-]([01]\d|2[0-3]):([0-5]\d)$/);
    if(!time || +time[1]*60+(+time[2])>=+time[3]*60+(+time[4]))throw new Error('请输入有效的上课时间段，结束须晚于开始');
    if (db.courses.some(c=>c.code===input.code&&c.id!==input.id)) throw new Error('课程编号已存在');
    const course = { ...input, enrolled, id: input.id || crypto.randomUUID() };
    if(creating){ course.enrolled=db.students.length; if(course.capacity<course.enrolled)throw new Error(`容量不可小于学生数 ${course.enrolled}`); db.courses.push(course); db.grades.push(...db.students.map(s=>({id:`${course.id}-${s.id}`,courseId:course.id,studentId:s.id,score:null}))); }
    else db.courses = db.courses.map(c=>c.id===input.id?course:c);
    write(db); return course;
  }) : http(input.id?`/courses/${input.id}`:'/courses', { method:input.id?'PUT':'POST', body:JSON.stringify(input) }),
  getGrades: (courseId: string): Promise<{ students: Student[]; grades: Grade[] }> => IS_MOCK ? mock(() => {
    const db=read(); return { students:db.students, grades:db.grades.filter(g=>g.courseId===courseId) };
  }) : http(`/grades?${query({courseId})}`),
  saveGrades: (courseId: string, scores: { studentId: string; score: number | null }[]): Promise<void> => IS_MOCK ? mock(() => {
    const db=read(); if (!db.courses.some(c=>c.id===courseId)) throw new Error('课程不存在');
    if (new Set(scores.map(s=>s.studentId)).size !== scores.length) throw new Error('包含重复的学生成绩');
    scores.forEach(s=> { if (s.score!==null && (!Number.isFinite(s.score) || s.score<0 || s.score>100)) throw new Error('成绩必须在 0–100 之间'); if (!db.students.some(x=>x.id===s.studentId)) throw new Error('学生不存在'); });
    scores.forEach(s=> { const g=db.grades.find(g=>g.courseId===courseId&&g.studentId===s.studentId); if(g) g.score=s.score; else db.grades.push({id:`${courseId}-${s.studentId}`,courseId,...s}); }); write(db);
  }) : http('/grades/batch', {method:'PUT',body:JSON.stringify({courseId,scores})}),
  getAttendance: (date: string, courseId: string): Promise<AttendanceSheet & { students: Student[] }> => IS_MOCK ? mock(() => {
    const db=read(); const saved=db.attendance[`${date}-${courseId}`];
    return { date, courseId, savedAt:saved?.savedAt || null, records:db.students.filter(s=>s.status==='在读').map(s=>saved?.records.find(r=>r.studentId===s.id)||{studentId:s.id,status:'present' as const}), students:db.students.filter(s=>s.status==='在读') };
  }) : http(`/attendance?${query({date,courseId})}`),
  saveAttendance: (date: string, courseId: string, records: { studentId: string; status: AttendanceStatus }[]): Promise<void> => IS_MOCK ? mock(() => {
    const db=read(); if(!db.courses.some(c=>c.id===courseId)) throw new Error('课程不存在');
    if (new Set(records.map(r=>r.studentId)).size!==records.length || records.some(r=>!['present','late','absent','leave'].includes(r.status)||!db.students.some(s=>s.id===r.studentId))) throw new Error('考勤记录无效');
    db.attendance[`${date}-${courseId}`]={date,courseId,records,savedAt:new Date().toISOString()}; write(db);
  }) : http('/attendance/batch',{method:'PUT',body:JSON.stringify({date,courseId,records})}),
  resetDemo: () => { if (IS_MOCK) localStorage.removeItem(KEY); },
};
