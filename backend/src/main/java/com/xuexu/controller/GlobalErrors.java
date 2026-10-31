package com.xuexu.controller;

import com.xuexu.pojo.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestControllerAdvice
public class GlobalErrors {
  @ExceptionHandler({
    org.springframework.web.servlet.resource.NoResourceFoundException.class,
    org.springframework.web.servlet.NoHandlerFoundException.class
  })
  public ResponseEntity<?> notFound(Exception e) {
    return ResponseEntity.status(404).body(ApiResponse.failure("接口不存在"));
  }

  @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<?> method(Exception e) {
    return ResponseEntity.status(405).body(ApiResponse.failure("请求方法不支持"));
  }

  @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<?> media(Exception e) {
    return ResponseEntity.status(415).body(ApiResponse.failure("请使用 application/json 提交请求"));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<?> business(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode()).body(ApiResponse.failure(e.getReason()));
  }

  @ExceptionHandler(DuplicateKeyException.class)
  public ResponseEntity<?> duplicate(DuplicateKeyException e) {
    return ResponseEntity.status(409).body(ApiResponse.failure("学号、代码、名称或账户关联已存在，请刷新后检查"));
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    MissingServletRequestParameterException.class
  })
  public ResponseEntity<?> malformed(Exception e) {
    return ResponseEntity.badRequest().body(ApiResponse.failure("请求格式错误，请检查 JSON、日期及参数类型"));
  }

  @ExceptionHandler({ConcurrencyFailureException.class})
  public ResponseEntity<?> conflict(Exception e) {
    return ResponseEntity.status(409).body(ApiResponse.failure("并发操作冲突，请刷新后重试"));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<?> unexpected(Exception e) {
    log.error("Unhandled request failure", e);
    return ResponseEntity.status(500).body(ApiResponse.failure("服务处理失败，请稍后重试"));
  }
}
