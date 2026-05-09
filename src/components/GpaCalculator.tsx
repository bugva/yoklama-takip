import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { t } from '../i18n'

type TermKey = 'Güz' | 'Bahar'
type GpaCourse = { name: string; credit: number; grade: string }
type GpaRecord = { key: string; yearNum: number; term: TermKey; courses: GpaCourse[] }
type Store = {
  prevMode: 'quick' | 'detailed'
  prevSource: 'manual' | 'detailed'
  prevCredits: number; prevPoints: number
  setupYear: number | null; setupTerm: 1 | 2
  prevRecords: GpaRecord[]
  currentCourses: GpaCourse[]
}
type Props = { scheduleCourses: string[] }

const GM: Record<string, number> = { AA:4,BA:3.5,BB:3,CB:2.5,CC:2,DC:1.5,DD:1,FF:0 }
const GO = Object.keys(GM)
const YL = ['1. Sınıf','2. Sınıf','3. Sınıf','4. Sınıf','5. Sınıf']
const KEY = 'gpa-v5'

function cg(courses: GpaCourse[]) {
  let p=0,c=0
  for (const x of courses){const v=GM[x.grade];if(v!==undefined&&x.credit>0){p+=x.credit*v;c+=x.credit}}
  return {gpa:c>0?p/c:null,cr:c,pts:p}
}
function n2l(n:number){if(n>=90)return'AA';if(n>=85)return'BA';if(n>=80)return'BB';if(n>=75)return'CB';if(n>=70)return'CC';if(n>=65)return'DC';if(n>=60)return'DD';return'FF'}
function askN(msg:string,empty=false):number|null|''{const s=window.prompt(msg);if(s===null)return null;if(empty&&!s.trim())return'';const n=Number(s.replace(',','.'));if(isNaN(n)){window.alert('Sayı gir.');return askN(msg,empty)}return n}
const E5=():GpaCourse[]=>Array.from({length:5},()=>({name:'',credit:3,grade:''}))
function genTerms(yr:number,tm:1|2):GpaRecord[]{const out:GpaRecord[]=[];for(let y=1;y<=yr;y++){const mx=y===yr?tm-1:2;for(let t=1;t<=mx;t++)out.push({key:`${y}-${t}`,yearNum:y,term:t===1?'Güz':'Bahar',courses:E5()})}return out}
function load(sc:string[]):Store{try{const r=localStorage.getItem(KEY);if(r){const s:Store=JSON.parse(r);const m=new Map(s.currentCourses.map(c=>[c.name,c]));return{...s,currentCourses:sc.map(n=>m.get(n)??{name:n,credit:3,grade:''})}}}catch{}return{prevMode:'quick',prevSource:'manual',prevCredits:0,prevPoints:0,setupYear:null,setupTerm:1,prevRecords:[],currentCourses:sc.map(n=>({name:n,credit:3,grade:''}))}}
const gc=(v:number|null)=>v===null?'var(--muted)':v>=3.5?'#22d3a0':v>=3?'#4ade80':v>=2.5?'#facc15':v>=2?'#fb923c':'#f87171'
const gl=(v:number|null)=>v===null?'':v>=3.5?'Mükemmel':v>=3?'İyi':v>=2.5?'Orta':v>=2?'Geçer':'Düşük'

