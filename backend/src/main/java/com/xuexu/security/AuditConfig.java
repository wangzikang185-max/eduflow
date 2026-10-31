package com.xuexu.security;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;

import com.xuexu.mapper.*;
import com.xuexu.service.AuditService;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class AuditConfig implements WebMvcConfigurer {
  private final AuditService audit;
  private final CurrentUser current;
  private final WorkspaceStore db;
  private final StudentMapper students;

  public AuditConfig(
      AuditService audit, CurrentUser current, WorkspaceStore db, StudentMapper students) {
    this.audit = audit;
    this.current = current;
    this.db = db;
    this.students = students;
  }

  private String snapshot(String uri) {
    String[] parts = uri.split("/");
    if (parts.length != 3 || !parts[2].matches("[A-Za-z0-9-]{1,36}")) return "null";
    Object version = null;
    boolean exists = false;
    switch (parts[1]) {
      case "students":
        var s = students.findById(parts[2]);
        exists = s != null;
        if (exists) version = s.getVersion();
        break;
      case "courses":
        var c = db.one(COURSE, p("id", parts[2]));
        exists = c != null;
        if (exists) version = c.get("version");
        break;
      case "classes":
        var r = db.one(CLASS_ID, p("id", parts[2]));
        exists = r != null;
        if (exists) version = r.get("version");
        break;
      case "users":
        var u = db.one(USER, p("id", parts[2]));
        exists = u != null;
        if (exists) version = u.get("tokenVersion");
        break;
      default:
        return "null";
    }
    return "{\"exists\":" + exists + ",\"version\":" + version + "}";
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(
        new HandlerInterceptor() {
          public boolean preHandle(
              HttpServletRequest request, HttpServletResponse response, Object handler) {
            request.setAttribute("auditOperator", current.id());
            if (java.util.Set.of("PUT", "DELETE").contains(request.getMethod()))
              request.setAttribute("auditBefore", snapshot(request.getRequestURI()));
            return true;
          }

          public void afterCompletion(
              HttpServletRequest request,
              HttpServletResponse response,
              Object handler,
              Exception ex) {
            if (!java.util.Set.of("POST", "PUT", "DELETE", "PATCH").contains(request.getMethod()))
              return;
            String[] parts = request.getRequestURI().split("/");
            String target = parts.length > 1 ? parts[1] : "SYSTEM";
            String targetId = parts.length > 2 && parts[2].length() <= 36 ? parts[2] : null;
            String action = request.getMethod() + "_" + target.toUpperCase();
            audit.record(
                (String) request.getAttribute("auditOperator"),
                action,
                target.toUpperCase(),
                targetId,
                response.getStatus(),
                (String) request.getAttribute("auditBefore"),
                snapshot(request.getRequestURI()));
          }
        });
  }
}
