package com.xuexu.service;

import static com.xuexu.mapper.WorkspaceSql.*;
import static com.xuexu.mapper.WorkspaceStore.p;
import static com.xuexu.service.Rules.*;

import com.xuexu.mapper.WorkspaceStore;
import com.xuexu.security.CurrentUser;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final WorkspaceStore db;
  private final CurrentUser current;
  private final PasswordEncoder passwords;
  private final JwtEncoder encoder;
  private final String dummy;
  private final ConcurrentHashMap<String, Deque<Long>> attempts = new ConcurrentHashMap<>();

  public AuthService(
      WorkspaceStore db, CurrentUser current, PasswordEncoder passwords, JwtEncoder encoder) {
    this.db = db;
    this.current = current;
    this.passwords = passwords;
    this.encoder = encoder;
    dummy = passwords.encode(UUID.randomUUID().toString());
  }

  public Map<String, Object> login(Map<String, Object> input, String address) {
    String username = text(input, "username", 1, 50),
        password = rawPassword(input, "password", 1, 100);
    long now = System.currentTimeMillis();
    synchronized (attempts) {
      attempts
          .entrySet()
          .removeIf(e -> e.getValue().isEmpty() || e.getValue().peekLast() < now - 60000);
      var queue = attempts.computeIfAbsent(address, k -> new ArrayDeque<>());
      while (!queue.isEmpty() && queue.peekFirst() < now - 60000) queue.removeFirst();
      if (queue.size() >= 20)
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "登录尝试过于频繁，请一分钟后重试");
      queue.addLast(now);
    }
    var u = db.one(USER_NAME, p("username", username));
    boolean match =
        passwords.matches(password, u == null ? dummy : u.get("passwordHash").toString());
    if (u == null || !match || ((Number) u.get("enabled")).intValue() != 1)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
    Instant issued = Instant.now();
    var claims =
        JwtClaimsSet.builder()
            .issuer("xuexu")
            .subject(u.get("id").toString())
            .issuedAt(issued)
            .expiresAt(issued.plusSeconds(1800))
            .claim("ver", u.get("tokenVersion"))
            .build();
    String token =
        encoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
    return p("token", token, "expiresIn", 1800, "user", current.safe(u));
  }

  @Transactional
  public Map<String, Object> create(Map<String, Object> input) {
    current.admin();
    String username = text(input, "username", 4, 50);
    if (!username.matches("[A-Za-z0-9._-]+")) throw bad("用户名格式无效");
    String role = choice(input, "role", "ADMIN", "TEACHER", "STUDENT");
    String studentId = null;
    if (role.equals("STUDENT")) {
      studentId = text(input, "studentId", 1, 36);
      if (db.one(STUDENT_LOCK, p("id", studentId)) == null) throw missing();
    }
    var u =
        p(
            "id",
            id(),
            "username",
            username,
            "passwordHash",
            passwords.encode(password(input)),
            "displayName",
            text(input, "displayName", 1, 50),
            "role",
            role,
            "studentId",
            studentId);
    db.write(USER_ADD, u);
    return current.safe(u);
  }

  public static String password(Map<String, Object> input) {
    String s = rawPassword(input, "password", 12, 72);
    if (s.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw bad("密码 UTF-8 编码不得超过 72 字节");
    return s;
  }

  private static String rawPassword(Map<String, Object> input, String key, int min, int max) {
    if (!(input.get(key) instanceof String s) || s.length() < min || s.length() > max)
      throw bad("密码长度无效");
    return s;
  }

  @Transactional
  public void passwordChange(Map<String, Object> input) {
    var u = current.user();
    String old = rawPassword(input, "oldPassword", 1, 100);
    if (!passwords.matches(old, u.get("passwordHash").toString())) throw bad("原密码错误");
    db.write(PASSWORD, p("id", u.get("id"), "passwordHash", passwords.encode(password(input))));
  }

  @Transactional
  public void updateUser(String id, Map<String, Object> input) {
    current.admin();
    var u = db.one(USER, p("id", id));
    if (u == null) throw missing();
    int enabled = integer(input, "enabled", 0, 1);
    if (id.equals(current.id()) && enabled == 0) throw bad("不能禁用当前账户");
    if (enabled == 1 && u.get("role").equals("STUDENT") && u.get("studentId") == null)
      throw bad("学生档案已删除，该账户不能重新启用");
    if (db.write(
            USER_UPDATE,
            p(
                "id",
                id,
                "enabled",
                enabled,
                "displayName",
                text(input, "displayName", 1, 50),
                "version",
                integer(input, "version", 0, Integer.MAX_VALUE)))
        != 1) throw conflict();
  }

  @Transactional
  public void grant(String userId, String courseId, boolean grant) {
    current.admin();
    var u = db.one(USER, p("id", userId));
    if (u == null || !u.get("role").equals("TEACHER")) throw bad("请选择教师账户");
    if (db.one(COURSE, p("id", courseId)) == null) throw missing();
    var args = p("id", courseId, "userId", userId);
    if (grant) {
      if (db.count(PERMISSION, args) == 0) db.write(GRANT, args);
    } else db.write(REVOKE, args);
  }
}
