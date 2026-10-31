import type { Student, StudentInput } from '../types.ts';

export const CLASSES = ['计算机 2601', '软件工程 2601', '数据科学 2601', '人工智能 2601'];
export function validateStudent(value: StudentInput): string | null {
  if (!value.name.trim() || value.name.trim().length > 30) return '姓名必填，且不超过 30 个字符';
  if (!/^[A-Za-z0-9-]{4,20}$/.test(value.studentNo)) return '学号应为 4–20 位字母、数字或短横线';
  if (!CLASSES.includes(value.className)) return '请选择有效的所属班级';
  if (!['男', '女', '未说明'].includes(value.gender)) return '请选择有效的性别';
  if (!['在读', '休学', '已毕业'].includes(value.status)) return '请选择有效的学籍状态';
  if (value.phone && !/^1[3-9]\d{9}$/.test(value.phone)) return '请输入有效的 11 位手机号码';
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return '请输入有效的电子邮箱';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.enrollmentDate) || Number.isNaN(Date.parse(value.enrollmentDate)) || new Date(value.enrollmentDate).toISOString().slice(0, 10) !== value.enrollmentDate) return '请输入有效的入学日期';
  return null;
}
export function scoreLevel(score: number | null) {
  return score === null ? '未录入' : score >= 90 ? '优秀' : score >= 80 ? '良好' : score >= 60 ? '合格' : '待提升';
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let closedQuote = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if(closedQuote && c!==',' && c!=='\n' && c!=='\r') { if(c===' '||c==='\t')continue; throw new Error('CSV 闭合引号后存在无效字符'); }
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) { quoted = false; closedQuote = true; }
      else if (cell.length === 0) quoted = true;
      else throw new Error('CSV 引号格式错误');
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; closedQuote=false; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; closedQuote=false;
    } else cell += c;
  }
  if (quoted) throw new Error('CSV 存在未闭合的引号');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function studentCSV(students: StudentInput[]) {
  return '\uFEFF' + [['学号', '姓名', '性别', '班级', '手机号', '邮箱', '状态', '入学日期'], ...students.map(s => [s.studentNo, s.name, s.gender, s.className, s.phone, s.email, s.status, s.enrollmentDate])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function parseStudentCSV(text: string, existing: Student[]): StudentInput[] {
  const [header, ...rows] = parseCSV(text);
  const expected = ['学号', '姓名', '性别', '班级', '手机号', '邮箱', '状态', '入学日期'];
  if (!header || header.map(s => s.trim()).join(',') !== expected.join(',')) throw new Error('表头不匹配，请先下载 CSV 模板');
  if (!rows.length) throw new Error('文件中没有学生记录');
  if (rows.length > 500) throw new Error('单次最多导入 500 条记录');
  const seen = new Set(existing.map(s => s.studentNo));
  return rows.map((row, i) => {
    if (row.length !== 8) throw new Error(`第 ${i + 2} 行：应包含 8 列`);
    const [studentNo, name, gender, className, phone, email, status, enrollmentDate] = row.map(s => s.trim());
    const student = { studentNo, name, gender, className, major: className.replace(/\s\d+$/, ''), phone, email, status, enrollmentDate } as StudentInput;
    const error = validateStudent(student);
    if (error) throw new Error(`第 ${i + 2} 行：${error}`);
    if (seen.has(studentNo)) throw new Error(`第 ${i + 2} 行：学号 ${studentNo} 已存在或文件内重复`);
    seen.add(studentNo); return student;
  });
}
export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
