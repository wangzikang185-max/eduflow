package com.xuexu.security;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;

import com.xuexu.mapper.WorkspaceStore;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CurrentUser {
  private final WorkspaceStore db;

  public CurrentUser(WorkspaceStore db) {
    this.db = db;
  }

  public String id() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    return a != null && a.getPrincipal() instanceof Jwt jwt ? jwt.getSubject() : null;
  }

  public Map<String, Object> user() {
    var u = db.one(USER, p("id", id()));
    if (u == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
    return u;
  }

  public String role() {
    return user().get("role").toString();
  }

  public void admin() {
    if (!role().equals("ADMIN")) throw forbidden();
  }

  public void staff() {
    if (role().equals("STUDENT")) throw forbidden();
  }

  public void course(String id) {
    var u = user();
    String role = u.get("role").toString();
    if (role.equals("STUDENT")
        || (!role.equals("ADMIN") && db.count(PERMISSION, p("id", id, "userId", u.get("id"))) == 0))
      throw forbidden();
  }

  public Map<String, Object> scope() {
    var u = user();
    return p("role", u.get("role"), "userId", u.get("id"), "studentId", u.get("studentId"));
  }

  public static ResponseStatusException forbidden() {
    return new ResponseStatusException(HttpStatus.FORBIDDEN, "没有此操作或课程的数据权限");
  }

  public Map<String, Object> safe(Map<String, Object> u) {
    return p(
        "id",
        u.get("id"),
        "username",
        u.get("username"),
        "displayName",
        u.get("displayName"),
        "role",
        u.get("role"),
        "studentId",
        u.get("studentId"));
  }
}
