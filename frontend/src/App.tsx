import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, Bell, BookOpen, CalendarCheck2, Check, ChevronDown, ChevronRight, CircleHelp, Code2, Command, ExternalLink, GraduationCap, LayoutDashboard, Menu, Search, Settings, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api, IS_MOCK } from './lib/api';
import { Avatar, Badge, Button, Modal, Toast } from './components/ui';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Courses from './pages/Courses';
import Grades from './pages/Grades';
import Attendance from './pages/Attendance';

type Page = 'dashboard'|'students'|'courses'|'grades'|'attendance';
export type Navigate = (page:Page,search?:string)=>void;
export type Notify = (message:string,kind?:'success'|'error')=>void;
const navigation=[{id:'dashboard',label:'教务工作台',english:'Overview',icon:LayoutDashboard},{id:'students',label:'学生档案',english:'Students',icon:Users},{id:'courses',label:'课程管理',english:'Courses',icon:BookOpen},{id:'grades',label:'成绩分析',english:'Grades',icon:GraduationCap},{id:'attendance',label:'考勤管理',english:'Attendance',icon:CalendarCheck2}] as const;
function getPage():Page{const hash=location.hash.replace('#/','');return navigation.some(n=>n.id===hash)?hash as Page:(IS_MOCK?'dashboard':'students');}

