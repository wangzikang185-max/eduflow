package com.xuexu.security;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;

import com.xuexu.mapper.WorkspaceStore;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BootstrapAdmin implements CommandLineRunner {
  private final WorkspaceStore db;
  private final PasswordEncoder encoder;
  private final String password;

  public BootstrapAdmin(
      WorkspaceStore db,
      PasswordEncoder encoder,
      @Value("${app.bootstrap-password}") String password) {
    this.db = db;
    this.encoder = encoder;
    this.password = password;
  }

  public void run(String... args) {
    if (db.rows(USERS, p()).isEmpty()) {
      if (password.isBlank())
        throw new IllegalStateException("首次启动必须设置 ADMIN_PASSWORD（12–72 UTF-8 字节）");
      com.xuexu.service.AuthService.password(p("password", password));
      db.write(
          USER_ADD,
          p(
              "id",
              UUID.randomUUID().toString(),
              "username",
              "admin",
              "passwordHash",
              encoder.encode(password),
              "displayName",
              "教务管理员",
              "role",
              "ADMIN",
              "studentId",
              null));
    }
  }
}
