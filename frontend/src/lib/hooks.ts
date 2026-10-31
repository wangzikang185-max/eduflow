import { useEffect, useRef, useState } from 'react';

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data,setData]=useState<T|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [version,setVersion]=useState(0);
  const loaderRef=useRef(loader); loaderRef.current=loader;
  useEffect(()=>{let active=true;setLoading(true);setError('');loaderRef.current().then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'加载失败');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[...deps,version]);
  return {data,loading,error,reload:()=>setVersion(v=>v+1)};
}
export function useDebounce<T>(value:T, ms=250) {const [v,setV]=useState(value);useEffect(()=>{const t=setTimeout(()=>setV(value),ms);return()=>clearTimeout(t);},[value,ms]);return v;}
