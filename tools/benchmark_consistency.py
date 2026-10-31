"""Repeatable consistency experiments; run ONLY against a disposable test database.

Creates synthetic students and courses, and leaves them in the test database.
Set V2_TEST_PASSWORD to the disposable service's admin password.
Example: python tools/benchmark_consistency.py --base http://127.0.0.1:8089
No tokens, passwords or student identity data are included in the report.
"""
from __future__ import annotations
import argparse, concurrent.futures, collections, datetime as dt, json, math, os
from pathlib import Path
import threading, time, urllib.error, urllib.parse, urllib.request, uuid

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base',default='http://127.0.0.1:8089')
parser.add_argument('--report',default='runtime/consistency-benchmark.json')
args=parser.parse_args()
prefix='B'+uuid.uuid4().hex[:8]
token=None

def request(method,path,body=None,barrier=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    raw=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    req=urllib.request.Request(args.base+path,data=raw,headers=headers,method=method)
    if barrier: barrier.wait(timeout=30)
    start=time.perf_counter()
    try:
        with urllib.request.urlopen(req,timeout=60) as response:
            status=response.status;payload=json.load(response)
    except urllib.error.HTTPError as error:
        status=error.code;payload=json.load(error)
    return {'status':status,'payload':payload,'latency_ms':(time.perf_counter()-start)*1000}

def api(method,path,body=None):
    response=request(method,path,body)
    assert response['status']==200,response
    assert response['payload']['code']==1,response
    return response['payload'].get('data')

def simultaneous(method,path,bodies):
    barrier=threading.Barrier(len(bodies))
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(bodies)) as executor:
        futures=[executor.submit(request,method,path,body,barrier) for body in bodies]
        return [future.result() for future in futures]

def counters(results):return dict(collections.Counter(str(r['status']) for r in results))

def sheet(course,exam):return api('GET',f'/grades?courseId={course}&examId={exam}')

report={'date':'2026-10-31','timestamp_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
    'base':args.base,'dataset':'new synthetic fixtures in isolated test database',
    'method':'Python urllib + ThreadPoolExecutor + barrier; real HTTP; one admin session; no browser; no retry',
    'environment':{'os':'Windows 11','java':'21','spring_boot':'4.0.8','mysql':'8.0.34','hikari_pool':'default 10','cpu':'AMD Ryzen 7 5800H (8 cores / 16 threads)'},
    'enrollment_rounds':[],'grade_version_rounds':[],'batch_rollback_rounds':[],'passed':False}
