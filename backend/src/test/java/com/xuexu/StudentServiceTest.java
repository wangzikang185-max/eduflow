package com.xuexu;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.xuexu.mapper.*;
import com.xuexu.pojo.Student;
import com.xuexu.security.CurrentUser;
import com.xuexu.service.impl.StudentServiceImpl;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class StudentServiceTest {
  @Mock StudentMapper mapper;
  @Mock WorkspaceStore db;
  @Mock CurrentUser current;
  @InjectMocks StudentServiceImpl service;

  static Student sample() {
    var s = new Student();
    s.setStudentNo("20269999");
    s.setName("示例同学");
    s.setGender("未说明");
    s.setClassName("计算机 2601");
    s.setMajor("计算机");
    s.setPhone("");
    s.setEmail("");
    s.setStatus("在读");
    s.setEnrollmentDate(LocalDate.of(2026, 9, 1));
    s.setVersion(0);
    return s;
  }

  @BeforeEach
  void defaults() {
    lenient().when(current.role()).thenReturn("ADMIN");
    lenient().when(db.one(eq(CLASS), anyMap())).thenReturn(p("major", "计算机"));
  }

  @Test
  void normalizesAndDerivesMajorFromDatabase() {
    var input = sample();
    input.setId("untrusted");
    input.setName(" 示例同学 ");
    input.setMajor("wrong");
    var saved = service.create(input);
    assertDoesNotThrow(() -> UUID.fromString(saved.getId()));
    assertEquals("示例同学", saved.getName());
    assertEquals("计算机", saved.getMajor());
    verify(mapper).insert(saved);
  }

  @Test
  void paginationIsDelegatedToDatabaseAndNeverLoadsAll() {
    when(mapper.page("a", "", "", "", 20, 40)).thenReturn(List.of());
    when(mapper.count("a", "", "", "")).thenReturn(81L);
    var page = service.findPage("a", null, null, 3, 20);
    assertEquals(81, page.getTotal());
    verify(mapper, never()).findAll();
  }

  @Test
  void rejectsInvalidPaginationBeforeSql() {
    assertThrows(ResponseStatusException.class, () -> service.findPage("", null, null, 0, 10));
    assertThrows(ResponseStatusException.class, () -> service.findPage("", null, null, 1, 201));
    verifyNoInteractions(mapper);
  }

  @Test
  void teacherScopeIsPassedIntoSqlAndContactsAreRedacted() {
    when(current.role()).thenReturn("TEACHER");
    when(current.id()).thenReturn("teacher");
    var s = sample();
    s.setPhone("13800000000");
    when(mapper.page("", "", "", "teacher", 10, 0)).thenReturn(List.of(s));
    service.findPage(null, null, null, 1, 10);
    assertEquals("", s.getPhone());
    verify(mapper).count("", "", "", "teacher");
  }

  @Test
  void staleStudentDoesNotReportSuccess() {
    var input = sample();
    when(mapper.findById("s1")).thenReturn(sample());
    var e = assertThrows(ResponseStatusException.class, () -> service.update("s1", input));
    assertEquals(409, e.getStatusCode().value());
  }

  @Test
  void pathIdWinsAndVersionAdvances() {
    when(mapper.findById("s1")).thenReturn(sample());
    when(mapper.update(any())).thenReturn(1);
    var input = sample();
    input.setId("s2");
    var result = service.update("s1", input);
    assertEquals("s1", result.getId());
    assertEquals(1, result.getVersion());
  }

  @Test
  void missingStudentReturns404() {
    assertEquals(
        404,
        assertThrows(ResponseStatusException.class, () -> service.findById("missing"))
            .getStatusCode()
            .value());
  }

  @Test
  void invalidStudentIsNotInserted() {
    var s = sample();
    s.setPhone("123");
    assertThrows(ResponseStatusException.class, () -> service.create(s));
    verifyNoInteractions(mapper);
  }

  @Test
  void csvValidationCompletesBeforeFirstWrite() {
    String csv =
        "学号,姓名,性别,班级,手机号,邮箱,状态,入学日期\n"
            + "NEW001,测试,男,计算机 2601,,,在读,2026-09-01\n"
            + "NEW002,坏数据,男,计算机 2601,123,,在读,2026-09-01";
    var e = assertThrows(ResponseStatusException.class, () -> service.importCsv(csv));
    assertTrue(e.getReason().contains("第 3 行"));
    verify(mapper, never()).insert(any());
  }

  @Test
  void csvDuplicateCaseFailsBeforeWrite() {
    String csv =
        "学号,姓名,性别,班级,手机号,邮箱,状态,入学日期\n"
            + "NEW001,测试,男,计算机 2601,,,在读,2026-09-01\n"
            + "new001,测试,男,计算机 2601,,,在读,2026-09-01";
    assertThrows(ResponseStatusException.class, () -> service.importCsv(csv));
    verify(mapper, never()).insert(any());
  }

  @Test
  void missingBatchTargetPreventsAllDeletion() {
    when(db.rows(eq(COURSES), any())).thenReturn(List.of());
    when(db.one(eq(STUDENT_LOCK), anyMap())).thenReturn(null);
    assertThrows(ResponseStatusException.class, () -> service.deleteMany(List.of("missing")));
    verify(mapper, never()).deleteById(any());
  }

  @Test
  void studentRoleCannotUseStudentDirectory() {
    doThrow(CurrentUser.forbidden()).when(current).staff();
    assertEquals(
        403,
        assertThrows(ResponseStatusException.class, () -> service.findPage(null, null, null, 1, 10))
            .getStatusCode()
            .value());
    verifyNoInteractions(mapper);
  }
}
