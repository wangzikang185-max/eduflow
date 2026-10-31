package com.xuexu.service;

import com.xuexu.pojo.Student;
import com.xuexu.pojo.StudentPage;
import java.util.List;

public interface StudentService {
  StudentPage findPage(String search, String className, String status, int page, int pageSize);

  List<Student> findAll();

  Student findById(String id);

  Student create(Student input);

  Student update(String id, Student input);

  void deleteById(String id);

  void deleteMany(List<String> ids);

  java.util.Map<String, Object> importCsv(String csv);
}
