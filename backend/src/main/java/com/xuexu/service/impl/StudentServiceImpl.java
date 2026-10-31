package com.xuexu.service.impl;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;
import static com.xuexu.service.Rules.*;

import com.xuexu.mapper.*;
import com.xuexu.pojo.*;
import com.xuexu.security.CurrentUser;
import com.xuexu.service.StudentService;
import java.io.StringReader;
import java.time.LocalDate;
import java.util.*;
import org.apache.commons.csv.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Validate in Service; paginate in MySQL. Creating a student does not imply enrollment. */
@Service
public class StudentServiceImpl implements StudentService {
  private final StudentMapper mapper;
  private final WorkspaceStore db;
  private final CurrentUser current;

  public StudentServiceImpl(StudentMapper mapper, WorkspaceStore db, CurrentUser current) {
    this.mapper = mapper;
    this.db = db;
    this.current = current;
  }

  @Override
  public StudentPage findPage(
      String search, String className, String status, int page, int pageSize) {
    current.staff();
    if (page < 1 || pageSize < 1 || pageSize > 200) throw bad("page 应大于等于 1，pageSize 应为 1–200");
    String q = trim(search), c = trim(className), s = trim(status);
    if (q.length() > 100) throw bad("搜索词过长");
    if (!s.isEmpty() && !Set.of("在读", "休学", "已毕业").contains(s)) throw bad("学籍状态无效");
    String user = current.role().equals("ADMIN") ? "" : current.id();
    var rows = mapper.page(q, c, s, user, pageSize, (page - 1L) * pageSize);
    if (!user.isEmpty()) rows.forEach(this::redact);
    return new StudentPage(rows, mapper.count(q, c, s, user), page, pageSize);
  }

  private void redact(Student student) {
    student.setPhone("");
    student.setEmail("");
  }

  @Override
  public List<Student> findAll() {
    current.admin();
    return mapper.findAll();
  }

  @Override
  public Student findById(String id) {
    current.staff();
    Student s = mapper.findById(id);
    if (s == null) throw missing();
    if (!current.role().equals("ADMIN")) {
      boolean allowed =
          db.rows(COURSES, current.scope()).stream()
              .anyMatch(c -> db.count(ENROLLMENT, p("id", c.get("id"), "studentId", id)) > 0);
      if (!allowed) throw CurrentUser.forbidden();
      redact(s);
    }
    return s;
  }

  @Transactional
  @Override
  public Student create(Student input) {
    current.admin();
    Student s = normalize(input);
    s.setId(id());
    s.setVersion(0);
    mapper.insert(s);
    return s;
  }

  @Transactional
  @Override
  public Student update(String id, Student input) {
    current.admin();
    Student s = normalize(input);
    s.setId(id);
    if (mapper.findById(id) == null) throw missing();
    if (input.getVersion() == null || input.getVersion() < 0) throw bad("请提交 version");
    s.setVersion(input.getVersion());
    if (mapper.update(s) != 1) throw conflict();
    s.setVersion(s.getVersion() + 1);
    return s;
  }

  @Transactional
  @Override
  public void deleteById(String id) {
    deleteMany(List.of(id));
  }

  @Transactional
  public void deleteMany(List<String> ids) {
    current.admin();
    if (ids == null
        || ids.isEmpty()
        || ids.size() > 500
        || new HashSet<>(ids).size() != ids.size()
        || ids.stream().anyMatch(Objects::isNull)) throw bad("请选择 1–500 个不同学生");
    db.rows(COURSES, current.scope()).stream()
        .map(c -> c.get("id").toString())
        .sorted()
        .forEach(c -> db.one(COURSE, p("id", c)));
    for (String id : ids.stream().sorted().toList())
      if (db.one(STUDENT_LOCK, p("id", id)) == null) throw missing();
    for (String id : ids) {
      var args = p("id", id);
      db.write(STUDENT_GRADES_DELETE, args);
      db.write(STUDENT_RECORDS_DELETE, args);
      db.write(STUDENT_ENROLL_DELETE, args);
      db.write(STUDENT_USER_DISABLE, args);
      mapper.deleteById(id);
    }
  }

