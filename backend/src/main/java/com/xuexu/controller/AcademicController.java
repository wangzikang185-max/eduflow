package com.xuexu.controller;

import com.xuexu.pojo.ApiResponse;
import com.xuexu.service.AcademicService;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class AcademicController {
  private final AcademicService service;

  public AcademicController(AcademicService service) {
    this.service = service;
  }

  @GetMapping("/classes")
  public ApiResponse<?> classes() {
    return ApiResponse.success(service.classes());
  }

  @PostMapping("/classes")
  public ApiResponse<?> addClass(@RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveClass(null, input));
  }

  @PutMapping("/classes/{id}")
  public ApiResponse<?> updateClass(
      @PathVariable String id, @RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveClass(id, input));
  }

  @DeleteMapping("/classes/{id}")
  public ApiResponse<?> deleteClass(@PathVariable String id, @RequestParam int version) {
    service.deleteClass(id, version);
    return ApiResponse.success();
  }

  @GetMapping("/courses")
  public ApiResponse<?> courses() {
    return ApiResponse.success(service.courses());
  }

  @PostMapping("/courses")
  public ApiResponse<?> addCourse(@RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveCourse(null, input));
  }

  @PutMapping("/courses/{id}")
  public ApiResponse<?> updateCourse(
      @PathVariable String id, @RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveCourse(id, input));
  }

  @DeleteMapping("/courses/{id}")
  public ApiResponse<?> deleteCourse(@PathVariable String id, @RequestParam int version) {
    service.deleteCourse(id, version);
    return ApiResponse.success();
  }

  @GetMapping("/courses/{id}/students")
  public ApiResponse<?> roster(@PathVariable String id) {
    return ApiResponse.success(service.roster(id));
  }

  public record Selection(List<String> studentIds) {}

  @PostMapping("/courses/{id}/enrollments")
  public ApiResponse<?> enroll(@PathVariable String id, @RequestBody Selection input) {
    service.enroll(id, input.studentIds(), true);
    return ApiResponse.success();
  }

  @DeleteMapping("/courses/{id}/enrollments/{studentId}")
  public ApiResponse<?> withdraw(@PathVariable String id, @PathVariable String studentId) {
    service.enroll(id, List.of(studentId), false);
    return ApiResponse.success();
  }

  @GetMapping("/courses/{id}/exams")
  public ApiResponse<?> exams(@PathVariable String id) {
    return ApiResponse.success(service.exams(id));
  }

  @PostMapping("/courses/{id}/exams")
  public ApiResponse<?> addExam(@PathVariable String id, @RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveExam(id, null, input));
  }

  @PutMapping("/courses/{id}/exams/{examId}")
  public ApiResponse<?> updateExam(
      @PathVariable String id,
      @PathVariable String examId,
      @RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveExam(id, examId, input));
  }

  @DeleteMapping("/courses/{id}/exams/{examId}")
  public ApiResponse<?> deleteExam(
      @PathVariable String id, @PathVariable String examId, @RequestParam int version) {
    service.deleteExam(id, examId, version);
    return ApiResponse.success();
  }

  @GetMapping("/grades")
  public ApiResponse<?> grades(
      @RequestParam String courseId, @RequestParam(required = false) String examId) {
    return ApiResponse.success(service.grades(courseId, examId));
  }

  @PutMapping("/grades/batch")
  public ApiResponse<?> saveGrades(@RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveGrades(input));
  }

  @GetMapping("/attendance")
  public ApiResponse<?> attendance(@RequestParam String courseId, @RequestParam String date) {
    return ApiResponse.success(service.attendance(courseId, date));
  }

  @PutMapping("/attendance/batch")
  public ApiResponse<?> saveAttendance(@RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.saveAttendance(input));
  }

  @GetMapping("/portal")
  public ApiResponse<?> portal() {
    return ApiResponse.success(service.portal());
  }
}
