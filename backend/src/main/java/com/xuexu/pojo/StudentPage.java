package com.xuexu.pojo;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;

/** MySQL 条件分页的统一返回格式。 */
@Data
@AllArgsConstructor
public class StudentPage {
  private List<Student> items;
  private long total;
  private int page;
  private int pageSize;
}
