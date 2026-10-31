package com.xuexu.controller;

import com.xuexu.pojo.ApiResponse;
import com.xuexu.service.ReportService;
import org.springframework.web.bind.annotation.*;

@RestController
public class ReportController {
  private final ReportService service;

  public ReportController(ReportService service) {
    this.service = service;
  }

  @GetMapping("/dashboard/overview")
  public ApiResponse<?> overview() {
    return ApiResponse.success(service.overview());
  }

  @GetMapping("/reports")
  public ApiResponse<?> report(
      @RequestParam(required = false) String courseId,
      @RequestParam(required = false) String className,
      @RequestParam(required = false) String from,
      @RequestParam(required = false) String to) {
    return ApiResponse.success(service.report(courseId, className, from, to));
  }

  @GetMapping("/audit")
  public ApiResponse<?> audit(
      @RequestParam(defaultValue = "") String search,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "20") int pageSize) {
    return ApiResponse.success(service.audit(search, page, pageSize));
  }
}
