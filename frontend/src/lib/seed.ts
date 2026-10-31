import type { Student, Course, Grade } from '../types';
import { CLASSES } from './domain';

export const courses: Course[] = [
  { id: 'c1', code: 'CS101', name: '计算机程序设计', description: '从问题分析到程序实现，建立扎实的编程基础。', teacher: '张明远', category: '专业必修', credits: 4, hours: 64, enrolled: 128, capacity: 150, room: '知行楼 A302', weekday: 1, time: '08:30–10:10', color: 'orange' },
  { id: 'c2', code: 'MA102', name: '高等数学 A', description: '理解微积分的核心思想，培养数学建模能力。', teacher: '李文静', category: '公共基础', credits: 5, hours: 80, enrolled: 128, capacity: 150, room: '明德楼 B201', weekday: 1, time: '10:30–12:10', color: 'blue' },
  { id: 'c3', code: 'CS203', name: '数据结构与算法', description: '掌握常见数据结构与算法，构建高效解决方案。', teacher: '王景川', category: '专业必修', credits: 4, hours: 64, enrolled: 128, capacity: 150, room: '知行楼 A305', weekday: 3, time: '14:00–15:40', color: 'purple' },
  { id: 'c4', code: 'CS205', name: '数据库原理', description: '学习关系数据库设计、SQL 与事务处理。', teacher: '陈思涵', category: '专业必修', credits: 3, hours: 48, enrolled: 128, capacity: 150, room: '实验楼 C402', weekday: 4, time: '08:30–10:10', color: 'teal' },
  { id: 'c5', code: 'EN101', name: '大学英语', description: '提升学术阅读、交流表达与跨文化沟通能力。', teacher: '刘语桐', category: '公共基础', credits: 3, hours: 48, enrolled: 128, capacity: 150, room: '明德楼 B305', weekday: 5, time: '10:30–12:10', color: 'pink' },
  { id: 'c6', code: 'DS201', name: '数据可视化', description: '用数据讲述故事，探索清晰而有力的视觉表达。', teacher: '周奕然', category: '专业选修', credits: 2, hours: 32, enrolled: 128, capacity: 150, room: '实验楼 C301', weekday: 2, time: '14:00–15:40', color: 'amber' },
];
export function makeStudents(): Student[] {
  const firstNames = ['林沐辰', '陈雨桐', '李子轩', '张欣然', '王浩宇', '赵一诺', '周予安', '吴思远', '徐可欣', '孙景行', '胡语宁', '朱书瑶', '高梓涵', '何承泽', '郭知夏', '马星野'];
  const lastNames = ['林', '陈', '李', '张', '王', '赵', '周', '吴', '徐', '孙', '胡', '朱', '高', '何', '郭', '马'];
  const givenNames = ['清和', '嘉言', '明轩', '知予', '云舒', '书宁', '景辰'];
  return Array.from({ length: 128 }, (_, i) => ({
    id: `s${i + 1}`, studentNo: `2026${String(i + 1).padStart(4, '0')}`,
    name: i < 16 ? firstNames[i] : lastNames[i % 16] + givenNames[Math.floor(i / 16) - 1],
    gender: i % 3 === 1 ? '女' : '男', className: CLASSES[i % 4], major: CLASSES[i % 4].replace(/\s\d+$/, ''),
    phone: `138${String(10000000 + i * 791)}`, email: `student${i + 1}@campus.example`,
    status: i === 23 || i === 57 ? '休学' : '在读', enrollmentDate: '2026-09-01',
  }));
}
export function makeGrades(students: Student[]): Grade[] {
  return courses.flatMap((c, ci) => students.map((s, i) => ({ id: `${c.id}-${s.id}`, courseId: c.id, studentId: s.id, score: i % 31 === 30 ? null : Math.min(100, 65 + ((i * 7 + ci * 3 + 27) % 36)) })));
}