function CRow({c,onN,onC,onG,onX,onD}:{c:GpaCourse;onN:(v:string)=>void;onC:(v:number)=>void;onG:(v:string)=>void;onX:()=>void;onD:()=>void}){
  return(
    <tr>
      <td style={{padding:'3px 4px'}}><input className="input" type="text" placeholder="Ders adı" value={c.name} style={{width:'100%',padding:'6px 8px',fontSize:'0.84rem'}} onChange={e=>onN(e.target.value)}/></td>
      <td style={{padding:'3px 4px'}}><input className="input" type="text" inputMode="numeric" value={c.credit===0?'':String(c.credit)} style={{width:52,padding:'6px 6px',textAlign:'center',fontSize:'0.84rem'}} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');onC(v===''?0:Number(v))}}/></td>
      <td style={{padding:'3px 4px'}}><select className="input" value={c.grade} style={{width:68,padding:'5px 6px',fontSize:'0.84rem',height:32}} onChange={e=>onG(e.target.value)}><option value="">—</option>{GO.map(g=><option key={g} value={g}>{g}</option>)}</select></td>
      <td style={{padding:'3px 4px',textAlign:'center'}}><button type="button" title="Hesapla" onClick={onX} style={{background:'var(--surface-sunken)',border:'1px solid var(--border)',borderRadius:7,color:'var(--text)',height:30,width:30,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg></button></td>
      <td style={{padding:'3px 4px',textAlign:'center'}}><button type="button" onClick={onD} style={{background:'transparent',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:'1.2rem',lineHeight:1,padding:2}}>×</button></td>
    </tr>
  )
}

export function GpaCalculator({scheduleCourses}:Props){
  const [store,setStore]=useState<Store>(()=>load(scheduleCourses))
  const [openKey,setOpenKey]=useState<string|null>(null)
  const [editKey,setEditKey]=useState<string|null>(null)
  const [draftPrev,setDraftPrev]=useState<GpaCourse[]>([])
  const [ly,setLy]=useState(1)
  const [lt,setLt]=useState<1|2>(1)
  const [prevOpen,setPrevOpen]=useState(true)

  const [manCrStr, setManCrStr] = useState(() => store.prevCredits ? String(store.prevCredits) : '')
  const [manGpaStr, setManGpaStr] = useState(() => store.prevCredits > 0 ? (store.prevPoints / store.prevCredits).toFixed(2) : '')

  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(store))},[store])
  const upd=(p:Partial<Store>)=>setStore(prev=>({...prev,...p}))

  const cum=useMemo(()=>{
    const cur=cg(store.currentCourses)
    const useDetailed=store.prevSource==='detailed'
    const pg=cg(store.prevRecords.flatMap(r=>r.courses))
    const manCr=store.prevCredits,manPts=store.prevPoints
    const prevCr=useDetailed?pg.cr:manCr
    const prevPts=useDetailed?pg.pts:manPts
    const tc=prevCr+cur.cr
    return{val:tc>0?(prevPts+cur.pts)/tc:null,tc,pg}
  },[store])

  const curG=useMemo(()=>cg(store.currentCourses),[store.currentCourses])

  function examCalc(cb:(l:string)=>void){
    window.alert('Vize/final notlarına göre hesaplama.\nÖrn: Vize %40, Final %60')
    const mid=askN('Vize notu (0-100):');if(mid===null)return
    const mw=askN('Vize yüzdesi (%):');if(mw===null)return
    const fin=askN('Final notu (0-100):');if(fin===null)return
    const fw=askN('Final yüzdesi (%):');if(fw===null)return
    const ex=askN('Ek not (boş=yok):',true)
    let ew=0
    if(ex!==null&&ex!==''){const e2=askN('Ek yüzdesi:');if(e2===null)return;ew=e2 as number}
    const tw=(mw as number)+(fw as number)+ew
    if(tw<=0){window.alert('Toplam yüzde 0 olamaz.');return}
    if(Math.abs(tw-100)>0.001&&!window.confirm(`Toplam: ${tw}%. Devam?`))return
    const avg=((mid as number)*(mw as number)+(fin as number)*(fw as number)+(ex!==''&&ex!==null?(ex as number)*ew:0))/tw
    const l=n2l(avg);window.alert(`${avg.toFixed(2)} → ${l}`);cb(l)
  }

  function setTC(idx:number,f:keyof GpaCourse,v:string|number){upd({currentCourses:store.currentCourses.map((c,i)=>i===idx?{...c,[f]:v}:c)})}
  function addC(){upd({currentCourses:[...store.currentCourses,{name:'',credit:3,grade:''}]})}
  function delC(idx:number){upd({currentCourses:store.currentCourses.filter((_,i)=>i!==idx)})}
  function setDP(idx:number,f:keyof GpaCourse,v:string|number){setDraftPrev(prev=>prev.map((c,i)=>i===idx?{...c,[f]:v}:c))}
  function addDP(){setDraftPrev(prev=>[...prev,{name:'',credit:3,grade:''}])}
  function delDP(idx:number){setDraftPrev(prev=>prev.filter((_,i)=>i!==idx))}
  function startEdit(key:string,courses:GpaCourse[]){setDraftPrev(courses.map(c=>({...c})));setEditKey(key);setOpenKey(key)}
  function openOrEdit(key:string,courses:GpaCourse[]){
    if(openKey===key){setOpenKey(null);setEditKey(null);return}
    setOpenKey(key)
    if(!courses.some(c=>c.grade||c.name)){setDraftPrev(courses.map(c=>({...c})));setEditKey(key)}
    else setEditKey(null)
  }
  function saveTerm(key:string){upd({prevRecords:store.prevRecords.map(r=>r.key===key?{...r,courses:draftPrev}:r)});setEditKey(null)}
  function addNextTerm(){
    const recs=store.prevRecords
    let nextY=1,nextT:TermKey='Güz'
    if(recs.length>0){
      const last=recs[recs.length-1]
      if(last.term==='Güz'){nextY=last.yearNum;nextT='Bahar'}
      else{nextY=last.yearNum+1;nextT='Güz'}
    }
    const key=`${nextY}-${nextT}`
    if(recs.find(r=>r.key===key))return
    const rec:GpaRecord={key,yearNum:nextY,term:nextT,courses:[]}
    upd({prevRecords:[...recs,rec]})
    setDraftPrev([]);setEditKey(key);setOpenKey(key)
  }
  function applySetup(){upd({setupYear:ly,setupTerm:lt,prevRecords:genTerms(ly,lt)})}

  const Logo=()=>(
    <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#6366f1,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 14px rgba(99,102,241,0.35)'}}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 7 12 12 2 7"/><polyline points="22 7 22 13"/><path d="M6 10.5v5a6 6 0 0 0 12 0v-5"/>
      </svg>
    </div>
  )

  const TableHead=()=>(
    <thead><tr style={{color:'var(--muted)'}}>
      <th style={{textAlign:'left',padding:'4px 4px',fontWeight:600}}>Ders</th>
      <th style={{textAlign:'center',padding:'4px 4px',fontWeight:600,width:60}}>Kredi</th>
      <th style={{textAlign:'center',padding:'4px 4px',fontWeight:600,width:74}}>Not</th>
      <th style={{width:34}}/><th style={{width:30}}/>
    </tr></thead>
  )

  const cumC=gc(cum.val)
  const cumLbl=gl(cum.val)

  return(
    <section className="card card-report" style={{paddingBottom:32}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <Logo/><h2 style={{margin:0}}>{t('gpa.title')}</h2>
      </div>

      {/* CGPA card */}
      <div style={{background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.10))',border:'1px solid rgba(99,102,241,0.25)',borderRadius:18,padding:'18px 22px',marginBottom:24,display:'flex',gap:12,alignItems:'center'}}>
        <div style={{flex:1}}><div className="muted small" style={{marginBottom:3}}>Toplam Kredi</div><div style={{fontSize:'1.3rem',fontWeight:800}}>{cum.tc}</div></div>
        <div style={{flex:1,textAlign:'center'}}><div className="muted small" style={{marginBottom:3}}>Bu Dönem</div><div style={{fontSize:'1.3rem',fontWeight:800,color:gc(curG.gpa)}}>{curG.gpa!=null?curG.gpa.toFixed(2):'—'}</div></div>
        <div style={{flex:1,textAlign:'right'}}>
          <div className="muted small" style={{marginBottom:3}}>Kümülatif GPA</div>
          <motion.div key={cum.val} initial={{scale:0.85,opacity:0}} animate={{scale:1,opacity:1}} style={{fontSize:'2.4rem',fontWeight:900,color:cumC,lineHeight:1}}>{cum.val!=null?cum.val.toFixed(2):'—'}</motion.div>
          {cumLbl&&<div style={{fontSize:'0.72rem',fontWeight:700,color:cumC,marginTop:2}}>{cumLbl}</div>}
        </div>
      </div>

      {/* ── ÖNCEKİ DÖNEMLER ── */}
      <div style={{marginBottom:22}}>
        <motion.button type="button" whileTap={{scale:0.998}}
          onClick={()=>setPrevOpen(p=>!p)}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:prevOpen?14:0,background:'transparent',border:'none',cursor:'pointer',color:'var(--text)',padding:0}}>
          <span style={{fontWeight:700,fontSize:'0.95rem'}}>Önceki Dönemler</span>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {prevOpen&&(
              <div style={{display:'flex',background:'var(--surface-sunken)',borderRadius:10,padding:3,gap:2}}>
                {(['quick','detailed'] as const).map(m=>(
                  <motion.button key={m} type="button" whileTap={{scale:0.95}}
                    onClick={e=>{e.stopPropagation();upd({prevMode:m})}}
                    style={{padding:'5px 14px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:'0.78rem',background:store.prevMode===m?'var(--primary)':'transparent',color:store.prevMode===m?'#fff':'var(--muted)',transition:'all 0.15s'}}>
                    {m==='quick'?'Hızlı':'Dönem Dönem'}
                  </motion.button>
                ))}
              </div>
            )}
            <motion.svg animate={{rotate:prevOpen?0:-90}} transition={{duration:0.2}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{opacity:0.4}}>
              <polyline points="6 9 12 15 18 9"/>
            </motion.svg>
          </div>
        </motion.button>

        <AnimatePresence initial={false}>
          {prevOpen&&(
            <motion.div key="prev" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2,ease:'easeInOut'}} style={{overflow:'hidden'}}>
              <AnimatePresence mode="wait">
                {store.prevMode==='quick'&&(
                  <motion.div key="q" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.15}}>
                    {(()=>{
                      const pg=cg(store.prevRecords.flatMap(r=>r.courses))
                      const manGpa=store.prevCredits>0?store.prevPoints/store.prevCredits:null
                      const StatBox=({label,val,col}:{label:string,val:React.ReactNode,col?:string})=>(
                        <div style={{flex:1,padding:'12px 14px',background:'rgba(0,0,0,0.18)',borderRadius:10,border:'1px solid rgba(255,255,255,0.06)'}}>
                          <div className="muted small" style={{marginBottom:3}}>{label}</div>
                          <div style={{fontSize:'1.7rem',fontWeight:900,lineHeight:1,color:col||'var(--text)'}}>{val}</div>
                        </div>
                      )
                      return(
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          {/* Manuel card */}
                          <div style={{borderRadius:12,border:`2px solid ${store.prevSource==='manual'?'var(--primary)':'var(--border)'}`,background:store.prevSource==='manual'?'rgba(99,102,241,0.08)':'var(--surface-sunken)',transition:'all 0.15s',overflow:'hidden'}}>
                            <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}} onClick={()=>upd({prevSource:'manual'})}>
                              <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${store.prevSource==='manual'?'var(--primary)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                {store.prevSource==='manual'&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--primary)'}}/>}
                              </div>
                              <span style={{fontWeight:700,fontSize:'0.88rem',flex:1}}>Manuel Giriş</span>
                              {store.prevSource==='manual'&&<span style={{fontSize:'0.7rem',fontWeight:800,background:'var(--primary)',color:'#fff',borderRadius:6,padding:'2px 8px'}}>AKTİF</span>}
                            </div>
                            <div style={{padding:'0 12px 14px',display:'flex',gap:8}}>
                              {[
                                {label:'Toplam Kredi',val:manCrStr,placeholder:'0',inputMode:'numeric' as const,onChange:(v:string)=>{setManCrStr(v); const cr=Number(v)||0;upd({prevCredits:cr})},color:'var(--text)'},
                                {
                                  label:'CGPA',
                                  val:manGpaStr,
                                  placeholder:'0.00',
                                  inputMode:'decimal' as const,
                                  onChange:(v:string)=>{
                                    let digits = v.replace(/[^0-9]/g, '');
                                    if (digits.length > 0) {
                                      const first = Number(digits[0]);
                                      if (first > 4) {
                                        digits = '400';
                                      } else if (first === 4 && digits.length > 1) {
                                        // 4'ten sonra sadece 0 gelebilir
                                        digits = '4' + '00'.slice(0, Math.min(digits.length - 1, 2));
                                      }
                                    }
                                    if (digits.length > 3) digits = digits.slice(0, 3);
                                    
                                    let formatted = '';
                                    if (digits.length === 0) formatted = '';
                                    else if (digits.length === 1) formatted = digits;
                                    else formatted = digits[0] + '.' + digits.slice(1);
                                    
                                    setManGpaStr(formatted);
                                    const g = parseFloat(formatted);
                                    if (!isNaN(g)) upd({prevPoints: store.prevCredits * g});
                                    else upd({prevPoints: 0});
                                  },
                                  color:gc(manGpa)
                                },
                              ].map(f=>(
                                <label key={f.label} style={{flex:1,padding:'12px 14px',background:'rgba(0,0,0,0.18)',borderRadius:10,border:'1.5px dashed rgba(99,102,241,0.35)',cursor:'text',display:'flex',flexDirection:'column',gap:4,position:'relative'}}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                                    <span className="muted small">{f.label}</span>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{opacity:0.35,flexShrink:0}}>
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </div>
                                  <input type="text" inputMode={f.inputMode} placeholder={f.placeholder}
                                    value={f.val}
                                    onChange={e=>f.onChange(e.target.value)}
                                    onFocus={e=>e.target.select()}
                                    style={{background:'transparent',border:'none',outline:'none',fontSize:'1.7rem',fontWeight:900,lineHeight:1,color:f.color,width:'100%',padding:0,cursor:'text'}}/>
                                </label>
                              ))}
                            </div>
                          </div>
                          {/* Dönem Dönem card */}
                          <div style={{borderRadius:12,border:`2px solid ${store.prevSource==='detailed'?'var(--primary)':'var(--border)'}`,background:store.prevSource==='detailed'?'rgba(99,102,241,0.08)':'var(--surface-sunken)',transition:'all 0.15s',overflow:'hidden',cursor:'pointer'}} onClick={()=>upd({prevSource:'detailed'})}>
                            <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px'}}>
                              <div style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${store.prevSource==='detailed'?'var(--primary)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                {store.prevSource==='detailed'&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--primary)'}}/>}
                              </div>
                              <span style={{fontWeight:700,fontSize:'0.88rem',flex:1}}>Dönem Dönem'e Göre</span>
                              {store.prevSource==='detailed'&&<span style={{fontSize:'0.7rem',fontWeight:800,background:'var(--primary)',color:'#fff',borderRadius:6,padding:'2px 8px'}}>AKTİF</span>}
                            </div>
                            <div style={{padding:'0 12px 14px',display:'flex',gap:8}}>
                              <StatBox label="Toplam Kredi" val={pg.cr||<span style={{color:'var(--muted)'}}>—</span>}/>
                              <StatBox label="CGPA" val={pg.gpa!=null?pg.gpa.toFixed(2):<span style={{color:'var(--muted)'}}>—</span>} col={gc(pg.gpa)}/>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </motion.div>
                )}
                                {store.prevMode==='detailed'&&(
                  <motion.div key="d" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.15}}>
                    {store.setupYear===null?(
                      <div style={{padding:20,background:'var(--surface-sunken)',borderRadius:14,border:'1px solid var(--border)'}}>
                        <p style={{fontWeight:800,marginBottom:16,fontSize:'1.1rem'}}>Şu an kaçıncı sınıfsın?</p>
                        <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:16}}>
                          <label style={{display:'flex',flexDirection:'column',gap:7,flex:1,minWidth:130}}>
                            <span style={{fontSize:'0.75rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--muted)'}}>Sınıf</span>
                            <div style={{position:'relative'}}>
                              <select value={ly} onChange={e=>setLy(Number(e.target.value))} style={{width:'100%',appearance:'none',WebkitAppearance:'none',padding:'11px 36px 11px 14px',borderRadius:12,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:'0.95rem',fontWeight:700,cursor:'pointer',outline:'none'}} onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'}>
                                {YL.map((l,i)=><option key={i} value={i+1}>{l}</option>)}
                              </select>
                              <svg style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',opacity:0.5}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                          </label>
                          <label style={{display:'flex',flexDirection:'column',gap:7,flex:1,minWidth:150}}>
                            <span style={{fontSize:'0.75rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--muted)'}}>Dönem</span>
                            <div style={{position:'relative'}}>
                              <select value={lt} onChange={e=>setLt(Number(e.target.value) as 1|2)} style={{width:'100%',appearance:'none',WebkitAppearance:'none',padding:'11px 36px 11px 14px',borderRadius:12,border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--text)',fontSize:'0.95rem',fontWeight:700,cursor:'pointer',outline:'none'}} onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'}>
                                <option value={1}>1. Dönem — Güz</option>
                                <option value={2}>2. Dönem — Bahar</option>
                              </select>
                              <svg style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',opacity:0.5}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                          </label>
                        </div>
                        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} type="button" className="btn primary" onClick={applySetup}>Dönemleri Oluştur</motion.button>
                        <p className="muted small" style={{marginTop:10}}>Aktif döneme kadar geçmiş dönemler otomatik oluşturulur, her birine 5 boş ders gelir.</p>
                      </div>
                    ):(
                      <div>
                        {store.prevRecords.length===0&&<p className="muted small" style={{textAlign:'center',padding:'12px 0'}}>Geçmiş dönem yok.</p>}
                        {store.prevRecords.map(rec=>{
                          const rg=cg(rec.courses)
                          const isOpen=openKey===rec.key
                          const isEditing=editKey===rec.key
                          const displayCourses=isEditing?draftPrev:rec.courses
                          return(
                            <motion.div key={rec.key} layout style={{background:'var(--surface)',border:`1px solid ${isOpen?gc(rg.gpa)||'var(--primary)':'var(--border)'}`,borderRadius:12,overflow:'hidden',transition:'border-color 0.2s',marginBottom:8}}>
                              <motion.button type="button" whileTap={{scale:0.998}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:'transparent',border:'none',color:'var(--text)',textAlign:'left'}} onClick={()=>openOrEdit(rec.key,rec.courses)}>
                                <div style={{flex:1}}>
                                  <span style={{fontWeight:700,fontSize:'0.9rem'}}>{YL[rec.yearNum-1]} — {rec.term==='Güz'?'1. Dönem (Güz)':'2. Dönem (Bahar)'}</span>
                                  <span className="muted small" style={{marginLeft:8}}>{rec.courses.filter(c=>c.name).length} ders · {rg.cr} kr</span>
                                </div>
                                <span style={{fontWeight:800,color:gc(rg.gpa),minWidth:44,textAlign:'right'}}>{rg.gpa!=null?rg.gpa.toFixed(2):'—'}</span>
                                {!isEditing&&<motion.svg animate={{rotate:isOpen?180:0}} transition={{duration:0.2}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{opacity:0.4,flexShrink:0}}><polyline points="6 9 12 15 18 9"/></motion.svg>}
                              </motion.button>
                              <AnimatePresence initial={false}>
                                {isOpen&&(
                                  <motion.div key="b" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2,ease:'easeInOut'}} style={{overflow:'hidden'}}>
                                    <div style={{padding:'0 14px 14px'}}>
                                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem',marginBottom:8}}><TableHead/><tbody>
                                        {displayCourses.map((c,idx)=>isEditing
                                          ?<CRow key={idx} c={c} onN={v=>setDP(idx,'name',v)} onC={v=>setDP(idx,'credit',v)} onG={v=>setDP(idx,'grade',v)} onX={()=>examCalc(l=>setDP(idx,'grade',l))} onD={()=>delDP(idx)}/>
                                          :<tr key={idx}><td style={{padding:'3px 8px',fontSize:'0.84rem'}}>{c.name||<span className="muted">—</span>}</td><td style={{padding:'3px 8px',textAlign:'center',fontSize:'0.84rem'}}>{c.credit}</td><td style={{padding:'3px 8px',textAlign:'center',fontSize:'0.84rem',fontWeight:700,color:c.grade?gc(GM[c.grade]??null):'var(--muted)'}}>{c.grade||'—'}</td><td/><td/></tr>
                                        )}
                                      </tbody></table>
                                      {isEditing?(
                                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                          <motion.button whileTap={{scale:0.97}} type="button" className="btn secondary small" onClick={addDP}>+ Ders Ekle</motion.button>
                                          <motion.button whileTap={{scale:0.97}} type="button" className="btn primary small" onClick={()=>saveTerm(rec.key)}>Kaydet</motion.button>
                                          <motion.button whileTap={{scale:0.97}} type="button" className="btn small" style={{color:'var(--muted)'}} onClick={()=>{setEditKey(null)}}>İptal</motion.button>
                                        </div>
                                      ):(
                                        <motion.button whileTap={{scale:0.97}} type="button" className="btn secondary small" onClick={()=>startEdit(rec.key,rec.courses)}>Düzenle</motion.button>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )
                        })}
                        <motion.button whileTap={{scale:0.97}} type="button" className="btn secondary small" style={{marginTop:6}} onClick={addNextTerm}>+ Dönem Ekle</motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BU DÖNEM ── */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontWeight:700,fontSize:'0.95rem'}}>Bu Dönem</span>
            <span style={{fontSize:'0.7rem',fontWeight:800,background:'linear-gradient(90deg,#6366f1,#a855f7)',color:'#fff',borderRadius:8,padding:'2px 9px',letterSpacing:'0.04em'}}>AKTİF</span>
          </div>
          {curG.gpa!=null&&<span style={{fontWeight:700,color:gc(curG.gpa),fontSize:'0.9rem'}}>{curG.gpa.toFixed(2)} · {curG.cr} kr</span>}
        </div>
        <div style={{background:'var(--surface)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:14}}>
          <div style={{padding:'12px 14px 14px'}}>
            {store.currentCourses.length>0?(
              <>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.85rem',marginBottom:10}}>
                  <TableHead/>
                  <tbody>
                    {store.currentCourses.map((c,idx)=>
                      <CRow key={idx} c={c} onN={v=>setTC(idx,'name',v)} onC={v=>setTC(idx,'credit',v)} onG={v=>setTC(idx,'grade',v)} onX={()=>examCalc(l=>setTC(idx,'grade',l))} onD={()=>delC(idx)}/>
                    )}
                  </tbody>
                </table>
                <motion.button whileTap={{scale:0.97}} type="button" className="btn secondary small" onClick={addC}>+ Ders Ekle</motion.button>
              </>
            ):<p className="muted small" style={{textAlign:'center',padding:'14px 0'}}>Henüz ders eklenmedi.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
