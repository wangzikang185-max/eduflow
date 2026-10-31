package com.xuexu.mapper;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Repository;

/**
 * MyBatis map results need explicit snake_case conversion (bean mapping does not apply to maps).
 */
@Repository
public class WorkspaceStore {
  private final WorkspaceMapper mapper;

  public WorkspaceStore(WorkspaceMapper mapper) {
    this.mapper = mapper;
  }

  public static Map<String, Object> p(Object... pairs) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) result.put(pairs[i].toString(), pairs[i + 1]);
    return result;
  }

  public List<Map<String, Object>> rows(WorkspaceSql sql, Map<String, Object> p) {
    return mapper.read(sql, p).stream()
        .map(
            row -> {
              Map<String, Object> out = new LinkedHashMap<>();
              row.forEach(
                  (k, v) -> {
                    StringBuilder key = new StringBuilder();
                    boolean upper = false;
                    for (char c : k.toCharArray()) {
                      if (c == '_') upper = true;
                      else {
                        key.append(upper ? Character.toUpperCase(c) : c);
                        upper = false;
                      }
                    }
                    Object value = v;
                    if (v instanceof java.sql.Date d) value = d.toLocalDate().toString();
                    else if (v instanceof java.sql.Timestamp t)
                      value = t.toLocalDateTime().toString();
                    else if (v instanceof LocalDate
                        || v instanceof LocalDateTime
                        || v instanceof LocalTime) value = v.toString();
                    out.put(key.toString(), value);
                  });
              return out;
            })
        .toList();
  }

  public Map<String, Object> one(WorkspaceSql sql, Map<String, Object> p) {
    var rows = rows(sql, p);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  public long count(WorkspaceSql sql, Map<String, Object> p) {
    return ((Number) one(sql, p).get("n")).longValue();
  }

  public int write(WorkspaceSql sql, Map<String, Object> p) {
    return mapper.write(sql, p);
  }
}
