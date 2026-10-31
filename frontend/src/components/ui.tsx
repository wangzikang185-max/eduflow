import { useEffect, useRef } from 'react';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Inbox, LoaderCircle, X } from 'lucide-react';

export function Button({ children, variant = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;
}
export function Avatar({ name, index = 0, large = false }: { name: string; index?: number; large?: boolean }) {
  return <span className={`avatar avatar-${index % 6} ${large ? 'avatar-large' : ''}`}>{name.slice(-2)}</span>;
}
export function Badge({ children, tone = 'green' }: { children: ReactNode; tone?: string }) { return <span className={`badge badge-${tone}`}><i />{children}</span>; }
export function Loading() { return <div className="state"><LoaderCircle className="spin" size={28} /><p>正在加载数据…</p></div>; }
export function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="state"><AlertCircle size={30} /><h3>暂时无法加载</h3><p>{message}</p><Button onClick={retry}>重新加载</Button></div>; }
export function Empty({ title = '没有找到匹配的数据', text = '试试其他关键词，或调整筛选条件。', action }: { title?: string; text?: string; action?: ReactNode }) { return <div className="state"><span className="empty-icon"><Inbox size={30} /></span><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = ref.current;
    el?.querySelector<HTMLElement>('input,button,select,textarea,a[href]')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const all = Array.from(el?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []);
        const first = all[0], last = all.at(-1);
        if(e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();}
        else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}
      }
    }
    document.addEventListener('keydown',onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown',onKey); previous?.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={e => { if(e.target===e.currentTarget) onClose(); }}><div ref={ref} className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><h2 id="modal-title">{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-btn" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button></div>{children}</div></div>;
}
export function Pagination({ page, pageSize = 10, total, onChange }: { page: number; pageSize?: number; total: number; onChange: (p: number) => void }) {
  const count=Math.max(1,Math.ceil(total/pageSize));
  const visible = Array.from(new Set([1, page-1, page, page+1, count])).filter(p=>p>=1&&p<=count).sort((a,b)=>a-b);
  return <div className="pagination"><span>共 <strong>{total}</strong> 条记录{total>0&&<>，显示 {(page-1)*pageSize+1}–{Math.min(page*pageSize,total)} 条</>}</span><div><button aria-label="上一页" disabled={page===1} onClick={()=>onChange(page-1)}><ChevronLeft size={16}/></button>{visible.map((p,i)=><span className="page-group" key={p}>{i>0&&p>visible[i-1]+1&&<span className="ellipsis">…</span>}<button aria-label={`第 ${p} 页`} aria-current={p===page?'page':undefined} className={p===page?'active':''} onClick={()=>onChange(p)}>{p}</button></span>)}<button aria-label="下一页" disabled={page>=count} onClick={()=>onChange(page+1)}><ChevronRight size={16}/></button></div></div>;
}
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <input className="checkbox" type="checkbox" checked={checked} onChange={onChange} aria-label={label}/>; }
export function Toast({ message, kind }: { message: string; kind: 'success'|'error' }) { return <div role={kind==='error'?'alert':'status'} className={`toast toast-${kind}`}>{kind==='success'?<Check size={18}/>:<AlertCircle size={18}/>}<span>{message}</span></div>; }