try:
    token=api('POST','/auth/login',{'username':'admin','password':os.environ['V2_TEST_PASSWORD']})['token']
    classroom=api('POST','/classes',{'name':prefix+'一致性实验班','major':'软件工程'})
    students=[]
    for i in range(100):
        students.append(api('POST','/students',{'studentNo':f'{prefix}{i:03}','name':f'虚构实验学生{i:03}',
            'gender':'未说明','className':classroom['name'],'phone':'','email':'','status':'在读','enrollmentDate':'2026-09-01'}))
    print('Created 100 synthetic students',flush=True)
    courses=[]
    for round_number in range(1,4):
        course=api('POST','/courses',{'code':f'{prefix}C{round_number}','name':f'并发实验课程{round_number}',
            'teacher':'虚构实验教师','description':'Disposable consistency experiment','category':'专业必修',
            'credits':3,'hours':48,'capacity':30,'room':'实验教室','weekday':1,'time':'09:00–10:30','color':'orange'})
        courses.append(course)
        results=simultaneous('POST',f'/courses/{course["id"]}/enrollments',[{'studentIds':[s['id']]} for s in students])
        count=counters(results);roster=api('GET',f'/courses/{course["id"]}/students')
        actual=next(c for c in api('GET','/courses') if c['id']==course['id'])
        latencies=sorted(r['latency_ms'] for r in results)
        result={'round':round_number,'concurrent_requests':100,'capacity':30,'http_status_counts':count,
            'roster_count':len(roster),'course_enrolled_count':actual['enrolled'],
            'unexpected_transport_errors':0,'p50_ms':round(latencies[49],2),'p95_ms':round(latencies[94],2),
            'max_ms':round(latencies[-1],2),'capacity_rejection_messages':sorted({r['payload']['msg'] for r in results if r['status']==400})}
        report['enrollment_rounds'].append(result)
        assert count=={'200':30,'400':70} or count=={'400':70,'200':30},result
        assert all(r['payload']['msg']=='课程容量不足' for r in results if r['status']==400),result
        assert len(roster)==30 and int(actual['enrolled'])==30,result
        print('ENROLLMENT',json.dumps(result,ensure_ascii=False),flush=True)
    course=courses[0]['id']
    view=api('GET',f'/grades?courseId={course}');exam=view['exams'][0]['id']
    target=sorted(view['grades'],key=lambda x:x['studentId'])[0]['studentId']
    for round_number in range(1,21):
        current=next(g for g in sheet(course,exam)['grades'] if g['studentId']==target)
        values=[float(round_number),float(round_number)+0.5]
        bodies=[{'courseId':course,'examId':exam,'scores':[{'studentId':target,'score':v,'version':current['version']}]} for v in values]
        results=simultaneous('PUT','/grades/batch',bodies)
        count=counters(results);stored=next(g for g in sheet(course,exam)['grades'] if g['studentId']==target)
        winner=next(values[i] for i,r in enumerate(results) if r['status']==200)
        result={'round':round_number,'concurrent_requests':2,'http_status_counts':count,
            'version_increment':stored['version']-current['version'],'stored_value_matches_winner':float(stored['score'])==winner}
        report['grade_version_rounds'].append(result)
        assert sorted(r['status'] for r in results)==[200,409],result
        assert result['version_increment']==1 and result['stored_value_matches_winner'],result
    print('GRADE VERSION: 20/20 rounds, one 200 + one 409, saved value matches winner',flush=True)
    # Service sorts by student ID. Make the second sorted row stale so that
    # a successful first SQL update must be rolled back after the second fails.
    for round_number in range(1,11):
        rows=sorted(sheet(course,exam)['grades'],key=lambda x:x['studentId'])[:2]
        first,second=rows
        api('PUT','/grades/batch',{'courseId':course,'examId':exam,'scores':[{'studentId':second['studentId'],'score':60,'version':second['version']}]})
        before={g['studentId']:(g['score'],g['version']) for g in sheet(course,exam)['grades']}
        response=request('PUT','/grades/batch',{'courseId':course,'examId':exam,'scores':[
            {'studentId':first['studentId'],'score':99,'version':first['version']},
            {'studentId':second['studentId'],'score':88,'version':second['version']}]})
        after={g['studentId']:(g['score'],g['version']) for g in sheet(course,exam)['grades']}
        result={'round':round_number,'rows_in_batch':2,'stale_row_position_in_sql_order':2,
            'http_status':response['status'],'score_and_version_changes_after_rejection':sum(before[k]!=after[k] for k in before)}
        report['batch_rollback_rounds'].append(result)
        assert response['status']==409 and before==after,result
    print('BATCH ROLLBACK: 10/10 rounds, second-row conflict, 0 persisted score/version changes',flush=True)
    header='学号,姓名,性别,班级,手机号,邮箱,状态,入学日期\r\n'
    csv=''.join(f'{prefix}CSV{i:03},虚构CSV学生{i:03},未说明,{classroom["name"]},{"123" if i==499 else ""},,在读,2026-09-01\r\n' for i in range(500))
    path='/students?search='+urllib.parse.quote(prefix+'CSV')
    before=api('GET',path)['total'];response=request('POST','/students/import',{'csv':header+csv});after=api('GET',path)['total']
    report['csv_validation']={'rows':500,'invalid_row':500,'http_status':response['status'],'inserted_rows':after-before,'phase':'whole-file validation before writes'}
    assert response['status']==400 and after==before,report['csv_validation']
    print('CSV: invalid row 500, 400 rejection, 0 inserted rows',flush=True)
    report['passed']=True
finally:
    output=Path(args.report);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('ALL consistency experiments passed. Report:',args.report)
