import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, parseCSV, parseStudentCSV, scoreLevel, studentCSV, validateStudent } from '../src/lib/domain.ts';
import type { Student, StudentInput } from '../src/types.ts';

const student:StudentInput={name:'测试同学',studentNo:'TEST2026',gender:'未说明',className:'计算机 2601',major:'计算机',phone:'13800000000',email:'test@campus.example',status:'在读',enrollmentDate:'2026-09-01'};

test('CSV: BOM、CRLF、嵌入逗号、引号、换行可正确读取',()=>{assert.deepEqual(parseCSV('\uFEFF学号,姓名\r\nS001,"测试,""同学""\n第二行"\r\n'),[['学号','姓名'],['S001','测试,"同学"\n第二行']]);});
test('CSV: 未闭合引号应报错，不能静默丢失后续记录',()=>{assert.throws(()=>parseCSV('a,b\n"unfinished,b'),/未闭合/);});
test('CSV: 拒绝闭合引号后的额外字符',()=>{assert.throws(()=>parseCSV('a,b\n"value"unexpected,test'),/无效字符/);});
test('学生导出与导入往返保留字段',()=>{assert.deepEqual(parseStudentCSV(studentCSV([student]),[]),[student]);});
test('任一行非法时整批解析失败，输入集合保持不变',()=>{const existing:Student[]=[{...student,id:'s1'}];const before=structuredClone(existing);const csv=studentCSV([{...student,studentNo:'NEW0001'}, {...student,studentNo:'NEW0002',email:'invalid'}]);assert.throws(()=>parseStudentCSV(csv,existing),/第 3 行.*邮箱/);assert.deepEqual(existing,before);});
test('学号在数据库或同一文件中重复时阻止导入',()=>{assert.throws(()=>parseStudentCSV(studentCSV([student]),[{...student,id:'s1'}]),/重复/);assert.throws(()=>parseStudentCSV(studentCSV([student,student]),[]),/第 3 行.*重复/);});
test('空文件与错误表头不应导入',()=>{assert.throws(()=>parseStudentCSV('',[]),/表头/);assert.throws(()=>parseStudentCSV('姓名,学号\n张三,20260001',[]),/表头/);assert.throws(()=>parseStudentCSV(studentCSV([]),[]),/没有学生记录/);});
test('成绩统计正确区分零分、未录入和评价边界',()=>{assert.equal(scoreLevel(null),'未录入');assert.equal(scoreLevel(0),'待提升');assert.equal(scoreLevel(59.9),'待提升');assert.equal(scoreLevel(60),'合格');assert.equal(scoreLevel(80),'良好');assert.equal(scoreLevel(90),'优秀');});
test('导出阻断电子表格公式并转义双引号',()=>{assert.equal(csvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);assert.equal(csvCell('  @cmd'),`"'  @cmd"`);assert.equal(csvCell('a"b'), '"a""b"');});
test('真实日期与手机校验覆盖非闰年 2 月 29 日',()=>{assert.equal(validateStudent(student),null);assert.match(validateStudent({...student,enrollmentDate:'2026-02-29'})||'',/日期/);assert.match(validateStudent({...student,phone:'123'})||'',/手机/);});