  @Transactional
  public Map<String, Object> importCsv(String text) {
    current.admin();
    if (text == null
        || text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 2 * 1024 * 1024)
      throw bad("CSV 文件不得超过 2 MiB");
    String csv = text.replaceFirst("^\uFEFF", "");
    String[] headers = {"学号", "姓名", "性别", "班级", "手机号", "邮箱", "状态", "入学日期"};
    List<Student> pending = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    try (var parser =
        CSVFormat.DEFAULT
            .builder()
            .setHeader()
            .setSkipHeaderRecord(true)
            .get()
            .parse(new StringReader(csv))) {
      if (!parser.getHeaderNames().equals(Arrays.asList(headers))) throw bad("表头不匹配，请下载 CSV 模板");
      for (var row : parser) {
        if (pending.size() >= 500) throw bad("单次最多导入 500 条");
        try {
          if (row.size() != 8) throw bad("应包含 8 列");
          Student s = new Student();
          s.setStudentNo(row.get(0));
          s.setName(row.get(1));
          s.setGender(row.get(2));
          s.setClassName(row.get(3));
          s.setPhone(row.get(4));
          s.setEmail(row.get(5));
          s.setStatus(row.get(6));
          s.setEnrollmentDate(LocalDate.parse(row.get(7).trim()));
          s = normalize(s);
          if (!seen.add(s.getStudentNo().toLowerCase(Locale.ROOT))
              || mapper.findByStudentNo(s.getStudentNo()) != null) throw bad("学号重复");
          s.setId(id());
          s.setVersion(0);
          pending.add(s);
        } catch (Exception e) {
          throw bad(
              "第 "
                  + (row.getRecordNumber() + 1)
                  + " 行："
                  + (e instanceof org.springframework.web.server.ResponseStatusException r
                      ? r.getReason()
                      : "日期或字段格式无效"));
        }
      }
    } catch (org.springframework.web.server.ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw bad("CSV 格式错误，检查引号与编码");
    }
    if (pending.isEmpty()) throw bad("文件没有学生记录");
    pending.forEach(mapper::insert);
    return p("imported", pending.size());
  }

  private Student normalize(Student input) {
    if (input == null) throw bad("请提交学生资料");
    Student s = new Student();
    s.setStudentNo(trim(input.getStudentNo()));
    s.setName(trim(input.getName()));
    s.setGender(trim(input.getGender()));
    s.setClassName(trim(input.getClassName()));
    s.setPhone(trim(input.getPhone()));
    s.setEmail(trim(input.getEmail()));
    s.setStatus(trim(input.getStatus()));
    s.setEnrollmentDate(input.getEnrollmentDate());
    if (!s.getStudentNo().matches("[A-Za-z0-9-]{4,20}")) throw bad("学号应为 4–20 位字母、数字或短横线");
    if (s.getName().isEmpty() || s.getName().length() > 30) throw bad("姓名必填且不超过 30 字");
    if (!Set.of("男", "女", "未说明").contains(s.getGender())) throw bad("性别无效");
    var c = db.one(CLASS, p("name", s.getClassName()));
    if (c == null) throw bad("请选择有效班级");
    s.setMajor(c.get("major").toString());
    if (!s.getPhone().isEmpty() && !s.getPhone().matches("1[3-9]\\d{9}")) throw bad("手机号码无效");
    if (s.getEmail().length() > 254
        || (!s.getEmail().isEmpty() && !s.getEmail().matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")))
      throw bad("邮箱无效");
    if (!Set.of("在读", "休学", "已毕业").contains(s.getStatus())) throw bad("学籍状态无效");
    if (s.getEnrollmentDate() == null
        || s.getEnrollmentDate().getYear() < 1000
        || s.getEnrollmentDate().getYear() > 9999) throw bad("入学日期无效");
    return s;
  }

  private static String trim(String s) {
    return s == null ? "" : s.trim();
  }
}
