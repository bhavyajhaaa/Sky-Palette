'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {useAddSky} from './AddSkyModal';

export function Header(){
 const path=usePathname(),{open}=useAddSky(),[dark,setDark]=useState(false),themeButton=useRef<HTMLButtonElement>(null),themeSurface=useRef<HTMLDivElement|null>(null),themeTimer=useRef(0),fluid=path==='/'||path==='/fluid';
 useEffect(()=>{setDark(document.documentElement.classList.contains('dark'));return()=>{themeSurface.current?.remove();clearTimeout(themeTimer.current)}},[]);
 const applyTheme=(value:boolean)=>{flushSync(()=>setDark(value));document.documentElement.classList.toggle('dark',value);localStorage.setItem('sky-theme',value?'dark':'light')};
 const toggle=()=>{
  const value=!dark,rect=themeButton.current?.getBoundingClientRect(),x=rect?rect.left+rect.width/2:innerWidth/2,y=rect?rect.top+rect.height/2:32;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){applyTheme(value);return}
  themeSurface.current?.remove();
  const surface=document.createElement('div'),radius=Math.max(Math.hypot(x,y),Math.hypot(innerWidth-x,y),Math.hypot(x,innerHeight-y),Math.hypot(innerWidth-x,innerHeight-y));
  surface.className='theme-transition-surface';surface.style.left=`${x}px`;surface.style.top=`${y}px`;surface.style.width=`${radius*2.18}px`;surface.style.height=`${radius*2.18}px`;surface.style.background=value?'#0c0d0e':'#f7f6f2';document.body.appendChild(surface);themeSurface.current=surface;
  surface.getBoundingClientRect();surface.classList.add('is-expanding');
  const finish=()=>{if(themeSurface.current!==surface)return;clearTimeout(themeTimer.current);document.documentElement.dataset.themeHandoff='active';applyTheme(value);getComputedStyle(document.body).backgroundColor;delete document.documentElement.dataset.themeHandoff;surface.remove();themeSurface.current=null};
  surface.addEventListener('transitionend',finish,{once:true});themeTimer.current=window.setTimeout(finish,450);
 };
 return <header className="h-16 px-5 md:px-8 flex items-center justify-between border-b line relative z-20 bg-[var(--bg)]"><Link href="/" className="site-mark text-[13px] font-semibold tracking-[.14em]">SKY COLORS</Link><nav className="flex items-center gap-4 md:gap-7 text-xs"><Link className={fluid?'':'muted'} href="/">Fluid</Link><Link className={path==='/palette'?'':'muted'} href="/palette">Palette</Link><Link className={(path==='/archive'||path.startsWith('/sky/'))?'':'muted'} href="/archive">Archive</Link><button ref={themeButton} className="theme-toggle muted grid size-7 place-items-center" aria-label={`Switch to ${dark?'light':'dark'} theme`} onClick={toggle}><span aria-hidden="true">{dark?'☼':'◐'}</span></button><button onClick={open} className="add-sky hidden sm:block">+ Add a sky</button><button onClick={open} aria-label="Add a sky" className="add-sky sm:hidden">+</button></nav></header>;
}
