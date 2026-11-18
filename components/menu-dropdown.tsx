'use client';
import {useEffect,useRef,type ReactNode} from 'react';
// For navigation/action menus only. Content accordions and editing forms stay open.
export default function MenuDropdown({children,className,selection}:{children:ReactNode;className?:string;selection?:string|number}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(ref.current)ref.current.open=false;},[selection]);
 useEffect(()=>{
  function outside(event:PointerEvent){const menu=ref.current;if(menu?.open&&event.target instanceof Node&&!menu.contains(event.target))menu.open=false;}
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[]);
 return <details ref={ref} className={className} onClick={event=>{
 const target=event.target;if(!(target instanceof Element))return;
 const action=target.closest('a[href],button');
 if(!action||action.closest('summary')||action.matches(':disabled,[aria-disabled="true"]'))return;
 const menu=ref.current;if(menu){menu.open=false;menu.querySelector('summary')?.focus();}
 }} onKeyDown={event=>{if(event.key==='Escape'&&ref.current?.open){event.preventDefault();event.stopPropagation();ref.current.open=false;ref.current.querySelector('summary')?.focus();}}}>{children}</details>;
}
