'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {useAddSky} from './AddSkyModal';

type TransitionDocument=Document&{startViewTransition?:(update:()=>void)=>{finished:Promise<void>}};

export function Header(){
 const path=usePathname(),{open}=useAddSky(),[dark,setDark]=useState(false),themeButton=useRef<HTMLButtonElement>(null),fluid=path==='/'||path==='/fluid';
 useEffect(()=>setDark(document.documentElement.classList.contains('dark')),[]);
 const applyTheme=(value:boolean)=>{flushSync(()=>setDark(value));document.documentElement.classList.toggle('dark',value);localStorage.setItem('sky-theme',value?'dark':'light')};
 const toggle=()=>{
  const value=!dark,rect=themeButton.current?.getBoundingClientRect(),root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,doc=document as TransitionDocument;
  root.style.setProperty('--theme-x',`${rect?rect.left+rect.width/2:innerWidth/2}px`);root.style.setProperty('--theme-y',`${rect?rect.top+rect.height/2:32}px`);
  if(reduced||!doc.startViewTransition){applyTheme(value);return}
  root.dataset.themeTransition='active';const transition=doc.startViewTransition(()=>applyTheme(value));transition.finished.finally(()=>delete root.dataset.themeTransition);
 };
 return <header className="h-16 px-5 md:px-8 flex items-center justify-between border-b line relative z-20 bg-[var(--bg)]"><Link href="/" className="site-mark text-[13px] font-semibold tracking-[.14em]">SKY COLORS</Link><nav className="flex items-center gap-4 md:gap-7 text-xs"><Link className={fluid?'':'muted'} href="/">Fluid</Link><Link className={path==='/palette'?'':'muted'} href="/palette">Palette</Link><Link className={(path==='/archive'||path.startsWith('/sky/'))?'':'muted'} href="/archive">Archive</Link><button ref={themeButton} className="theme-toggle muted grid size-7 place-items-center" aria-label={`Switch to ${dark?'light':'dark'} theme`} onClick={toggle}><span aria-hidden="true">{dark?'☼':'◐'}</span></button><button onClick={open} className="add-sky hidden sm:block">+ Add a sky</button><button onClick={open} aria-label="Add a sky" className="add-sky sm:hidden">+</button></nav></header>;
}
