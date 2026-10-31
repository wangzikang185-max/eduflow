-- No foreign keys. Existing student IDs and V1 grade/attendance history are retained.
CREATE TABLE eduflow_class (
 id VARCHAR(36) PRIMARY KEY, name VARCHAR(40) NOT NULL UNIQUE, major VARCHAR(40) NOT NULL,
 version INT NOT NULL DEFAULT 0, create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO eduflow_class(id,name,major)
 SELECT UUID(),class_name,MIN(major) FROM eduflow_student GROUP BY class_name;
INSERT IGNORE INTO eduflow_class(id,name,major) VALUES
 (UUID(),'计算机 2601','计算机'),(UUID(),'软件工程 2601','软件工程'),
 (UUID(),'数据科学 2601','数据科学'),(UUID(),'人工智能 2601','人工智能');
ALTER TABLE eduflow_student ADD COLUMN version INT NOT NULL DEFAULT 0;
ALTER TABLE eduflow_student ADD INDEX idx_student_class_status(class_name,status);
ALTER TABLE eduflow_course ADD COLUMN version INT NOT NULL DEFAULT 0;
CREATE TABLE eduflow_enrollment (
 course_id VARCHAR(36) NOT NULL, student_id VARCHAR(36) NOT NULL,
 create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(course_id,student_id),
 INDEX idx_enrollment_student(student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO eduflow_enrollment(course_id,student_id)
 SELECT course_id,student_id FROM eduflow_grade;
INSERT IGNORE INTO eduflow_enrollment(course_id,student_id)
 SELECT s.course_id,r.student_id FROM eduflow_attendance_record r
 JOIN eduflow_attendance_sheet s ON s.id=r.sheet_id;
CREATE TABLE eduflow_exam (
 id VARCHAR(36) PRIMARY KEY, course_id VARCHAR(36) NOT NULL, name VARCHAR(40) NOT NULL,
 exam_date DATE NOT NULL, weight DECIMAL(5,2) NOT NULL, version INT NOT NULL DEFAULT 0,
 UNIQUE KEY uk_exam_name(course_id,name), INDEX idx_exam_course(course_id),
 CHECK(weight>0 AND weight<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO eduflow_exam(id,course_id,name,exam_date,weight)
 SELECT UUID(),id,'课程考核',CURRENT_DATE,100 FROM eduflow_course;
ALTER TABLE eduflow_grade ADD COLUMN exam_id VARCHAR(36), ADD COLUMN version INT NOT NULL DEFAULT 0;
UPDATE eduflow_grade g JOIN eduflow_exam e ON e.course_id=g.course_id SET g.exam_id=e.id;
ALTER TABLE eduflow_grade MODIFY exam_id VARCHAR(36) NOT NULL,
 DROP INDEX uk_eduflow_grade_course_student, ADD UNIQUE KEY uk_grade_exam_student(exam_id,student_id);
ALTER TABLE eduflow_attendance_sheet ADD COLUMN version INT NOT NULL DEFAULT 0;
ALTER TABLE eduflow_user DROP CHECK ck_eduflow_user_role,
 ADD CONSTRAINT ck_eduflow_user_role CHECK(role IN ('ADMIN','TEACHER','STUDENT')),
 ADD COLUMN student_id VARCHAR(36) NULL, ADD COLUMN token_version INT NOT NULL DEFAULT 0,
 ADD UNIQUE KEY uk_user_student(student_id);
