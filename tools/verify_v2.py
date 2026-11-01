"""Real HTTP/MySQL acceptance checks. Use ONLY a disposable acceptance database.

V2_TEST_PASSWORD=<bootstrap password> python tools/verify_v2.py --base http://127.0.0.1:8086
No tokens, passwords or personal data are written to the JSON report.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import datetime as dt
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid
import base64
import hashlib
import hmac
import http.client
import time

parser=argparse.ArgumentParser()
parser.add_argument('--base',default='http://127.0.0.1:8086')
parser.add_argument('--report',default='runtime/acceptance.json')
args=parser.parse_args()
prefix='T'+uuid.uuid4().hex[:8]
checks=[]
token=None

def call(method,path,body=None,as_token='admin',expected=200):
    auth=token if as_token=='admin' else as_token
    headers={'Content-Type':'application/json'}
    if auth: headers['Authorization']='Bearer '+auth
    request=urllib.request.Request(args.base+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=25) as response:
            status=response.status; payload=json.load(response)
    except urllib.error.HTTPError as error:
        status=error.code; payload=json.load(error)
    assert status==expected, f'{method} {path}: expected {expected}, got {status}: {payload.get("msg")}'
    assert payload['code']==(1 if expected<400 else 0),payload
    return payload.get('data')

def ok(name): checks.append(name);print('PASS',name,flush=True)

def check_oversized_content_length():
    """Require rejection from headers, before attempting to upload 16+ MiB.

    urllib may raise BrokenPipeError while sending a body that Tomcat has
    already rejected. This check explicitly reads and validates the 413.
    """
    url=urllib.parse.urlsplit(args.base+'/students/import')
    connection_type=http.client.HTTPSConnection if url.scheme=='https' else http.client.HTTPConnection
    connection=connection_type(url.hostname,url.port,timeout=25)
    try:
        connection.putrequest('POST',url.path)
        connection.putheader('Content-Type','application/json')
        connection.putheader('Authorization','Bearer '+token)
        connection.putheader('Content-Length',str(16*1024*1024+1))
        connection.endheaders()
        response=connection.getresponse()
        payload=json.loads(response.read())
        assert response.status==413, f'oversized Content-Length: expected 413, got {response.status}'
        assert payload['code']==0,payload
    finally:
        connection.close()
def student(no,name='验收学生'):
    return {'studentNo':prefix+no,'name':name,'gender':'未说明','className':classroom['name'],'phone':'','email':'','status':'在读','enrollmentDate':'2026-09-01'}
def newcourse(suffix,capacity=20):
    return call('POST','/courses',{'code':prefix+suffix,'name':'验收课程 '+suffix,'teacher':'验收教师','description':'隔离数据库验收数据','category':'专业必修','credits':3,'hours':48,'capacity':capacity,'room':'测试教室','weekday':1,'time':'09:00–10:30','color':'orange'})
def login(name,password): return call('POST','/auth/login',{'username':name,'password':password},None)['token']
def parallel(function):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:return list(executor.map(function,range(2)))
def race(method,path,bodies,auth= 'admin'):
    def run(i):
        current=token if auth=='admin' else auth
        req=urllib.request.Request(args.base+path,data=json.dumps(bodies[i]).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+current},method=method)
        try:
            with urllib.request.urlopen(req,timeout=25) as response:return response.status
        except urllib.error.HTTPError as error:return error.code
    return sorted(parallel(run))

try:
    call('GET','/students',as_token=None,expected=401)
    call('GET','/courses',as_token='invalid.jwt.token',expected=401)
    call('POST','/auth/login',{'username':'admin','password':'wrong'},None,401)
    token=login('admin',os.environ['V2_TEST_PASSWORD'])
    assert call('GET','/auth/me')['role']=='ADMIN'
    call('GET','/unknown-endpoint',expected=404)
    if os.environ.get('V2_TEST_JWT_SECRET'):
        def encode_part(value):return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
        original=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'=='))
        header=encode_part({'alg':'HS256','typ':'JWT'})
        claims=encode_part({**original,'exp':int(time.time())-300})
        content=header+b'.'+claims
        signature=base64.urlsafe_b64encode(hmac.new(os.environ['V2_TEST_JWT_SECRET'].encode(),content,hashlib.sha256).digest()).rstrip(b'=')
        call('GET','/auth/me',as_token=(content+b'.'+signature).decode(),expected=401)
    ok('JWT authentication, malformed token and bad password rejected')
    classroom=call('POST','/classes',{'name':prefix+' 班','major':'软件工程'})
    a=call('POST','/students',student('A'))
    b=call('POST','/students',student('B'))
    c=call('POST','/students',student('C'))
    assert a['major']=='软件工程' and a['version']==0
    call('POST','/students',student('a'),expected=409)
    call('POST','/students',{**student('BAD'),'phone':'123'},expected=400)
    call('POST','/students',{**student('DATE'),'enrollmentDate':'2026-02-29'},expected=400)
    paged=call('GET','/students?'+urllib.parse.urlencode({'search':prefix,'page':2,'pageSize':2}))
    assert paged['total']==3 and len(paged['items'])==1
    call('GET','/students?page=0',expected=400)
    ok('Student validation, case-insensitive uniqueness and MySQL pagination')
    updated=call('PUT','/classes/'+classroom['id'],{**classroom,'name':prefix+' 新班'})
    classroom=updated
    a=call('GET','/students/'+a['id']);b=call('GET','/students/'+b['id']);c=call('GET','/students/'+c['id'])
    assert a['className']==classroom['name'] and a['version']==1
    call('PUT','/classes/'+classroom['id'],{**classroom,'version':0},expected=409)
    call('DELETE',f'/classes/{classroom["id"]}?version={classroom["version"]}',expected=400)
    ok('Class rename updates students atomically; stale and occupied deletion rejected')
    headers='学号,姓名,性别,班级,手机号,邮箱,状态,入学日期\r\n'
    valid=f'{prefix}IMP1,"验收,同学",未说明,{classroom["name"]},,,在读,2026-09-01\r\n'
    invalid=f'{prefix}IMP2,错误,男,{classroom["name"]},123,,在读,2026-09-01\r\n'
    call('POST','/students/import',{'csv':headers+valid+invalid},expected=400)
    assert call('GET','/students?search='+prefix+'IMP')['total']==0
    result=call('POST','/students/import',{'csv':'\ufeff'+headers+valid})
    assert result['imported']==1
    call('POST','/students/import',{'csv':headers+valid},expected=400)
    call('POST','/students/import',{'csv':'姓名,学号\n某人,1234'},expected=400)
    call('POST','/students/import',{'csv':headers+'"unclosed'},expected=400)
    call('POST','/students/import',{'csv':headers+'a,b'},expected=400)
    call('POST','/students/import',{'csv':'X'*(2*1024*1024+1)},expected=400)
    check_oversized_content_length()
    call('POST','/students/import',{'csv':headers+''.join(f'{prefix}L{i:03},测试,男,{classroom["name"]},,,在读,2026-09-01\n' for i in range(501))},expected=400)
    assert call('GET','/students?search='+prefix+'L')['total']==0
    ok('CSV BOM and quoted comma accepted; malformed row and duplicate leave no partial insert')
    course=newcourse('CORE');other=newcourse('OTHER');seat=newcourse('SEAT',1)
    stale={**course,'capacity':30};course=call('PUT','/courses/'+course['id'],stale)
    call('PUT','/courses/'+course['id'],stale,expected=409)
    call('POST',f'/courses/{course["id"]}/enrollments',{'studentIds':[a['id'],b['id']]})
    assert len(call('GET',f'/courses/{course["id"]}/students'))==2
    call('POST',f'/courses/{course["id"]}/enrollments',{'studentIds':[a['id']]},expected=400)
    call('POST',f'/courses/{course["id"]}/enrollments',{'studentIds':[c['id'],'missing']},expected=404)
    assert len(call('GET',f'/courses/{course["id"]}/students'))==2
    statuses=race('POST',f'/courses/{seat["id"]}/enrollments',[{'studentIds':[a['id']]},{'studentIds':[b['id']]}])
    assert statuses==[200,400],statuses
    assert len(call('GET',f'/courses/{seat["id"]}/students'))==1
    ok('Explicit enrollment rolls back invalid batches; concurrent final seat cannot oversubscribe')
    password='Acceptance-'+uuid.uuid4().hex[:16]
    teacher=call('POST','/users',{'username':prefix+'teacher','password':password,'displayName':'验收教师','role':'TEACHER'})
    tt=login(teacher['username'],password)
    assert call('GET','/courses',as_token=tt)==[]
    assert call('GET','/students',as_token=tt)['total']==0
    call('POST','/students',student('DENY'),tt,403)
    call('PUT',f'/users/{teacher["id"]}/courses/{course["id"]}')
    assert len(call('GET','/courses',as_token=tt))==1
    assert call('GET','/students',as_token=tt)['total']==2
    call('GET','/grades?courseId='+other['id'],as_token=tt,expected=403)
    call('GET','/reports?courseId='+other['id'],as_token=tt,expected=403)
    call('GET','/audit',as_token=tt,expected=403)
    ok('Teacher course scopes enforced in directory, grades, reports and administration')
    gs=call('GET','/grades?courseId='+course['id']);exam=gs['exams'][0]
    assert all(g.get('score') is None for g in gs['grades']) and len(gs['grades'])==2
    exam=call('PUT',f'/courses/{course["id"]}/exams/{exam["id"]}',{**exam,'weight':40})
    second=call('POST',f'/courses/{course["id"]}/exams',{'name':'第二次考试','examDate':'2026-10-23','weight':60})
    def sheet(e):return call('GET','/grades?'+urllib.parse.urlencode({'courseId':course['id'],'examId':e['id']}))
    def score(e,who,value):
        g=next(g for g in sheet(e)['grades'] if g['studentId']==who['id'])
        return {'studentId':who['id'],'score':value,'version':g['version']}
    def save(e,scores,expected=200):return call('PUT','/grades/batch',{'courseId':course['id'],'examId':e['id'],'scores':scores},tt,expected)
    save(exam,[score(exam,a,0),score(exam,b,80)])
    save(second,[score(second,a,60)])
    rows=call('GET','/reports?courseId='+course['id']);ra=next(r for r in rows if r['id']==a['id']);assert float(ra['averageScore'])==36 and ra['recorded']==2,ra
    old=score(exam,a,5)
    save(exam,[old,{'studentId':b['id'],'score':101,'version':0}],400)
    assert next(g for g in sheet(exam)['grades'] if g['studentId']==a['id'])['score']==0
    save(exam,[old,{'studentId':b['id'],'score':50,'version':0}],409)
    assert next(g for g in sheet(exam)['grades'] if g['studentId']==a['id'])['score']==0
    save(exam,[score(exam,a,10.001)],400)
    race_grade=score(exam,a,10)
    statuses=race('PUT','/grades/batch',[{'courseId':course['id'],'examId':exam['id'],'scores':[race_grade]},{'courseId':course['id'],'examId':exam['id'],'scores':[{**race_grade,'score':20}]}])
    assert statuses==[200,409],statuses
    for value in [0,60,80,90,100,None,66.25]:
        save(exam,[score(exam,a,value)])
        assert next(g for g in sheet(exam)['grades'] if g['studentId']==a['id'])['score']==value
    ok('Multiple exams, null/zero, weighted report, decimal validation and stale batch rollback')
    day='2026-10-23';roll=call('GET',f'/attendance?courseId={course["id"]}&date={day}')
    assert roll['savedAt'] is None and roll['version']==-1
    payload={'courseId':course['id'],'date':day,'version':-1,'records':[{'studentId':a['id'],'status':'present'},{'studentId':b['id'],'status':'late'}]}
    statuses=race('PUT','/attendance/batch',[payload,payload],tt)
    assert statuses==[200,409],statuses
    roll=call('GET',f'/attendance?courseId={course["id"]}&date={day}')
    assert roll['savedAt'] and len(roll['records'])==2
    call('PUT','/attendance/batch',{**payload,'version':0,'records':[payload['records'][0]]},tt,400)
    call('PUT','/students/'+a['id'],{**a,'status':'已毕业'})
    history=call('GET',f'/attendance?courseId={course["id"]}&date={day}');assert len(history['students'])==2
    fresh=call('GET',f'/attendance?courseId={course["id"]}&date=2026-10-24');assert len(fresh['students'])==1
    call('DELETE',f'/courses/{course["id"]}/enrollments/{b["id"]}',expected=400)
    call('DELETE',f'/courses/{course["id"]}/exams/{exam["id"]}?version={exam["version"]}',expected=400)
    current_course=next(c for c in call('GET','/courses') if c['id']==course['id'])
    call('DELETE',f'/courses/{course["id"]}?version={current_course["version"]}',expected=400)
    ok('Attendance first-save race, complete roster validation and historical roster preservation')
    account=call('POST','/users',{'username':prefix+'student','password':password,'displayName':'验收学生','role':'STUDENT','studentId':b['id']})
    st=login(account['username'],password);portal=call('GET','/portal',as_token=st)
    assert portal['student']['id']==b['id'] and all(g['studentId']==b['id'] for g in portal['grades'])
    call('GET','/students',as_token=st,expected=403)
    call('GET','/grades?courseId='+course['id'],as_token=st,expected=403)
    assert all(r['id']==b['id'] for r in call('GET','/reports',as_token=st))
    call('POST',f'/courses/{other["id"]}/enrollments',{'studentIds':[c['id']]},st,403)
    call('POST',f'/courses/{other["id"]}/enrollments',{'studentIds':[b['id']]},st)
    call('DELETE',f'/courses/{other["id"]}/enrollments/{b["id"]}',as_token=st)
    ok('Student portal is self-scoped; self enrollment and protected withdrawal work')
    from_to=call('GET','/reports?'+urllib.parse.urlencode({'courseId':course['id'],'from':'2026-10-23','to':'2026-10-23'}))
    assert all(float(r['attendanceRate'])==100 for r in from_to)
    call('GET','/reports?from=2026-12-01&to=2026-01-01',expected=400)
    overview=call('GET','/dashboard/overview',as_token=tt);assert overview['courseCount']==1 and overview['studentCount']==2
    ok('Date-filtered report and dashboard use real scoped denominators')
    before=call('GET','/students?search='+prefix)['total']
    call('POST','/students/batch-delete',{'ids':[c['id'],'missing']},expected=404)
    assert call('GET','/students?search='+prefix)['total']==before
    call('POST','/students/batch-delete',{'ids':[b['id']]})
    call('GET','/portal',as_token=st,expected=401)
    assert all(g['studentId']!=b['id'] for g in sheet(exam)['grades'])
    assert all(r['studentId']!=b['id'] for r in call('GET',f'/attendance?courseId={course["id"]}&date={day}')['records'])
    ok('Batch deletion is atomic, cascades grades/attendance and revokes bound student login')
    call('DELETE',f'/users/{teacher["id"]}/courses/{course["id"]}')
    call('GET','/grades?courseId='+course['id'],as_token=tt,expected=403)
    call('PUT','/auth/password',{'oldPassword':password,'password':password+'X'},tt)
    call('GET','/auth/me',as_token=tt,expected=401)
    tt=login(teacher['username'],password+'X')
    call('POST','/auth/logout',as_token=tt)
    call('GET','/auth/me',as_token=tt,expected=401)
    ok('Authorization revocation, password changes and logout invalidate existing access')
    audit=call('GET','/audit?pageSize=200')['items']
    assert any(r['result']=='FAILURE' and r['action']=='PUT_GRADES' for r in audit)
    assert any(r['result']=='SUCCESS' and r['action']=='POST_STUDENTS' for r in audit)
    assert password not in json.dumps(audit)
    ok('Success and rolled-back failure audits persist without password/token disclosure')
    report={'version':'2.0.0','passed':True,'timestamp':dt.datetime.now(dt.timezone.utc).isoformat(),'base':args.base,'database':'disposable MySQL 8.0.34','checks':checks,'count':len(checks)}
    target=Path(args.report);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'ALL {len(checks)} acceptance groups passed. Report: {target}')
except Exception as error:
    report={'version':'2.0.0','passed':False,'timestamp':dt.datetime.now(dt.timezone.utc).isoformat(),'base':args.base,'checks':checks,'count':len(checks),'error_type':type(error).__name__}
    target=Path(args.report);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'FAILED after {len(checks)} groups. Fixture prefix: {prefix}')
    raise
