package com.xuexu.mapper;

/** All dynamic values use #{p...}. The statement selector is a server-only enum. */
public enum WorkspaceSql {
  CLASSES(
      "SELECT c.*, (SELECT COUNT(*) FROM eduflow_student s WHERE s.class_name=c.name) student_count"
          + " FROM eduflow_class c ORDER BY c.name"),
  CLASSES_SCOPED(
      "SELECT c.*,(SELECT COUNT(*) FROM eduflow_student s WHERE s.class_name=c.name AND"
          + " EXISTS(SELECT 1 FROM eduflow_enrollment e JOIN eduflow_user_course u ON"
          + " u.course_id=e.course_id WHERE e.student_id=s.id AND u.user_id=#{p.userId}))"
          + " student_count FROM eduflow_class c WHERE EXISTS(SELECT 1 FROM eduflow_student s JOIN"
          + " eduflow_enrollment e ON e.student_id=s.id JOIN eduflow_user_course u ON"
          + " u.course_id=e.course_id WHERE s.class_name=c.name AND u.user_id=#{p.userId}) ORDER BY"
          + " c.name"),
  CLASS("SELECT * FROM eduflow_class WHERE name=#{p.name} FOR UPDATE"),
  CLASS_ID("SELECT * FROM eduflow_class WHERE id=#{p.id} FOR UPDATE"),
  CLASS_ADD("INSERT INTO eduflow_class(id,name,major) VALUES(#{p.id},#{p.name},#{p.major})"),
  CLASS_UPDATE(
      "UPDATE eduflow_class SET name=#{p.name},major=#{p.major},version=version+1 WHERE id=#{p.id}"
          + " AND version=#{p.version}"),
  CLASS_STUDENTS(
      "UPDATE eduflow_student SET class_name=#{p.name},major=#{p.major},version=version+1 WHERE"
          + " class_name=#{p.oldName}"),
  CLASS_DELETE("DELETE FROM eduflow_class WHERE id=#{p.id}"),
  CLASS_COUNT("SELECT COUNT(*) n FROM eduflow_student WHERE class_name=#{p.name}"),
  COURSES(
      "SELECT c.*,TIME_FORMAT(start_time,'%H:%i') start, TIME_FORMAT(end_time,'%H:%i') end, (SELECT"
          + " COUNT(*) FROM eduflow_enrollment e WHERE e.course_id=c.id) enrolled FROM"
          + " eduflow_course c WHERE (#{p.role}='ADMIN' OR (#{p.role}='TEACHER' AND EXISTS(SELECT 1"
          + " FROM eduflow_user_course u WHERE u.course_id=c.id AND u.user_id=#{p.userId})) OR"
          + " #{p.role}='STUDENT') ORDER BY c.code"),
  COURSE(
      "SELECT *,TIME_FORMAT(start_time,'%H:%i') start,TIME_FORMAT(end_time,'%H:%i') end FROM"
          + " eduflow_course WHERE id=#{p.id} FOR UPDATE"),
  COURSE_ADD(
      "INSERT INTO"
          + " eduflow_course(id,code,name,description,teacher,category,credits,hours,capacity,room,weekday,start_time,end_time,color)"
          + " VALUES(#{p.id},#{p.code},#{p.name},#{p.description},#{p.teacher},#{p.category},#{p.credits},#{p.hours},#{p.capacity},#{p.room},#{p.weekday},#{p.start},#{p.end},#{p.color})"),
  COURSE_UPDATE(
      "UPDATE eduflow_course SET"
          + " code=#{p.code},name=#{p.name},description=#{p.description},teacher=#{p.teacher},category=#{p.category},credits=#{p.credits},hours=#{p.hours},capacity=#{p.capacity},room=#{p.room},weekday=#{p.weekday},start_time=#{p.start},end_time=#{p.end},color=#{p.color},version=version+1"
          + " WHERE id=#{p.id} AND version=#{p.version}"),
  COURSE_DELETE("DELETE FROM eduflow_course WHERE id=#{p.id}"),
  COURSE_USED(
      "SELECT (SELECT COUNT(*) FROM eduflow_enrollment WHERE course_id=#{p.id})+(SELECT COUNT(*)"
          + " FROM eduflow_attendance_sheet WHERE course_id=#{p.id})+(SELECT COUNT(*) FROM"
          + " eduflow_grade WHERE course_id=#{p.id} AND score IS NOT NULL) n"),
  PERMISSION(
      "SELECT COUNT(*) n FROM eduflow_user_course WHERE user_id=#{p.userId} AND course_id=#{p.id}"),
  USER("SELECT * FROM eduflow_user WHERE id=#{p.id}"),
  USER_NAME("SELECT * FROM eduflow_user WHERE username=#{p.username}"),
  USERS(
      "SELECT id,username,display_name,role,enabled,student_id,token_version version FROM"
          + " eduflow_user ORDER BY username"),
  USER_ADD(
      "INSERT INTO eduflow_user(id,username,password_hash,display_name,role,student_id)"
          + " VALUES(#{p.id},#{p.username},#{p.passwordHash},#{p.displayName},#{p.role},#{p.studentId})"),
  USER_UPDATE(
      "UPDATE eduflow_user SET"
          + " display_name=#{p.displayName},enabled=#{p.enabled},token_version=token_version+1"
          + " WHERE id=#{p.id} AND token_version=#{p.version}"),
  PASSWORD(
      "UPDATE eduflow_user SET password_hash=#{p.passwordHash},token_version=token_version+1 WHERE"
          + " id=#{p.id}"),
  LOGOUT("UPDATE eduflow_user SET token_version=token_version+1 WHERE id=#{p.id}"),
  GRANT("INSERT INTO eduflow_user_course(user_id,course_id) VALUES(#{p.userId},#{p.id})"),
  REVOKE("DELETE FROM eduflow_user_course WHERE user_id=#{p.userId} AND course_id=#{p.id}"),
  GRANTS("SELECT course_id FROM eduflow_user_course WHERE user_id=#{p.id}"),
  REVOKE_COURSE("DELETE FROM eduflow_user_course WHERE course_id=#{p.id}"),
  ENROLLMENTS(
      "SELECT"
          + " s.id,s.student_no,s.name,s.gender,s.class_name,s.major,s.status,s.enrollment_date,s.version"
          + " FROM eduflow_student s JOIN eduflow_enrollment e ON e.student_id=s.id WHERE"
          + " e.course_id=#{p.id} ORDER BY s.student_no"),
  ENROLLED("SELECT COUNT(*) n FROM eduflow_enrollment WHERE course_id=#{p.id}"),
  ENROLLMENT(
      "SELECT COUNT(*) n FROM eduflow_enrollment WHERE course_id=#{p.id} AND"
          + " student_id=#{p.studentId}"),
  ENROLL_ADD("INSERT INTO eduflow_enrollment(course_id,student_id) VALUES(#{p.id},#{p.studentId})"),
  ENROLL_DELETE(
      "DELETE FROM eduflow_enrollment WHERE course_id=#{p.id} AND student_id=#{p.studentId}"),
  ENROLL_GRADES(
      "INSERT INTO eduflow_grade(id,course_id,exam_id,student_id) SELECT"
          + " UUID(),course_id,id,#{p.studentId} FROM eduflow_exam WHERE course_id=#{p.id}"),
  WITHDRAW_USED(
      "SELECT (SELECT COUNT(*) FROM eduflow_grade WHERE course_id=#{p.id} AND"
          + " student_id=#{p.studentId} AND score IS NOT NULL)+(SELECT COUNT(*) FROM"
          + " eduflow_attendance_record r JOIN eduflow_attendance_sheet s ON s.id=r.sheet_id WHERE"
          + " s.course_id=#{p.id} AND r.student_id=#{p.studentId}) n"),
  WITHDRAW_GRADES(
      "DELETE FROM eduflow_grade WHERE course_id=#{p.id} AND student_id=#{p.studentId}"),
  EXAMS("SELECT * FROM eduflow_exam WHERE course_id=#{p.id} ORDER BY exam_date,id"),
  EXAM("SELECT * FROM eduflow_exam WHERE id=#{p.examId} AND course_id=#{p.id}"),
  EXAM_ADD(
      "INSERT INTO eduflow_exam(id,course_id,name,exam_date,weight)"
          + " VALUES(#{p.examId},#{p.id},#{p.name},#{p.examDate},#{p.weight})"),
  EXAM_UPDATE(
      "UPDATE eduflow_exam SET"
          + " name=#{p.name},exam_date=#{p.examDate},weight=#{p.weight},version=version+1 WHERE"
          + " id=#{p.examId} AND course_id=#{p.id} AND version=#{p.version}"),
  EXAM_GRADES(
      "INSERT INTO eduflow_grade(id,course_id,exam_id,student_id) SELECT"
          + " UUID(),course_id,#{p.examId},student_id FROM eduflow_enrollment WHERE"
          + " course_id=#{p.id}"),
  EXAM_USED("SELECT COUNT(*) n FROM eduflow_grade WHERE exam_id=#{p.examId} AND score IS NOT NULL"),
  EXAM_DELETE("DELETE FROM eduflow_exam WHERE id=#{p.examId}"),
  EXAM_DELETE_GRADES("DELETE FROM eduflow_grade WHERE exam_id=#{p.examId}"),
  COURSE_DELETE_EXAMS("DELETE FROM eduflow_exam WHERE course_id=#{p.id}"),
  COURSE_DELETE_GRADES("DELETE FROM eduflow_grade WHERE course_id=#{p.id}"),
  GRADES("SELECT * FROM eduflow_grade WHERE exam_id=#{p.examId} ORDER BY student_id"),
  GRADE_UPDATE(
      "UPDATE eduflow_grade SET score=#{p.score},version=version+1 WHERE exam_id=#{p.examId} AND"
          + " student_id=#{p.studentId} AND version=#{p.version}"),
  SHEET(
      "SELECT id,course_id,attendance_date date,saved_at,version FROM eduflow_attendance_sheet"
          + " WHERE course_id=#{p.id} AND attendance_date=#{p.date}"),
  SHEET_ADD(
      "INSERT INTO eduflow_attendance_sheet(id,course_id,attendance_date)"
          + " VALUES(#{p.sheetId},#{p.id},#{p.date})"),
  SHEET_UPDATE(
      "UPDATE eduflow_attendance_sheet SET version=version+1,saved_at=CURRENT_TIMESTAMP(3) WHERE"
          + " id=#{p.sheetId} AND version=#{p.version}"),
  RECORDS(
      "SELECT student_id,status FROM eduflow_attendance_record WHERE sheet_id=#{p.sheetId} ORDER BY"
          + " student_id"),
  RECORD_STUDENTS(
      "SELECT"
          + " s.id,s.student_no,s.name,s.class_name,s.major,s.gender,s.status,s.enrollment_date,s.version"
          + " FROM eduflow_student s JOIN eduflow_attendance_record r ON r.student_id=s.id WHERE"
          + " r.sheet_id=#{p.sheetId} ORDER BY s.student_no"),
  RECORD_CLEAR("DELETE FROM eduflow_attendance_record WHERE sheet_id=#{p.sheetId}"),
  RECORD_ADD(
      "INSERT INTO eduflow_attendance_record(sheet_id,student_id,status)"
          + " VALUES(#{p.sheetId},#{p.studentId},#{p.status})"),
  STUDENT_LOCK("SELECT id FROM eduflow_student WHERE id=#{p.id} FOR UPDATE"),
  STUDENT_GRADES_DELETE("DELETE FROM eduflow_grade WHERE student_id=#{p.id}"),
  STUDENT_RECORDS_DELETE("DELETE FROM eduflow_attendance_record WHERE student_id=#{p.id}"),
  STUDENT_ENROLL_DELETE("DELETE FROM eduflow_enrollment WHERE student_id=#{p.id}"),
  STUDENT_USER_DISABLE(
      "UPDATE eduflow_user SET enabled=0,student_id=NULL,token_version=token_version+1 WHERE"
          + " student_id=#{p.id}"),
  AUDIT_ADD(
      "INSERT INTO"
          + " eduflow_operation_log(id,operator_id,action,target_type,target_id,before_data,after_data,result,message)"
          + " VALUES(#{p.id},#{p.operatorId},#{p.action},#{p.targetType},#{p.targetId},#{p.beforeData},#{p.afterData},#{p.result},#{p.message})"),
  AUDIT(
      "SELECT l.id,l.operator_id,u.display_name"
          + " operator,l.action,l.target_type,l.target_id,l.before_data,l.after_data,l.result,l.message,l.create_time"
          + " FROM eduflow_operation_log l LEFT JOIN eduflow_user u ON u.id=l.operator_id WHERE"
          + " (#{p.search}='' OR l.action LIKE CONCAT('%',#{p.search},'%')) ORDER BY l.create_time"
          + " DESC,l.id DESC LIMIT #{p.limit} OFFSET #{p.offset}"),
  AUDIT_COUNT(
      "SELECT COUNT(*) n FROM eduflow_operation_log WHERE (#{p.search}='' OR action LIKE"
          + " CONCAT('%',#{p.search},'%'))"),
  REPORT(
      """
      SELECT s.id,s.student_no,s.name,s.class_name,c.id course_id,c.name course_name,
      COUNT(g.score) recorded,COUNT(g.id) expected,
      ROUND(SUM(g.score*x.weight)/NULLIF(SUM(CASE WHEN g.score IS NOT NULL THEN x.weight ELSE 0 END),0),2) average_score,
      (SELECT COUNT(*) FROM eduflow_attendance_record r JOIN eduflow_attendance_sheet a ON a.id=r.sheet_id WHERE r.student_id=s.id AND a.course_id=c.id AND a.attendance_date BETWEEN #{p.from} AND #{p.to}) attendance_total,
      (SELECT COUNT(*) FROM eduflow_attendance_record r JOIN eduflow_attendance_sheet a ON a.id=r.sheet_id WHERE r.student_id=s.id AND a.course_id=c.id AND a.attendance_date BETWEEN #{p.from} AND #{p.to} AND r.status IN ('present','late')) attendance_present
      FROM eduflow_enrollment e JOIN eduflow_student s ON s.id=e.student_id JOIN eduflow_course c ON c.id=e.course_id
      LEFT JOIN eduflow_exam x ON x.course_id=c.id AND x.exam_date BETWEEN #{p.from} AND #{p.to}
      LEFT JOIN eduflow_grade g ON g.exam_id=x.id AND g.student_id=s.id
      WHERE (#{p.role}='ADMIN' OR (#{p.role}='TEACHER' AND EXISTS(SELECT 1 FROM eduflow_user_course u WHERE u.course_id=c.id AND u.user_id=#{p.userId})) OR (#{p.role}='STUDENT' AND s.id=#{p.studentId}))
      AND (#{p.courseId}='' OR c.id=#{p.courseId}) AND (#{p.className}='' OR s.class_name=#{p.className})
      GROUP BY s.id,s.student_no,s.name,s.class_name,c.id,c.name ORDER BY c.name,s.student_no
      """),
  MY_GRADES(
      "SELECT g.*,x.name exam_name,x.weight,x.exam_date,c.name course_name FROM eduflow_grade g"
          + " JOIN eduflow_exam x ON x.id=g.exam_id JOIN eduflow_course c ON c.id=g.course_id WHERE"
          + " g.student_id=#{p.id} ORDER BY x.exam_date DESC"),
  MY_ATTENDANCE(
      "SELECT a.course_id,c.name course_name,a.attendance_date date,r.status FROM"
          + " eduflow_attendance_record r JOIN eduflow_attendance_sheet a ON a.id=r.sheet_id JOIN"
          + " eduflow_course c ON c.id=a.course_id WHERE r.student_id=#{p.id} ORDER BY"
          + " a.attendance_date DESC"),
  TREND(
      "SELECT DATE_FORMAT(create_time,'%Y-%m') month,COUNT(*) current FROM eduflow_student GROUP BY"
          + " DATE_FORMAT(create_time,'%Y-%m') ORDER BY month DESC LIMIT 12");
  public final String sql;

  WorkspaceSql(String sql) {
    this.sql = sql;
  }
}
