import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, studentCSV } from "../src/lib/domain.ts";
import type { StudentInput } from "../src/types.ts";

const student: StudentInput = {
  studentNo: "TEST2026",
  name: "测试同学",
  gender: "未说明",
  className: "任意新建班级",
  major: "计算机",
  phone: "13800000000",
  email: "test@campus.example",
  status: "在读",
  enrollmentDate: "2026-09-01",
};

test("CSV export includes BOM, headers and the dynamic class name", () => {
  const lines = studentCSV([student]).split("\r\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('\uFEFF"学号","姓名"'));
  assert.ok(lines[1].includes('"任意新建班级"'));
  assert.ok(lines[1].includes('"TEST2026"'));
});

test("CSV template has a header and no invented student records", () => {
  assert.equal(studentCSV([]).split("\r\n").length, 1);
});

test("CSV quotes embedded commas, quotes and newlines", () => {
  assert.equal(csvCell('甲,"乙"\n丙'), '"甲,""乙""\n丙"');
});

test("CSV prevents spreadsheet formulas, including with leading whitespace", () => {
  assert.equal(csvCell("=SUM(A1:A2)"), '"\'=SUM(A1:A2)"');
  assert.equal(csvCell("  @cmd"), '"\'  @cmd"');
  assert.equal(csvCell("normal"), '"normal"');
});

test("student export applies formula protection to actual record fields", () => {
  assert.ok(studentCSV([{ ...student, name: "=HYPERLINK(\"x\")" }]).includes('"\'=HYPERLINK(""x"")"'));
});
