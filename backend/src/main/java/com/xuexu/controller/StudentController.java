package com.xuexu.controller;

import com.xuexu.pojo.ApiResponse;
import com.xuexu.pojo.Student;
import com.xuexu.pojo.StudentPage;
import com.xuexu.service.StudentService;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

/** P77–83：列表 → 新增 → 删除 → 回显 → 修改。 */
@Slf4j
@RestController
@RequestMapping("/students")
public class StudentController {

  private final StudentService studentService;

  public StudentController(StudentService studentService) {
    this.studentService = studentService;
  }

  @GetMapping
  public ApiResponse<StudentPage> list(
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String className,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize) {
    log.info("list students: page={}, pageSize={}", page, pageSize);
    return ApiResponse.success(studentService.findPage(search, className, status, page, pageSize));
  }

  @GetMapping("/{id}")
  public ApiResponse<Student> detail(@PathVariable String id) {
    log.info("get student detail: id={}", id);
    return ApiResponse.success(studentService.findById(id));
  }

  @PostMapping
  public ApiResponse<Student> create(@RequestBody Student input) {
    log.info("create student");
    return ApiResponse.success(studentService.create(input));
  }

  @PutMapping("/{id}")
  public ApiResponse<Student> update(@PathVariable String id, @RequestBody Student input) {
    log.info("update student: id={}", id);
    return ApiResponse.success(studentService.update(id, input));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable String id) {
    log.info("delete student: id={}", id);
    studentService.deleteById(id);
    return ApiResponse.success();
  }

  @PostMapping("/batch-delete")
  public ApiResponse<Void> batchDelete(@RequestBody Map<String, List<String>> body) {
    studentService.deleteMany(body.get("ids"));
    return ApiResponse.success();
  }

  @PostMapping("/import")
  public ApiResponse<?> importCsv(@RequestBody Map<String, String> body) {
    return ApiResponse.success(studentService.importCsv(body.get("csv")));
  }

  // Compatibility for standalone controller tests; other controllers use GlobalErrors.
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiResponse<Void>> businessError(ResponseStatusException exception) {
    return ResponseEntity.status(exception.getStatusCode())
        .body(ApiResponse.failure(exception.getReason()));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class
  })
  public ResponseEntity<ApiResponse<Void>> malformedRequest(Exception exception) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(ApiResponse.failure("请求格式错误，请检查 JSON、日期和参数类型"));
  }
}
