import './globals.css';import { Header } from '@/components/Header';import { ModalProvider } from '@/components/AddSkyModal';
export const metadata={title:'Sky Colors — A living color archive',description:'A growing visual archive of skies and their colors.'};
const themeScript=`try{let t=localStorage.getItem('sky-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><ModalProvider><Header/>{children}</ModalProvider></body></html>}
