package com.xuexu.service;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;
import static com.xuexu.service.Rules.*;

import com.xuexu.mapper.*;
import com.xuexu.security.CurrentUser;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class ReportService {
  private final WorkspaceStore db;
  private final StudentMapper students;
  private final CurrentUser current;
  private final AcademicService academic;

  public ReportService(
      WorkspaceStore db, StudentMapper students, CurrentUser current, AcademicService academic) {
    this.db = db;
    this.students = students;
    this.current = current;
    this.academic = academic;
  }

  public List<Map<String, Object>> report(
      String courseId, String className, String from, String to) {
    var args = current.scope();
    args.putAll(
        p(
            "courseId",
            courseId == null ? "" : courseId,
            "className",
            className == null ? "" : className,
            "from",
            from == null ? "1000-01-01" : from,
            "to",
            to == null ? "9999-12-31" : to));
    LocalDate start = date(args, "from"), end = date(args, "to");
    if (end.isBefore(start)) throw bad("结束日期不能早于开始日期");
    if (courseId != null && !courseId.isBlank() && !current.role().equals("STUDENT"))
      current.course(courseId);
    var rows = db.rows(REPORT, args);
    for (var row : rows) {
      long total = ((Number) row.get("attendanceTotal")).longValue(),
          present = ((Number) row.get("attendancePresent")).longValue();
      row.put("attendanceRate", total == 0 ? null : Math.round(present * 10000.0 / total) / 100.0);
      row.putIfAbsent("averageScore", null);
    }
    return rows;
  }

  public Map<String, Object> overview() {
    current.staff();
    var rows = report(null, null, null, null);
    Set<Object> ids = new HashSet<>();
    rows.forEach(r -> ids.add(r.get("id")));
    boolean admin = current.role().equals("ADMIN");
    String user = admin ? "" : current.id();
    long total = students.count("", "", "", user), active = students.count("", "", "在读", user);
    var recent = students.page("", "", "", user, 5, 0);
    if (!admin)
      recent.forEach(
          s -> {
            s.setPhone("");
            s.setEmail("");
          });
    double average =
        rows.stream()
            .filter(r -> r.get("averageScore") != null)
            .mapToDouble(r -> ((Number) r.get("averageScore")).doubleValue())
            .average()
            .orElse(0);
    long
        attendance =
            rows.stream().mapToLong(r -> ((Number) r.get("attendanceTotal")).longValue()).sum(),
        present =
            rows.stream().mapToLong(r -> ((Number) r.get("attendancePresent")).longValue()).sum();
    var classes = new LinkedHashMap<String, Set<Object>>();
    for (var row : rows)
      classes
          .computeIfAbsent(row.get("className").toString(), k -> new HashSet<>())
          .add(row.get("id"));
    List<Map<String, Object>> distribution =
        admin
            ? academic.classes().stream()
                .map(c -> p("name", c.get("name"), "count", c.get("studentCount")))
                .toList()
            : classes.entrySet().stream()
                .map(e -> p("name", e.getKey(), "count", e.getValue().size()))
                .toList();
    return p(
        "studentCount",
        total,
        "activeCount",
        active,
        "courseCount",
        academic.courses().size(),
        "averageScore",
        Math.round(average * 100) / 100.0,
        "attendanceRate",
        attendance == 0 ? 0 : Math.round(present * 10000.0 / attendance) / 100.0,
        "attendanceRecorded",
        attendance,
        "gradeRecorded",
        rows.stream().filter(r -> r.get("averageScore") != null).count(),
        "recentStudents",
        recent,
        "classes",
        distribution,
        "trend",
        admin ? db.rows(TREND, p()) : List.of());
  }

  public Map<String, Object> audit(String search, int page, int pageSize) {
    current.admin();
    if (page < 1 || pageSize < 1 || pageSize > 200) throw bad("分页范围无效");
    String q = search == null ? "" : search;
    if (q.length() > 100) throw bad("搜索词过长");
    var args = p("search", q, "limit", pageSize, "offset", (page - 1L) * pageSize);
    return p(
        "items",
        db.rows(AUDIT, args),
        "total",
        db.count(AUDIT_COUNT, args),
        "page",
        page,
        "pageSize",
        pageSize);
  }
}