function Workspace(){
  const [page,setPage]=useState<Page>(getPage),[mobile,setMobile]=useState(false),[globalSearch,setGlobalSearch]=useState(''),[initialSearch,setInitialSearch]=useState(''),[studentKey,setStudentKey]=useState(0),[notifications,setNotifications]=useState(false),[read,setRead]=useState(false),[help,setHelp]=useState(false),[settings,setSettings]=useState(false),[reset,setReset]=useState(false),[profileName,setProfileName]=useState(()=>{try{return localStorage.getItem('xuexu.profile')||'陈老师';}catch{return '陈老师';}}),[profileDraft,setProfileDraft]=useState(profileName),[dirty,setDirty]=useState(false),[toast,setToast]=useState<{message:string;kind:'success'|'error'}|null>(null);
  const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const searchRef=useRef<HTMLInputElement>(null);const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  const notify=useCallback<Notify>((message,kind='success')=>{if(toastTimer.current)clearTimeout(toastTimer.current);setToast({message,kind});toastTimer.current=setTimeout(()=>setToast(null),4500);},[]);
  const onDirty=useCallback((value:boolean)=>setDirty(value),[]);
  const navigate=useCallback<Navigate>((next,search='')=>{
    if(dirtyRef.current&&!window.confirm('当前页面有未保存的修改，确认放弃并离开？'))return;
    dirtyRef.current=false;setDirty(false);setPage(next);location.hash=`/${next}`;setMobile(false);setNotifications(false);
    if(next==='students'){setInitialSearch(search);setStudentKey(k=>k+1);}window.scrollTo({top:0,behavior:'smooth'});
  },[]);
  useEffect(()=>{
    function onHash(){const next=getPage();if(next===page)return;if(dirtyRef.current&&!window.confirm('有未保存的修改，确认离开？')){history.replaceState(null,'',`#/${page}`);return;}dirtyRef.current=false;setDirty(false);setPage(next);setMobile(false);}
    function onKey(e:KeyboardEvent){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchRef.current?.focus();}if(e.key==='Escape'){setNotifications(false);setMobile(false);}}
    function beforeUnload(e:BeforeUnloadEvent){if(dirtyRef.current){e.preventDefault();}}
    window.addEventListener('hashchange',onHash);window.addEventListener('keydown',onKey);window.addEventListener('beforeunload',beforeUnload);
    return()=>{window.removeEventListener('hashchange',onHash);window.removeEventListener('keydown',onKey);window.removeEventListener('beforeunload',beforeUnload);};
  },[page]);
  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);},[]);
  const current=navigation.find(n=>n.id===page)!;
  return <div className="app-layout">
    <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById("main-content")?.focus();}}>跳转到主要内容</a>
    {mobile&&<button className="sidebar-backdrop" aria-label="关闭导航" onClick={()=>setMobile(false)}/>}
    <aside className={`sidebar ${mobile?'sidebar-open':''}`}>
      <button className="brand" onClick={()=>navigate('dashboard')} aria-label="学序 EduFlow 首页"><span className="brand-logo"><GraduationCap size={27} strokeWidth={1.8}/></span><span><strong>学序<span className="brand-dot">.</span></strong><small>EDUFLOW</small></span></button>
      <div className="workspace-switch"><span className="workspace-monogram">知</span><div><strong>知行学院</strong><span>教务管理工作空间</span></div><ShieldCheck size={16}/></div>
      <div className="nav-label">工作空间 <span>WORKSPACE</span></div>
      <nav aria-label="主导航">{navigation.map(n=><button key={n.id} className={`nav-item ${page===n.id?'active':''}`} aria-current={page===n.id?'page':undefined} onClick={()=>navigate(n.id)}><n.icon size={19}/><span>{n.label}</span>{page===n.id&&<span className="nav-active-dot"/>}</button>)}</nav>
      <div className="sidebar-divider"/><div className="nav-label">支持与服务</div>
      <button className="nav-item" onClick={()=>setHelp(true)}><CircleHelp size={19}/><span>使用帮助</span><ExternalLink size={13}/></button>
      <button className="nav-item" onClick={()=>{setProfileDraft(profileName);setSettings(true);}}><Settings size={19}/><span>工作区设置</span></button>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Sparkles size={20}/></span><h3>让教务，更从容。</h3><p>用更好的工具<br/>陪伴每一份成长。</p><button onClick={()=>setHelp(true)}>了解你的工作台 <ArrowRight size={13}/></button><div className="tip-decoration"/></div><div className="sidebar-mode"><i/>{IS_MOCK?'本地演示工作区':'HTTP 接口模式'}<span>v1.0</span></div><button className="sidebar-profile" onClick={()=>{setProfileDraft(profileName);setSettings(true);}}><Avatar name={profileName} index={2}/><span><strong>{profileName}</strong><small>教务管理员</small></span><ChevronRight size={16}/></button></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" aria-label="打开导航" onClick={()=>setMobile(true)}><Menu size={21}/></button><span className="breadcrumb-home">工作空间</span><ChevronRight size={13}/><span className="breadcrumb-current">{current.label}</span></div><div className="topbar-right"><form className="global-search" onSubmit={e=>{e.preventDefault();navigate('students',globalSearch);setGlobalSearch('');}}><Search size={15}/><input ref={searchRef} aria-label="全局搜索学生" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="搜索学生…"/><kbd><Command size={10}/>K</kbd></form><span className="topbar-separator"/><button className="icon-btn help-top" title="使用帮助" aria-label="打开使用帮助" onClick={()=>setHelp(true)}><CircleHelp size={19}/></button><div className="notification-anchor"><button className="icon-btn notification-btn" aria-label="查看消息通知" aria-expanded={notifications} onClick={()=>setNotifications(v=>!v)}><Bell size={19}/>{!read&&<i/>}</button>{notifications&&<><button className="popover-dismiss" tabIndex={-1} aria-label="关闭通知" onClick={()=>setNotifications(false)}/><div className="notification-popover"><div className="popover-heading"><h3>工作区通知</h3><button onClick={()=>{setRead(true);notify('通知已全部标记为已读');}}>全部已读</button></div><button className="notification-item" onClick={()=>{setRead(true);navigate('grades');}}><span className="stat-icon orange"><GraduationCap size={18}/></span><div><strong>秋季学期成绩录入已开放</strong><p>前往成绩分析，查看并完善课程成绩。</p><small>工作区提示</small></div></button><button className="notification-item" onClick={()=>{setRead(true);navigate('attendance');}}><span className="stat-icon teal"><CalendarCheck2 size={18}/></span><div><strong>让每次到场都有记录</strong><p>按课程和日期保存课堂考勤。</p><small>工作区提示</small></div></button></div></>}</div><button className="topbar-profile" aria-label="打开个人设置" onClick={()=>{setProfileDraft(profileName);setSettings(true);}}><Avatar name={profileName} index={2}/><ChevronDown size={12}/></button></div></header>
    <main id="main-content" tabIndex={-1} className="main-content" key={page}>
      <div className="content-topline"><span><span className="tiny-green-dot"/>2026–2027 学年 · 第一学期</span><span>{current.english} <span className="topline-slash">/</span> EDUFLOW</span></div>
      {page==='dashboard'&&<Dashboard navigate={navigate} notify={notify}/>}
      {page==='students'&&<Students key={studentKey} initialSearch={initialSearch} onConsumed={()=>setInitialSearch('')} notify={notify}/>}
      {page==='courses'&&<Courses notify={notify}/>}
      {page==='grades'&&<Grades notify={notify} onDirty={onDirty}/>}
      {page==='attendance'&&<Attendance notify={notify} onDirty={onDirty}/>}
    </main></div>
    {help&&<Modal title="你好，欢迎使用学序" subtitle="把繁琐留给工具，把时间留给教育。" wide onClose={()=>setHelp(false)}><div className="help-modal-body"><div className="help-feature-grid">{navigation.slice(1).map(n=><button key={n.id} onClick={()=>{setHelp(false);navigate(n.id);}}><n.icon size={23}/><h3>{n.label}</h3><p>{({dashboard:'教务总览',students:'档案增改、班级筛选与 CSV 导入导出',courses:'课程安排、授课教师与学分维护',grades:'成绩录入、分布分析与 CSV 导出',attendance:'课堂点名、异常标记与考勤导出'})[n.id]}</p><ArrowRight size={15}/></button>)}</div><div className="api-guide"><span className="stat-icon purple"><Code2 size={20}/></span><div><h3>为后端对接准备好了</h3><p>统一响应沿用 Spring Boot 的 <code>{'{ code, msg, data }'}</code>。<br/>当前默认连接本机后端，学生列表、新增和修改已接入；其他模块随课程继续开发。</p><a className="text-link" href="/api-docs.html" target="_blank" rel="noopener noreferrer"><Code2 size={14}/>在线阅读接口文档 <ArrowRight size={14}/></a><br/><a className="text-link" href="/api.md" download="学序-接口文档.md"><ArrowDownToLine size={14}/>下载 Markdown 文档</a></div></div><div className="keyboard-tip"><kbd>Ctrl</kbd> + <kbd>K</kbd> 快速搜索学生 <span>·</span><kbd>Esc</kbd> 关闭弹窗</div></div><div className="modal-actions"><Button variant="primary" onClick={()=>setHelp(false)}>开始使用 <ArrowRight size={15}/></Button></div></Modal>}
    {settings&&<Modal title="工作区设置" subtitle="让学序成为更顺手的日常工具。" onClose={()=>setSettings(false)}><div className="settings-body"><div className="settings-profile"><Avatar name={profileName} large index={2}/><div><h3>{profileName}</h3><Badge tone="purple">教务管理员 · 界面角色</Badge></div></div><label className="settings-label">显示名称<input maxLength={15} value={profileDraft} onChange={e=>setProfileDraft(e.target.value)}/></label><div className="setting-info"><span>当前学期</span><strong>2026–2027 学年第一学期</strong></div><div className="setting-info"><span>数据模式</span><Badge tone={IS_MOCK?'amber':'green'}>{IS_MOCK?'浏览器本地演示':'HTTP 业务接口'}</Badge></div><div className="setting-info"><span>前端版本</span><strong>学序 1.0.0</strong></div>{IS_MOCK&&<div className="reset-setting"><div><h4>重置演示工作区</h4><p>恢复初始样例，清除本浏览器中的业务修改。</p></div><Button variant="danger" onClick={()=>{setSettings(false);setReset(true);}}>重置数据</Button></div>}<p className="settings-hint"><ShieldCheck size={15}/>{IS_MOCK?'演示模式不提供身份认证，请使用虚构数据体验。':'当前界面角色仅为展示；权限以服务端会话为准。'}</p></div><div className="modal-actions"><Button onClick={()=>setSettings(false)}>取消</Button><Button variant="primary" disabled={!profileDraft.trim()} onClick={()=>{try{localStorage.setItem('xuexu.profile',profileDraft.trim());setProfileName(profileDraft.trim());setSettings(false);notify('个人显示名称已更新');}catch{notify('浏览器存储不可用','error');}}}><Check size={16}/>保存设置</Button></div></Modal>}
    {reset&&<Modal title="确认重置演示数据？" subtitle="当前浏览器中的学生、课程、成绩和考勤修改将被清除。" onClose={()=>setReset(false)}><div className="confirm-content"><p>将恢复为 128 位学生与 6 门课程的初始样例。请先导出需要保留的数据。</p></div><div className="modal-actions"><Button onClick={()=>setReset(false)}>取消</Button><Button variant="danger" onClick={()=>{api.resetDemo();setReset(false);setSettings(false);setDirty(false);dirtyRef.current=false;location.hash='/dashboard';location.reload();}}>确认重置</Button></div></Modal>}
    {toast&&<Toast message={toast.message} kind={toast.kind}/>}
  </div>;
}
class ErrorBoundary extends Component<{children:ReactNode},{error:boolean}>{
  state={error:false};static getDerivedStateFromError(){return {error:true};}componentDidCatch(error:Error,info:ErrorInfo){console.error('Workspace rendering error',error,info.componentStack);}
  render(){return this.state.error?<div className="fatal-error"><GraduationCap size={40}/><h1>页面暂时遇到了一点问题</h1><p>已保存的数据仍在浏览器中，刷新后可重新打开工作台。</p><Button variant="primary" onClick={()=>location.reload()}>重新打开工作台</Button></div>:this.props.children;}
}
export default function App(){return <ErrorBoundary><Workspace/></ErrorBoundary>;}
