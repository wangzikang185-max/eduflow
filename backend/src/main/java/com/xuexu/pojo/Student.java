package com.xuexu.pojo;

import java.time.LocalDate;
import lombok.Data;

/** 对应 xuexu.eduflow_student；数据库的内部时间列不作为接口字段输出。 */
@Data
public class Student {
  private Integer version;
  private String id;
  private String studentNo;
  private String name;
  private String gender;
  private String className;
  private String major;
  private String phone;
  private String email;
  private String status;
  private LocalDate enrollmentDate;
}
