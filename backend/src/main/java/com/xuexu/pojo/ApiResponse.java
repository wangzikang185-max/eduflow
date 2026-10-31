package com.xuexu.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 统一响应，对应课程中的 Result：code、msg、data。 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
  private int code;
  private String msg;
  private T data;

  public static <T> ApiResponse<T> success(T data) {
    return new ApiResponse<>(1, "success", data);
  }

  public static ApiResponse<Void> success() {
    return success(null);
  }

  public static ApiResponse<Void> failure(String message) {
    return new ApiResponse<>(0, message, null);
  }
}
