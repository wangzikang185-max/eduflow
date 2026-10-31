"""Add a small fictional V2 showcase dataset through the real API.

Reads ADMIN_PASSWORD and DEMO_PASSWORD from process environment or runtime/local.env.
Does not change existing students or overwrite existing courses, scores or passwords.
Run only against the project database you intend to use; take a backup first.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base', default='http://127.0.0.1:8081')
parser.add_argument('--report', default='runtime/demo-data-report.json')
args = parser.parse_args()
settings = {}
settings_path = ROOT / 'runtime/local.env'
if settings_path.exists():
    for line in settings_path.read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            settings[key] = value
settings.update(os.environ)
admin_password = settings.get('V2_TEST_PASSWORD') or settings.get('ADMIN_PASSWORD')
demo_password = settings.get('DEMO_PASSWORD')
if not admin_password or not demo_password:
    raise SystemExit('Configure ADMIN_PASSWORD and DEMO_PASSWORD first; no data changed.')

token = None


def api(method, path, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(
        args.base + path,
        data=json.dumps(body, ensure_ascii=False).encode() if body is not None else None,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result['code'] != 1:
        raise RuntimeError(result['msg'])
    return result['data']


def students():
    rows, page = [], 1
    while True:
        result = api('GET', f'/students?page={page}&pageSize=200')
        rows.extend(result['items'])
        if len(rows) >= result['total']:
            return rows
        page += 1


token = api('POST', '/auth/login', {'username': 'admin', 'password': admin_password})['token']
today = dt.date.today()
class_names = ['计算机 2601', '软件工程 2601', '数据科学 2601', '人工智能 2601']
class_index = {row['name']: row for row in api('GET', '/classes')}
for name in class_names:
    if name not in class_index:
        class_index[name] = api('POST', '/classes', {'name': name, 'major': name.split()[0]})

# Reserved DEMO26 student numbers identify this fictional dataset.
names = ['林安然', '陈思远', '徐知夏', '周景行', '许清禾', '苏予安',
         '陆星辰', '沈嘉言', '顾书宁', '温以棠', '江亦川', '唐若溪']
existing = {row['studentNo'].upper(): row for row in students()}
cohort, added_students, added_ids = [], 0, set()
for index, name in enumerate(names):
    number = f'DEMO26{index + 1:03}'
    row = existing.get(number)
    if row is None:
        row = api('POST', '/students', {
            'studentNo': number, 'name': name, 'gender': '未说明',
            'className': class_names[index // 3], 'phone': '',
            'email': f'student{index + 1:02}@demo.xuexu.example',
            'status': '在读', 'enrollmentDate': f'{today.year}-02-23',
        })
        added_students += 1
        added_ids.add(row['id'])
    elif row['name'] != name:
        raise SystemExit(f'{number} belongs to a different student; stopped without overwriting it.')
    cohort.append(row)

course_specs = [
    ('JAVA101', 'Java 程序设计', '陈老师', '专业必修', 'orange', 1, '09:00–10:30', 12,
     '以对象建模、集合与异常处理为基础，完成 Java 应用的设计与实现。'),
    ('DB202', '数据库原理', '林老师', '专业必修', 'blue', 2, '14:00–15:30', 9,
     '学习关系建模、SQL 查询、索引设计和事务，理解数据一致性的实现。'),
    ('WEB303', 'Web 应用开发', '陈老师', '专业选修', 'purple', 4, '10:45–12:15', 8,
     '围绕 REST API、前后端联调与身份验证，构建完整的 Web 应用。'),
    ('MATH104', '离散数学', '许老师', '公共基础', 'teal', 5, '09:00–10:30', 6,
     '通过逻辑、集合、图论与组合计数，建立计算机科学的数学基础。'),
]
course_index = {row['code'].upper(): row for row in api('GET', '/courses')}
created_courses, skipped_courses, showcase_courses = [], [], []
for ci, (code, name, teacher, category, color, weekday, time, count, description) in enumerate(course_specs):
    existing_course = course_index.get(code)
    if existing_course is not None:
        # A rerun never overwrites grades or attendance subsequently edited by the user.
        showcase_courses.append(existing_course)
        skipped_courses.append(code)
        continue
    course = api('POST', '/courses', {
        'code': code, 'name': name, 'teacher': teacher, 'description': description,
        'category': category, 'credits': 3 if ci != 3 else 2, 'hours': 48 if ci != 3 else 32,
        'capacity': [30, 20, 12, 6][ci], 'room': f'教学楼 {201 + ci}', 'weekday': weekday,
        'time': time, 'color': color,
    })
    created_courses.append(code)
    showcase_courses.append(course)
    roster = cohort if ci == 0 else [cohort[(i + ci * 2) % len(cohort)] for i in range(count)]
    api('POST', f'/courses/{course["id"]}/enrollments', {'studentIds': [row['id'] for row in roster]})
    exam = api('GET', f'/courses/{course["id"]}/exams')[0]
    exam = api('PUT', f'/courses/{course["id"]}/exams/{exam["id"]}', {
        **exam, 'name': '平时考核', 'examDate': (today - dt.timedelta(days=21)).isoformat(), 'weight': 40,
    })
    final_exam = api('POST', f'/courses/{course["id"]}/exams', {
        'name': '阶段考试', 'examDate': (today - dt.timedelta(days=7)).isoformat(), 'weight': 60,
    })
    for ei, current_exam in enumerate([exam, final_exam]):
        sheet = api('GET', '/grades?' + urllib.parse.urlencode({'courseId': course['id'], 'examId': current_exam['id']}))
        values = [95, 88.5, 76, 60, 55, 100, 82, 68.5, 0, 91, 73, 64]
        scores = []
        for si, grade in enumerate(sheet['grades']):
            score = None if ei == 1 and si == len(sheet['grades']) - 1 else values[(si + ci + ei) % len(values)]
            scores.append({'studentId': grade['studentId'], 'score': score, 'version': grade['version']})
        api('PUT', '/grades/batch', {'courseId': course['id'], 'examId': current_exam['id'], 'scores': scores})
    for di, days_ago in enumerate([14, 7, 0]):
        date = (today - dt.timedelta(days=days_ago)).isoformat()
        roll = api('GET', '/attendance?' + urllib.parse.urlencode({'courseId': course['id'], 'date': date}))
        statuses = ['present', 'present', 'present', 'late', 'present', 'present', 'absent', 'present', 'leave', 'present', 'present', 'present']
        records = [{**record, 'status': statuses[(si + ci + di) % len(statuses)]} for si, record in enumerate(roll['records'])]
        api('PUT', '/attendance/batch', {'courseId': course['id'], 'date': date, 'version': roll['version'], 'records': records})

# Set status variants only on students this invocation created, after saving history.
for index, status in [(10, '休学'), (11, '已毕业')]:
    if cohort[index]['id'] in added_ids:
        row = api('GET', '/students/' + cohort[index]['id'])
        api('PUT', '/students/' + row['id'], {**row, 'status': status})

accounts = {row['username']: row for row in api('GET', '/users')}
created_accounts = []
if 'demo.teacher' not in accounts:
    teacher = api('POST', '/users', {'username': 'demo.teacher', 'password': demo_password, 'displayName': '陈老师（演示）', 'role': 'TEACHER'})
    created_accounts.append('demo.teacher')
    for course in showcase_courses:
        if course['code'] in ['JAVA101', 'WEB303']:
            api('PUT', f'/users/{teacher["id"]}/courses/{course["id"]}')
if 'demo.student' not in accounts:
    api('POST', '/users', {'username': 'demo.student', 'password': demo_password,
        'displayName': names[0], 'role': 'STUDENT', 'studentId': cohort[0]['id']})
    created_accounts.append('demo.student')

report = {
    'timestamp': dt.datetime.now(dt.timezone.utc).isoformat(), 'base': args.base,
    'dataset': 'DEMO26 fictional project showcase', 'addedStudents': added_students,
    'createdCourses': created_courses, 'existingCoursesPreserved': skipped_courses,
    'createdAccounts': created_accounts, 'overview': api('GET', '/dashboard/overview'),
}
target = Path(args.report)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: report[key] for key in ['addedStudents', 'createdCourses', 'existingCoursesPreserved', 'createdAccounts']}, ensure_ascii=False))
print('Showcase data saved through the real API; report: ' + str(target))
