import type { StudentInput } from "../types.ts";

const studentColumns = [
  "学号", "姓名", "性别", "班级", "手机号", "邮箱", "状态", "入学日期",
];

// Quote every CSV cell and prefix spreadsheet formulas so exports are safe to open.
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^\s*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function studentCSV(students: StudentInput[]): string {
  const rows = [
    studentColumns,
    ...students.map((student) => [
      student.studentNo,
      student.name,
      student.gender,
      student.className,
      student.phone,
      student.email,
      student.status,
      student.enrollmentDate,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadFile(
  name: string,
  content: string,
  type = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
