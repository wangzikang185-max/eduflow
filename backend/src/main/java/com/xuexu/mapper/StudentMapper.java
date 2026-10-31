package com.xuexu.mapper;

import com.xuexu.pojo.Student;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** P65–72、P77–83：单表 SQL + 参数绑定，不引入分页插件和多表事务。 */
@Mapper
public interface StudentMapper {
  String COLUMNS =
      "id, student_no, name, gender, class_name, major, phone, email, status,"
          + " enrollment_date,version";
  String FILTER =
      """
       WHERE (#{search}='' OR INSTR(LOWER(CONCAT(name,' ',student_no,' ',phone)),LOWER(#{search}))>0)
       AND (#{className}='' OR class_name=#{className}) AND (#{status}='' OR status=#{status})
       AND (#{userId}='' OR EXISTS(SELECT 1 FROM eduflow_enrollment e JOIN eduflow_user_course u ON u.course_id=e.course_id WHERE e.student_id=eduflow_student.id AND u.user_id=#{userId}))
      """;

  @Select(
      "SELECT "
          + COLUMNS
          + " FROM eduflow_student "
          + FILTER
          + " ORDER BY create_time DESC,id DESC LIMIT #{limit} OFFSET #{offset}")
  List<Student> page(
      @Param("search") String search,
      @Param("className") String className,
      @Param("status") String status,
      @Param("userId") String userId,
      @Param("limit") int limit,
      @Param("offset") long offset);

  @Select("SELECT COUNT(*) FROM eduflow_student " + FILTER)
  long count(
      @Param("search") String search,
      @Param("className") String className,
      @Param("status") String status,
      @Param("userId") String userId);

  @Select("SELECT " + COLUMNS + " FROM eduflow_student ORDER BY create_time DESC, id DESC")
  List<Student> findAll();

  @Select("SELECT " + COLUMNS + " FROM eduflow_student WHERE id = #{id}")
  Student findById(@Param("id") String id);

  @Select("SELECT " + COLUMNS + " FROM eduflow_student WHERE student_no = #{studentNo}")
  Student findByStudentNo(@Param("studentNo") String studentNo);

  @Insert(
      """
      INSERT INTO eduflow_student
          (id, student_no, name, gender, class_name, major, phone, email, status, enrollment_date)
      VALUES
          (#{id}, #{studentNo}, #{name}, #{gender}, #{className}, #{major}, #{phone}, #{email}, #{status}, #{enrollmentDate})
      """)
  int insert(Student student);

  @Update(
      """
      UPDATE eduflow_student
      SET student_no = #{studentNo}, name = #{name}, gender = #{gender},
          class_name = #{className}, major = #{major}, phone = #{phone}, email = #{email},
          status = #{status}, enrollment_date = #{enrollmentDate}, version=version+1,update_time = CURRENT_TIMESTAMP(3)
      WHERE id = #{id} AND version=#{version}
      """)
  int update(Student student);

  @Delete("DELETE FROM eduflow_student WHERE id = #{id}")
  int deleteById(@Param("id") String id);
}
