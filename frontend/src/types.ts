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
export interface Grade { id: string; studentId: string; courseId: string; score: number | null; }
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';
export interface Attendance { studentId: string; status: AttendanceStatus; }
export interface AttendanceSheet { date: string; courseId: string; records: Attendance[]; savedAt: string | null; }
export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number; }
export interface StudentQuery { search?: string; className?: string; status?: string; page?: number; pageSize?: number; }
export interface Overview {
  studentCount: number; activeCount: number; courseCount: number; averageScore: number;
  attendanceRate: number; recentStudents: Student[];
  trend: { month: string; current: number; previous: number }[];
  classes: { name: string; count: number }[];
}
