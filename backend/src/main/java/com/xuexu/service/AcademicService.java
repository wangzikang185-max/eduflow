package com.xuexu.service;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;
import static com.xuexu.service.Rules.*;

import com.xuexu.mapper.*;
import com.xuexu.pojo.Student;
import com.xuexu.security.CurrentUser;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AcademicService {
  private final WorkspaceStore db;
  private final StudentMapper students;
  private final CurrentUser current;

  public AcademicService(WorkspaceStore db, StudentMapper students, CurrentUser current) {
    this.db = db;
    this.students = students;
    this.current = current;
  }

  public List<Map<String, Object>> classes() {
    current.staff();
    return current.role().equals("ADMIN")
        ? db.rows(CLASSES, p())
        : db.rows(CLASSES_SCOPED, current.scope());
  }

  @Transactional
  public Map<String, Object> saveClass(String id, Map<String, Object> input) {
    current.admin();
    var args =
        p(
            "id",
            id == null ? id() : id,
            "name",
            text(input, "name", 1, 40),
            "major",
            text(input, "major", 1, 40));
    if (id == null) db.write(CLASS_ADD, args);
    else {
      var old = db.one(CLASS_ID, p("id", id));
      if (old == null) throw missing();
      version(input, old);
      args.put("version", input.get("version"));
      if (db.write(CLASS_UPDATE, args) != 1) throw conflict();
      args.put("oldName", old.get("name"));
      db.write(CLASS_STUDENTS, args);
    }
    return db.one(CLASS_ID, p("id", args.get("id")));
  }

  @Transactional
  public void deleteClass(String id, int version) {
    current.admin();
    var row = db.one(CLASS_ID, p("id", id));
    if (row == null) throw missing();
    version(p("version", version), row);
    if (db.count(CLASS_COUNT, p("name", row.get("name"))) > 0) throw bad("班级仍有学生，请先调整学生班级");
    db.write(CLASS_DELETE, p("id", id));
  }

  public List<Map<String, Object>> courses() {
    var rows = db.rows(COURSES, current.scope());
    for (var c : rows) c.put("time", c.get("start") + "–" + c.get("end"));
    return rows;
  }

  public Map<String, Object> course(String id) {
    var c = db.one(COURSE, p("id", id));
    if (c == null) throw missing();
    return c;
  }

  @Transactional
  public Map<String, Object> saveCourse(String id, Map<String, Object> input) {
    current.admin();
    var args = new LinkedHashMap<String, Object>();
    args.put("id", id == null ? id() : id);
    String code = text(input, "code", 2, 20);
    if (!code.matches("[A-Za-z0-9-]+")) throw bad("课程代码应为字母、数字或短横线");
    args.put("code", code);
    for (var field : List.of("name", "teacher", "room"))
      args.put(
          field,
          text(input, field, 1, field.equals("name") ? 40 : field.equals("teacher") ? 50 : 100));
    args.put("description", text(input, "description", 0, 200));
    args.put("category", choice(input, "category", "专业必修", "专业选修", "公共基础"));
    BigDecimal credits = decimal(input, "credits", new BigDecimal("0.5"), new BigDecimal("10"), 1);
    if (credits.remainder(new BigDecimal("0.5")).signum() != 0) throw bad("学分步长应为 0.5");
    args.put("credits", credits);
    args.put("hours", integer(input, "hours", 1, 300));
    args.put("capacity", integer(input, "capacity", 1, 10000));
    args.put("weekday", integer(input, "weekday", 1, 7));
    args.put("color", choice(input, "color", "orange", "blue", "purple", "amber", "pink", "teal"));
    String time = text(input, "time", 11, 13).replace('–', '-').replace('—', '-');
    if (!time.matches("\\d{2}:\\d{2}\\s?-\\s?\\d{2}:\\d{2}")) throw bad("时间格式应为 HH:mm–HH:mm");
    var parts = time.split("-");
    try {
      LocalTime start = LocalTime.parse(parts[0].trim()), end = LocalTime.parse(parts[1].trim());
      if (!end.isAfter(start)) throw bad("结束时间必须晚于开始时间");
      args.put("start", start);
      args.put("end", end);
    } catch (java.time.DateTimeException e) {
      throw bad("课程时间无效");
    }
    if (id == null) {
      db.write(COURSE_ADD, args);
      var exam =
          p(
              "id",
              args.get("id"),
              "examId",
              id(),
              "name",
              "课程考核",
              "examDate",
              java.time.LocalDate.now(),
              "weight",
              100);
      db.write(EXAM_ADD, exam);
    } else {
      var old = course(id);
      version(input, old);
      if (db.count(ENROLLED, p("id", id)) > ((Number) args.get("capacity")).intValue())
        throw bad("容量不能低于已选人数");
      args.put("version", input.get("version"));
      if (db.write(COURSE_UPDATE, args) != 1) throw conflict();
    }
    return courses().stream()
        .filter(c -> c.get("id").equals(args.get("id")))
        .findFirst()
        .orElseThrow();
  }

  @Transactional
  public void deleteCourse(String id, int version) {
    current.admin();
    version(p("version", version), course(id));
    if (db.count(COURSE_USED, p("id", id)) > 0) throw bad("课程存在选课或历史记录，不能删除");
    db.write(COURSE_DELETE_GRADES, p("id", id));
    db.write(COURSE_DELETE_EXAMS, p("id", id));
    db.write(REVOKE_COURSE, p("id", id));
    db.write(COURSE_DELETE, p("id", id));
  }

  public List<Map<String, Object>> roster(String id) {
    current.course(id);
    course(id);
    return db.rows(ENROLLMENTS, p("id", id));
  }

  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
  public void enroll(String id, List<String> ids, boolean add) {
    var user = current.user();
    if (!user.get("role").equals("ADMIN")) {
      if (!user.get("role").equals("STUDENT")
          || ids == null
          || ids.size() != 1
          || !Objects.equals(ids.getFirst(), user.get("studentId"))) throw CurrentUser.forbidden();
    }
    if (ids == null
        || ids.isEmpty()
        || ids.size() > 500
        || new HashSet<>(ids).size() != ids.size()
        || ids.stream().anyMatch(Objects::isNull)) throw bad("请选择 1–500 个不同学生");
    var c = course(id);
    if (add
        && db.count(ENROLLED, p("id", id)) + ids.size() > ((Number) c.get("capacity")).longValue())
      throw bad("课程容量不足");
    for (String sid : ids.stream().sorted().toList()) {
      if (db.one(STUDENT_LOCK, p("id", sid)) == null) throw missing();
      Student s = students.findById(sid);
      var args = p("id", id, "studentId", sid);
      boolean exists = db.count(ENROLLMENT, args) > 0;
      if (add) {
        if (!s.getStatus().equals("在读")) throw bad("仅在读学生可以选课");
        if (exists) throw bad("该学生已选此课程");
        db.write(ENROLL_ADD, args);
        db.write(ENROLL_GRADES, args);
      } else {
        if (!exists) throw missing();
        if (db.count(WITHDRAW_USED, args) > 0) throw bad("已有成绩或考勤，不能退课");
        db.write(WITHDRAW_GRADES, args);
        db.write(ENROLL_DELETE, args);
      }
    }
  }

  public List<Map<String, Object>> exams(String courseId) {
    current.course(courseId);
    course(courseId);
    return db.rows(EXAMS, p("id", courseId));
  }

  @Transactional
  public Map<String, Object> saveExam(String courseId, String examId, Map<String, Object> input) {
    current.course(courseId);
    course(courseId);
    var args =
        p(
            "id",
            courseId,
            "examId",
            examId == null ? id() : examId,
            "name",
            text(input, "name", 1, 40),
            "examDate",
            date(input, "examDate"),
            "weight",
            decimal(input, "weight", new BigDecimal("0.01"), new BigDecimal("100"), 2));
    if (examId == null) {
      db.write(EXAM_ADD, args);
      db.write(EXAM_GRADES, args);
    } else {
      var row = db.one(EXAM, args);
      if (row == null) throw missing();
      version(input, row);
      args.put("version", input.get("version"));
      if (db.write(EXAM_UPDATE, args) != 1) throw conflict();
    }
    return db.one(EXAM, args);
  }

  @Transactional
  public void deleteExam(String courseId, String examId, int version) {
    current.course(courseId);
    course(courseId);
    var args = p("id", courseId, "examId", examId);
    var row = db.one(EXAM, args);
    if (row == null) throw missing();
    version(p("version", version), row);
    if (db.count(EXAM_USED, args) > 0) throw bad("考试已有成绩，不能删除");
    db.write(EXAM_DELETE_GRADES, args);
    db.write(EXAM_DELETE, args);
  }

  public Map<String, Object> grades(String courseId, String examId) {
    current.course(courseId);
    course(courseId);
    var exams = db.rows(EXAMS, p("id", courseId));
    if (examId == null || examId.isBlank()) {
      if (exams.isEmpty()) throw bad("请先建立考试");
      examId = exams.getFirst().get("id").toString();
    }
    var args = p("id", courseId, "examId", examId);
    if (db.one(EXAM, args) == null) throw missing();
    return p(
        "examId",
        examId,
        "exams",
        exams,
        "students",
        db.rows(ENROLLMENTS, p("id", courseId)),
        "grades",
        db.rows(GRADES, args));
  }

  @Transactional
  public Map<String, Object> saveGrades(Map<String, Object> input) {
    String courseId = text(input, "courseId", 1, 36), examId = text(input, "examId", 1, 36);
    current.course(courseId);
    course(courseId);
    var args = p("id", courseId, "examId", examId);
    if (db.one(EXAM, args) == null) throw missing();
    var scores = list(input, "scores", 10000);
    Set<String> seen = new HashSet<>();
    List<Map<String, Object>> updates = new ArrayList<>();
    for (var row : scores) {
      String studentId = text(row, "studentId", 1, 36);
      if (!seen.add(studentId)
          || db.count(ENROLLMENT, p("id", courseId, "studentId", studentId)) == 0)
        throw bad("学生重复或没有选此课程");
      if (!row.containsKey("score")) throw bad("请提交 score，清空时使用 null");
      Object score =
          row.get("score") == null
              ? null
              : decimal(row, "score", BigDecimal.ZERO, new BigDecimal("100"), 2);
      updates.add(
          p(
              "examId",
              examId,
              "studentId",
              studentId,
              "score",
              score,
              "version",
              integer(row, "version", 0, Integer.MAX_VALUE)));
    }
    updates.sort(Comparator.comparing(r -> r.get("studentId").toString()));
    for (var row : updates) if (db.write(GRADE_UPDATE, row) != 1) throw conflict();
    return grades(courseId, examId);
  }

  public Map<String, Object> attendance(String courseId, String date) {
    current.course(courseId);
    course(courseId);
    date(p("date", date), "date");
    var sheet = db.one(SHEET, p("id", courseId, "date", date));
    List<Map<String, Object>> roster;
    List<Map<String, Object>> records;
    if (sheet == null) {
      roster =
          db.rows(ENROLLMENTS, p("id", courseId)).stream()
              .filter(s -> s.get("status").equals("在读"))
              .toList();
      records = roster.stream().map(s -> p("studentId", s.get("id"), "status", "present")).toList();
    } else {
      var args = p("sheetId", sheet.get("id"));
      roster = db.rows(RECORD_STUDENTS, args);
      records = db.rows(RECORDS, args);
    }
    return p(
        "courseId",
        courseId,
        "date",
        date,
        "savedAt",
        sheet == null ? null : sheet.get("savedAt"),
        "version",
        sheet == null ? -1 : sheet.get("version"),
        "students",
        roster,
        "records",
        records);
  }

  @SuppressWarnings("unchecked")
  @Transactional
  public Map<String, Object> saveAttendance(Map<String, Object> input) {
    String courseId = text(input, "courseId", 1, 36), date = date(input, "date").toString();
    current.course(courseId);
    course(courseId);
    var old = attendance(courseId, date);
    int version = integer(input, "version", -1, Integer.MAX_VALUE);
    if (version != ((Number) old.get("version")).intValue()) throw conflict();
    if (!(input.get("records") instanceof List<?> records) || records.size() > 10000)
      throw bad("点名记录格式无效");
    Set<String>
        expected =
            new HashSet<>(
                ((List<Map<String, Object>>) old.get("students"))
                    .stream().map(s -> s.get("id").toString()).toList()),
        seen = new HashSet<>();
    List<Map<String, Object>> pending = new ArrayList<>();
    for (var raw : records) {
      if (!(raw instanceof Map)) throw bad("点名记录格式无效");
      var row = (Map<String, Object>) raw;
      String sid = text(row, "studentId", 1, 36);
      if (!seen.add(sid) || !expected.contains(sid)) throw bad("点名名单已变化，请重新加载");
      pending.add(
          p(
              "studentId",
              sid,
              "status",
              choice(row, "status", "present", "late", "absent", "leave")));
    }
    if (!seen.equals(expected)) throw bad("必须提交完整点名名单");
    var sheet = db.one(SHEET, p("id", courseId, "date", date));
    String sheetId = sheet == null ? id() : sheet.get("id").toString();
    var args = p("id", courseId, "date", date, "sheetId", sheetId, "version", version);
    if (sheet == null) db.write(SHEET_ADD, args);
    else if (db.write(SHEET_UPDATE, args) != 1) throw conflict();
    db.write(RECORD_CLEAR, args);
    for (var row : pending) {
      row.put("sheetId", sheetId);
      db.write(RECORD_ADD, row);
    }
    return attendance(courseId, date);
  }

  public Map<String, Object> portal() {
    var u = current.user();
    if (!u.get("role").equals("STUDENT") || u.get("studentId") == null)
      throw CurrentUser.forbidden();
    String id = u.get("studentId").toString();
    Student s = students.findById(id);
    if (s == null) throw missing();
    var catalog = courses();
    Set<Object> selected = new HashSet<>();
    for (var c : catalog)
      if (db.count(ENROLLMENT, p("id", c.get("id"), "studentId", id)) > 0)
        selected.add(c.get("id"));
    return p(
        "student",
        s,
        "courses",
        catalog,
        "enrolledIds",
        selected,
        "grades",
        db.rows(MY_GRADES, p("id", id)),
        "attendance",
        db.rows(MY_ATTENDANCE, p("id", id)));
  }
}
