'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {processImage,type ProcessedImage} from '@/lib/images';

const C=createContext({open:()=>{}});
export const useAddSky=()=>useContext(C);

export function ModalProvider({children}:{children:React.ReactNode}){
 const [shown,setShown]=useState(false);
 return <C.Provider value={{open:()=>setShown(true)}}>{children}{shown&&<AddSkyModal close={()=>setShown(false)}/>}</C.Provider>;
}

function AddSkyModal({close}:{close:()=>void}){
 const [image,setImage]=useState<ProcessedImage|null>(null),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[message,setMessage]=useState('');
 const dialog=useRef<HTMLDivElement>(null);
 const take=useCallback(async(file?:File)=>{if(!file?.type.startsWith('image/'))return;setBusy(true);setMessage('');try{setImage(await processImage(file))}catch{setMessage('That image could not be processed.')}finally{setBusy(false)}},[]);
 useEffect(()=>{dialog.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='v')return};const paste=(e:ClipboardEvent)=>take([...e.clipboardData!.files][0]);addEventListener('keydown',key);addEventListener('paste',paste);return()=>{removeEventListener('keydown',key);removeEventListener('paste',paste)}},[close,take]);
 async function submit(){if(!image)return;setBusy(true);setMessage('');const form=new FormData();form.set('password',password);form.set('image',image.blob,'sky.webp');form.set('width',String(image.width));form.set('height',String(image.height));form.set('colors',JSON.stringify(image.colors));const r=await fetch('/api/upload',{method:'POST',body:form});const body=await r.json();setBusy(false);if(r.ok){setMessage('Added to the archive.');setTimeout(()=>location.reload(),700)}else setMessage(body.error||'Upload failed.');}
 return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={e=>e.target===e.currentTarget&&close()}>
  <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="add-title" className="w-full max-w-[720px] max-h-[92vh] overflow-auto bg-[var(--bg)] p-6 md:p-10 outline-none">
   <div className="flex justify-between"><h2 id="add-title" className="text-xl">Add a sky</h2><button onClick={close} aria-label="Close" className="self-start text-lg">×</button></div>
   {!image?<label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();take(e.dataTransfer.files[0])}} className="mt-10 min-h-64 border line flex flex-col justify-center items-center text-center cursor-pointer"><span className="text-sm">{busy?'Processing image…':'Paste an image here'}</span><span className="mt-2 text-xs muted">Cmd + V to paste · or drag an image</span><input className="sr-only" type="file" accept="image/*" onChange={e=>take(e.target.files?.[0])}/></label>:
   <div className="mt-9 grid md:grid-cols-[1.15fr_.85fr] gap-8"><div><img src={image.url} alt="Sky upload preview" className="theme-stable-image w-full max-h-80 object-contain bg-black/5"/><p className="mt-3 text-[11px] muted">{image.originalWidth}×{image.originalHeight} → {image.width}×{image.height} · {Math.round(image.blob.size/1024)} KB WebP</p></div><div><div className="flex justify-between items-baseline"><h3 className="text-sm">Extracted colors</h3><button className="text-[11px] muted" onClick={()=>setImage(null)}>Restore</button></div><p className="mt-1 text-[11px] muted">Select a color to remove it.</p><div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4">{image.colors.map(c=><button key={c} onClick={()=>setImage({...image,colors:image.colors.filter(x=>x!==c)})}><span className="block aspect-square" style={{background:c}}/><span className="block mt-1 text-[9px] muted">{c}</span></button>)}</div><label className="block mt-7 text-xs">Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" className="block w-full mt-2 bg-transparent border-b line py-2 outline-none"/></label><button disabled={busy||!password||!image.colors.length} onClick={submit} className="mt-6 w-full bg-[var(--ink)] text-[var(--bg)] py-3 text-xs disabled:opacity-40">{busy?'Adding…':'Add to archive'}</button>{message&&<p className="mt-3 text-xs">{message}</p>}</div></div>}
  </div>
 </div>;
}
