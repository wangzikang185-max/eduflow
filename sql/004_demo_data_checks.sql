-- Read-only checks for the V2 showcase data. Execute on the normal 3306/xuexu database.
USE xuexu;

SELECT '学生' AS 数据, COUNT(*) AS 数量 FROM eduflow_student
UNION ALL SELECT '班级', COUNT(*) FROM eduflow_class
UNION ALL SELECT '课程', COUNT(*) FROM eduflow_course
UNION ALL SELECT '选课', COUNT(*) FROM eduflow_enrollment
UNION ALL SELECT '考试', COUNT(*) FROM eduflow_exam
UNION ALL SELECT '成绩（含未录入）', COUNT(*) FROM eduflow_grade
UNION ALL SELECT '已录入成绩', COUNT(*) FROM eduflow_grade WHERE score IS NOT NULL
UNION ALL SELECT '考勤表', COUNT(*) FROM eduflow_attendance_sheet
UNION ALL SELECT '考勤明细', COUNT(*) FROM eduflow_attendance_record;

SELECT student_no, name, class_name, status
FROM eduflow_student WHERE student_no LIKE 'DEMO26%' ORDER BY student_no;

SELECT c.code, c.name, c.capacity, COUNT(e.student_id) AS enrolled
FROM eduflow_course c LEFT JOIN eduflow_enrollment e ON e.course_id = c.id
GROUP BY c.id ORDER BY c.code;

SELECT status, COUNT(*) AS count FROM eduflow_attendance_record GROUP BY status;

SELECT COUNT(*) AS orphan_enrollments
FROM eduflow_enrollment e
LEFT JOIN eduflow_student s ON s.id = e.student_id
LEFT JOIN eduflow_course c ON c.id = e.course_id
WHERE s.id IS NULL OR c.id IS NULL;

SELECT COUNT(*) AS orphan_grades
FROM eduflow_grade g
LEFT JOIN eduflow_student s ON s.id = g.student_id
LEFT JOIN eduflow_exam x ON x.id = g.exam_id
WHERE s.id IS NULL OR x.id IS NULL OR x.course_id <> g.course_id;

SELECT COUNT(*) AS orphan_attendance
FROM eduflow_attendance_record r
LEFT JOIN eduflow_student s ON s.id = r.student_id
LEFT JOIN eduflow_attendance_sheet a ON a.id = r.sheet_id
WHERE s.id IS NULL OR a.id IS NULL;
