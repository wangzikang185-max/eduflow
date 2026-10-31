package com.xuexu.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class Rules {
  private Rules() {}

  public static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  public static ResponseStatusException conflict() {
    return new ResponseStatusException(HttpStatus.CONFLICT, "数据已被修改，请重新加载后再提交");
  }

  public static ResponseStatusException missing() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "记录不存在");
  }

  public static String text(Map<String, Object> p, String key, int min, int max) {
    Object v = p.get(key);
    if (v != null && !(v instanceof String)) throw bad(key + " 必须为字符串");
    String s = v == null ? "" : v.toString().trim();
    if (s.length() < min || s.length() > max) throw bad(key + " 长度应为 " + min + "–" + max);
    return s;
  }

  public static int integer(Map<String, Object> p, String key, int min, int max) {
    BigDecimal n = decimal(p, key, BigDecimal.valueOf(min), BigDecimal.valueOf(max), 0);
    return n.intValueExact();
  }

  public static BigDecimal decimal(
      Map<String, Object> p, String key, BigDecimal min, BigDecimal max, int scale) {
    try {
      if (!(p.get(key) instanceof Number)) throw bad(key + " 必须为数字");
      BigDecimal n = new BigDecimal(p.get(key).toString());
      if (n.scale() > scale || n.compareTo(min) < 0 || n.compareTo(max) > 0)
        throw bad(key + " 超出允许范围或小数位数");
      return n;
    } catch (NumberFormatException e) {
      throw bad(key + " 数字无效");
    }
  }

  public static LocalDate date(Map<String, Object> p, String key) {
    try {
      LocalDate d = LocalDate.parse(text(p, key, 10, 10));
      if (d.getYear() < 1000 || d.getYear() > 9999) throw bad("日期范围无效");
      return d;
    } catch (java.time.DateTimeException e) {
      throw bad(key + " 日期无效");
    }
  }

  public static String choice(Map<String, Object> p, String key, String... values) {
    String s = text(p, key, 1, 100);
    if (!Arrays.asList(values).contains(s)) throw bad(key + " 选项无效");
    return s;
  }

  public static void version(Map<String, Object> input, Map<String, Object> row) {
    if (!Objects.equals(
        integer(input, "version", 0, Integer.MAX_VALUE), ((Number) row.get("version")).intValue()))
      throw conflict();
  }

  @SuppressWarnings("unchecked")
  public static List<Map<String, Object>> list(Map<String, Object> p, String key, int max) {
    if (!(p.get(key) instanceof List<?> rows)
        || rows.isEmpty()
        || rows.size() > max
        || rows.stream().anyMatch(r -> !(r instanceof Map)))
      throw bad(key + " 应包含 1–" + max + " 条记录");
    return (List<Map<String, Object>>) rows;
  }

  public static String id() {
    return UUID.randomUUID().toString();
  }
}
