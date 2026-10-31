import { useState } from 'react';

export function TrendChart({ data }: { data: {month:string;current:number;previous:number}[] }) {
  const [hover,setHover]=useState<number|null>(null);
  const low=data.some(d=>d.current<50||d.previous<50)?0:50;
  const ticks=Array.from({length:6},(_,i)=>low+(100-low)*i/5);
  const x=(i:number)=>48+i*106; const y=(n:number)=>220-(n-low)/(100-low)*165;
  function path(key:'current'|'previous') {
    const pts=data.map((d,i)=>[x(i),y(d[key])]);
    return pts.reduce((s,p,i)=>i===0?`M${p[0]},${p[1]}`:s+` C${pts[i-1][0]+48},${pts[i-1][1]} ${p[0]-48},${p[1]} ${p[0]},${p[1]}`,'');
  }
  return <div className="trend-chart"><svg viewBox="0 0 620 258" role="img" aria-label="最近六个月平均成绩趋势，本学期与上学期对比"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f47555" stopOpacity=".18"/><stop offset="100%" stopColor="#f47555" stopOpacity="0"/></linearGradient></defs>{ticks.map(n=><g key={n}><line x1="42" x2="590" y1={y(n)} y2={y(n)} stroke="#eef0f3" strokeDasharray="4 5"/><text x="14" y={y(n)+4} fill="#9b9da8" fontSize="11">{n}</text></g>)}<path d={path('current')+` L${x(5)},225 L48,225 Z`} fill="url(#area)"/><path d={path('previous')} fill="none" stroke="#bdc9d8" strokeWidth="2.5" strokeDasharray="5 6"/><path d={path('current')} fill="none" stroke="#f47555" strokeWidth="3"/>{data.map((d,i)=><g key={d.month} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><rect x={x(i)-45} y="0" width="90" height="235" fill="transparent"/><circle cx={x(i)} cy={y(d.current)} r={hover===i?6:4} fill="white" stroke="#f47555" strokeWidth="2.5"/><text x={x(i)} y="251" textAnchor="middle" fill="#9195a1" fontSize="11">{d.month}</text>{hover===i&&<g><rect x={Math.min(510,Math.max(32,x(i)-46))} y={y(d.current)-49} width="92" height="33" rx="7" fill="#272b36"/><text x={Math.min(556,Math.max(78,x(i)))} y={y(d.current)-28} textAnchor="middle" fill="white" fontSize="12">平均分 {d.current}</text></g>}</g>)}</svg></div>;
}
export function Sparkline({ color, points }: {color:string;points:number[]}) { const d=points.map((p,i)=>`${i*12},${40-p}`).join(' ');return <svg className="sparkline" viewBox="0 0 96 44" aria-hidden="true"><polyline points={d} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
export function Ring({ values, total }: {values:{label:string;value:number;color:string}[];total:number}) {
  let offset=0;return <div className="ring-layout"><div className="ring"><svg viewBox="0 0 160 160" role="img" aria-label={values.map(v=>`${v.label} ${v.value} 人`).join('，')}><circle cx="80" cy="80" r="62" fill="none" stroke="#f0f1f5" strokeWidth="17"/>{values.map(v=>{const length=total?v.value/total*389.56:0;const el=<circle key={v.label} cx="80" cy="80" r="62" fill="none" stroke={v.color} strokeWidth="17" strokeDasharray={`${Math.max(0,length-4)} ${389.56-Math.max(0,length-4)}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)"/>;offset+=length;return el;})}</svg><div><strong>{total}</strong><span>学生总数</span></div></div><div className="ring-legend">{values.map(v=><div key={v.label}><i style={{background:v.color}}/><span>{v.label}</span><strong>{v.value}</strong></div>)}</div></div>;
}
