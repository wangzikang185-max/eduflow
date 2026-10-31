export type StudentStatus = '在读' | '休学' | '已毕业';
export interface Student {
  id: string; studentNo: string; name: string; gender: '男' | '女' | '未说明';
  className: string; major: string; phone: string; email: string;
  status: StudentStatus; enrollmentDate: string;
}
export type StudentInput = Omit<Student, 'id'>;
export interface Course {
  id: string; code: string; name: string; description: string; teacher: string;
  category: string; credits: number; hours: number; enrolled: number;
  capacity: number; room: string; weekday: number; time: string; color: string;
}
