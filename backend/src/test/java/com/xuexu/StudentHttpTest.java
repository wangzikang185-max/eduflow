package com.xuexu;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.xuexu.controller.StudentController;
import com.xuexu.pojo.Student;
import com.xuexu.pojo.StudentPage;
import com.xuexu.service.StudentService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

class StudentHttpTest {
  private StudentService service;
  private MockMvc mvc;
  private static final String BODY =
      """
      {"studentNo":"20269999","name":"示例同学","gender":"未说明","className":"计算机 2601",
       "major":"计算机","phone":"","email":"","status":"在读","enrollmentDate":"2026-09-01"}
      """;

  @BeforeEach
  void setup() {
    service = mock(StudentService.class);
    mvc = MockMvcBuilders.standaloneSetup(new StudentController(service)).build();
  }

  @Test
  void listUsesExpectedEnvelopeAndPageDefaults() throws Exception {
    when(service.findPage(null, null, null, 1, 10))
        .thenReturn(new StudentPage(List.of(StudentServiceTest.sample()), 1, 1, 10));
    mvc.perform(get("/students"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(1))
        .andExpect(jsonPath("$.data.total").value(1))
        .andExpect(jsonPath("$.data.page").value(1))
        .andExpect(jsonPath("$.data.pageSize").value(10))
        .andExpect(jsonPath("$.data.items[0].studentNo").value("20269999"));
  }

  @Test
  void detailReturnsDateAndStringId() throws Exception {
    Student student = StudentServiceTest.sample();
    student.setId("s1");
    when(service.findById("s1")).thenReturn(student);
    mvc.perform(get("/students/s1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("s1"))
        .andExpect(jsonPath("$.data.enrollmentDate").value("2026-09-01"));
  }

  @Test
  void createReturnsSavedStudent() throws Exception {
    Student student = StudentServiceTest.sample();
    student.setId("generated");
    when(service.create(any())).thenReturn(student);
    mvc.perform(post("/students").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("generated"));
  }

  @Test
  void updateRoutesByPathId() throws Exception {
    Student student = StudentServiceTest.sample();
    student.setId("s1");
    when(service.update(eq("s1"), any())).thenReturn(student);
    mvc.perform(put("/students/s1").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value("s1"));
    verify(service).update(eq("s1"), any());
  }

  @Test
  void deleteKeepsJsonEnvelopeIncludingNullData() throws Exception {
    mvc.perform(delete("/students/s1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(1))
        .andExpect(jsonPath("$.data").value(nullValue()));
    verify(service).deleteById("s1");
  }

  @Test
  void businessErrorPreservesHttpStatusAndReadableMessage() throws Exception {
    when(service.create(any()))
        .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "该学号已存在，请检查后重试"));
    mvc.perform(post("/students").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.msg").value("该学号已存在，请检查后重试"));
  }

  @Test
  void malformedBodyAndImpossibleDateAreBadRequests() throws Exception {
    mvc.perform(post("/students").contentType(MediaType.APPLICATION_JSON).content("{broken"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value(0));
    mvc.perform(
            post("/students")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY.replace("2026-09-01", "2026-02-30")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value(0));
    verifyNoInteractions(service);
  }

  @Test
  void nonNumericPageIsBadRequest() throws Exception {
    mvc.perform(get("/students").param("page", "abc"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value(0));
    verifyNoInteractions(service);
  }
}
