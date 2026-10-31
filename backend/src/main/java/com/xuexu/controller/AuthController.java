package com.xuexu.controller;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;

import com.xuexu.mapper.WorkspaceStore;
import com.xuexu.pojo.ApiResponse;
import com.xuexu.security.CurrentUser;
import com.xuexu.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuthController {
  private final AuthService service;
  private final CurrentUser current;
  private final WorkspaceStore db;

  public AuthController(AuthService s, CurrentUser u, WorkspaceStore db) {
    service = s;
    current = u;
    this.db = db;
  }

  @GetMapping("/health")
  public ApiResponse<?> health() {
    return ApiResponse.success(p("status", "UP", "version", "2.0.0"));
  }

  @PostMapping("/auth/login")
  public ApiResponse<?> login(@RequestBody Map<String, Object> input, HttpServletRequest request) {
    var result = service.login(input, request.getRemoteAddr());
    request.setAttribute("auditOperator", ((Map<?, ?>) result.get("user")).get("id"));
    return ApiResponse.success(result);
  }

  @GetMapping("/auth/me")
  public ApiResponse<?> me() {
    return ApiResponse.success(current.safe(current.user()));
  }

  @PostMapping("/auth/logout")
  public ApiResponse<?> logout() {
    db.write(LOGOUT, p("id", current.id()));
    return ApiResponse.success();
  }

  @PutMapping("/auth/password")
  public ApiResponse<?> password(@RequestBody Map<String, Object> input) {
    service.passwordChange(input);
    return ApiResponse.success();
  }

  @GetMapping("/users")
  public ApiResponse<?> users() {
    current.admin();
    return ApiResponse.success(db.rows(USERS, p()));
  }

  @PostMapping("/users")
  public ApiResponse<?> create(@RequestBody Map<String, Object> input) {
    return ApiResponse.success(service.create(input));
  }

  @PutMapping("/users/{id}")
  public ApiResponse<?> update(@PathVariable String id, @RequestBody Map<String, Object> input) {
    service.updateUser(id, input);
    return ApiResponse.success();
  }

  @GetMapping("/users/{id}/courses")
  public ApiResponse<?> grants(@PathVariable String id) {
    current.admin();
    return ApiResponse.success(db.rows(GRANTS, p("id", id)));
  }

  @PutMapping("/users/{id}/courses/{courseId}")
  public ApiResponse<?> grant(@PathVariable String id, @PathVariable String courseId) {
    service.grant(id, courseId, true);
    return ApiResponse.success();
  }

  @DeleteMapping("/users/{id}/courses/{courseId}")
  public ApiResponse<?> revoke(@PathVariable String id, @PathVariable String courseId) {
    service.grant(id, courseId, false);
    return ApiResponse.success();
  }
}
