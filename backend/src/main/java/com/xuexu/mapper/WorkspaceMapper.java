package com.xuexu.mapper;

import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface WorkspaceMapper {
  class Provider {
    public static String sql(Map<String, Object> args) {
      return ((WorkspaceSql) args.get("statement")).sql;
    }
  }

  @SelectProvider(type = Provider.class, method = "sql")
  List<Map<String, Object>> read(
      @Param("statement") WorkspaceSql statement, @Param("p") Map<String, Object> params);

  @UpdateProvider(type = Provider.class, method = "sql")
  int write(@Param("statement") WorkspaceSql statement, @Param("p") Map<String, Object> params);
}
