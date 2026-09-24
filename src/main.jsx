import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import'./styles.css';

const LS_KEY='research-library';
const MERGE_KEY='research-library-tag-merges';

const seed=[
  {id:1,title:'The Extended Mind',authors:'Clark, A. & Chalmers, D.',year:1998,venue:'Analysis',tags:['具身认知','经典'],abstract:'本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',status:'阅读中',cite:'Clark, A. & Chalmers, D. (1998). The Extended Mind. Analysis.'},
  {id:2,title:'Situated Learning',authors:'Lave, J. & Wenger, E.',year:1991,venue:'Cambridge University Press',tags:['学习科学','社会'],abstract:'学习发生在真实情境的参与过程中，知识与共同体实践不可分割。',status:'待读',cite:'Lave, J. & Wenger, E. (1991). Situated Learning.'},
  {id:3,title:'Designing with Data',authors:'Miller, S.',year:2022,venue:'MIT Press',tags:['设计研究','方法'],abstract:'一套面向设计师的数据研究方法，讨论如何把定性洞察转化为可行动的设计决策。',status:'已读',cite:'Miller, S. (2022). Designing with Data.'},
  {id:4,title:'Social Learning Theory',authors:'Bandura, A.',year:1977,venue:'Prentice-Hall',tags:['社会学习','心理学'],abstract:'社会学习理论强调观察与模仿在行为习得中的作用，多数学习发生在社会情境之中。',status:'已读',cite:'Bandura, A. (1977). Social Learning Theory. Prentice-Hall.'},
  {id:5,title:'社会化学习：网络时代的知识共创',authors:'王晓明',year:2018,venue:'教育研究',tags:['社会化学习','教育'],abstract:'探讨学习者借助社交网络与共同体进行知识共创的社会化学习路径。',status:'阅读中',cite:'王晓明 (2018). 社会化学习：网络时代的知识共创. 教育研究.'},
  {id:6,title:'Communities of Practice',authors:'Wenger, E.',year:1998,venue:'Cambridge University Press',tags:['社会','社会学习','学习科学'],abstract:'实践共同体通过合法的边缘性参与维系知识传承，是社会学习的核心组织形态。',status:'待读',cite:'Wenger, E. (1998). Communities of Practice. Cambridge University Press.'}
];

const readItems=()=>{try{return JSON.parse(localStorage.getItem(LS_KEY))||seed}catch{return seed}};
const readMerges=()=>{try{return JSON.parse(localStorage.getItem(MERGE_KEY))||[]}catch{return[]}};
const fmtTime=t=>new Date(t).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

function App(){
  const[items,setItems]=useState(readItems);
  const[merges,setMerges]=useState(readMerges);
  const[view,setView]=useState('library');
  const[selected,setSelected]=useState(1);
  const[query,setQuery]=useState('');
  const[tag,setTag]=useState('全部');
  const[show,setShow]=useState(false);
  const[notice,setNotice]=useState('');
  const[form,setForm]=useState({title:'',authors:'',year:'2024',venue:'',abstract:'',tags:''});
  // 标签治理页状态
  const[primaryInput,setPrimaryInput]=useState('');
  const[pickedAliases,setPickedAliases]=useState([]);
  const[undoResult,setUndoResult]=useState(null);

  useEffect(()=>localStorage.setItem(LS_KEY,JSON.stringify(items)),[items]);
  useEffect(()=>localStorage.setItem(MERGE_KEY,JSON.stringify(merges)),[merges]);

  const counts={};
  items.forEach(x=>x.tags.forEach(t=>{counts[t]=(counts[t]||0)+1}));
  const allTags=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b,'zh'));
  const tags=['全部',...allTags];

  // 搜索范围：标题/作者/摘要 + 当前标签 + 已并入主标签的旧标签（仅限仍处于合并状态的记录）
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const byId=new Map(items.map(x=>[x.id,x]));
    const aliasTokens=new Map();
    for(const m of merges){
      for(const a of m.affected){
        const it=byId.get(a.id);
        // 仅当记录仍处于合并状态（当前含主标签）时，挂它原本实际带过的旧标签名
        if(it&&it.tags.includes(m.primary))
          aliasTokens.set(a.id,(aliasTokens.get(a.id)||'')+' '+(a.lost||m.aliases).join(' '));
      }
    }
    return items.filter(x=>(tag==='全部'||x.tags.includes(tag))&&
      (!q||`${x.title}${x.authors}${x.abstract} ${x.tags.join(' ')} ${aliasTokens.get(x.id)||''}`.toLowerCase().includes(q)));
  },[items,tag,query,merges]);

  const cur=items.find(x=>x.id===selected)||items[0];
  const update=(k,v)=>setItems(items.map(x=>x.id===cur.id?{...x,[k]:v}:x));
  const add=()=>{
    if(!form.title)return;
    const p={...form,id:Date.now(),year:+form.year,tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),status:'待读',cite:`${form.authors} (${form.year}). ${form.title}. ${form.venue}.`};
    setItems([...items,p]);setSelected(p.id);
    setForm({title:'',authors:'',year:'2024',venue:'',abstract:'',tags:''});
    setShow(false);setNotice('文献已加入研究库');
  };
  const bib=()=>{navigator.clipboard?.writeText(cur.cite);setNotice('引用文本已复制')};
  const download=()=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([items.map(x=>x.cite).join('\n')],{type:'text/plain'}));
    a.download='references.txt';a.click();setNotice('引用列表已导出');
  };

  // —— 标签合并 ——
  const primary=primaryInput.trim();
  const aliases=pickedAliases.filter(t=>t!==primary);
  const aliasKey=aliases.join('|');
  const plan=useMemo(()=>{
    if(!primary||!aliases.length)return[];
    const set=new Set(aliases);
    const out=[];
    for(const it of items){
      if(!it.tags.some(t=>set.has(t)))continue;
      const after=it.tags.filter(t=>!set.has(t));
      if(!after.includes(primary))after.push(primary);
      out.push({id:it.id,item:it,before:it.tags,after});
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[items,primary,aliasKey]);

  const toggleAlias=t=>setPickedAliases(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]);

  const commitMerge=()=>{
    if(!primary||!plan.length)return;
    // 先在内存里构造记录，确认按钮点击后才真正写库
    const record={
      id:Date.now(),time:Date.now(),primary,aliases:[...aliases],
      affected:plan.map(r=>({id:r.id,title:r.item.title,beforeTags:r.before,afterTags:r.after,lost:r.before.filter(t=>aliases.includes(t))})),
      // 合并后每条记录的完整快照，撤销时用来判断这期间有没有人改过
      snapshots:Object.fromEntries(plan.map(r=>[r.id,JSON.stringify({...r.item,tags:r.after})]))
    };
    setItems(items.map(it=>{
      const r=plan.find(z=>z.id===it.id);
      return r?{...it,tags:r.after}:it;
    }));
    setMerges([record,...merges]);
    if(tag!=='全部'&&aliases.includes(tag))setTag('全部');
    setPrimaryInput('');setPickedAliases([]);setUndoResult(null);
    setNotice(`已合并为 #${primary}，共修改 ${record.affected.length} 篇文献`);
  };

  // —— 撤销合并：只恢复合并后未再被改动的记录 ——
  const undoMerge=rec=>{
    const blocked=[];const blockedIds=new Set();const restored=[];
    let next=items;
    for(const a of rec.affected){
      const curItem=items.find(x=>x.id===a.id);
      if(!curItem){blocked.push({title:a.title,reason:'已删除'});blockedIds.add(a.id);continue;}
      if(JSON.stringify(curItem)!==rec.snapshots[a.id]){
        blocked.push({title:curItem.title,reason:'合并后被修改'});blockedIds.add(a.id);continue;
      }
      next=next.map(x=>x.id===a.id?{...x,tags:a.beforeTags}:x);
      restored.push(curItem.title);
    }
    setItems(next);
    const remaining=rec.affected.filter(a=>blockedIds.has(a.id));
    // 全部恢复 → 删掉该治理记录；仍有改不动的 → 别名映射只对这些记录保留
    setMerges(remaining.length
      ?merges.map(m=>m.id===rec.id?{...m,affected:remaining}:m)
      :merges.filter(m=>m.id!==rec.id));
    setUndoResult({primary:rec.primary,restored,blocked});
  };

  return <div className="app">
    <aside>
      <div className="logo"><span>∴</span> LITERATURE</div>
      <div className="library-head"><span>我的研究库</span><strong>{items.length}<small> 篇文献</small></strong></div>
      <nav>
        <button className={view==='library'?'active':''} onClick={()=>setView('library')}>▤ <span>所有文献</span><b>{items.length}</b></button>
        <button>▥ <span>待读</span><b>{items.filter(x=>x.status==='待读').length}</b></button>
        <button>✓ <span>已读</span></button>
        <button>☆ <span>收藏</span></button>
      </nav>
      <div className="side-governance">
        <button className={view==='governance'?'active':''} onClick={()=>setView('governance')}>⇄ <span>标签治理</span></button>
      </div>
      <div className="side-tags"><small>标签</small>{tags.slice(1,5).map(t=><button onClick={()=>{setTag(t);setView('library')}} key={t}># {t}</button>)}</div>
      <div className="side-foot"><button>⚙ 偏好设置</button><small>本地数据库 · 已同步</small></div>
    </aside>
    <main>
      {view==='governance'?(
        <>
          <header>
            <div><span className="crumb">TAG / GOVERNANCE</span><h1>标签治理</h1></div>
            <div className="actions"><button className="outline" onClick={()=>setView('library')}>← 返回文献库</button></div>
          </header>
          <div className="governance">
            <p className="gov-intro">把含义相同的自由标签合并成一个主标签。合并前会先列出所有受影响的文献，确认后才改库；旧标签名仍可被搜索到。</p>

            <div className="gov-card">
              <div className="gov-card-head"><h3>合并标签</h3><span>MERGE TAGS</span></div>
              <label className="gov-label">主标签（合并后统一使用，可输入新名称）
                <input list="all-tag-options" value={primaryInput} onChange={e=>setPrimaryInput(e.target.value)} placeholder="选择或输入主标签，如：社会化学习"/>
              </label>
              <datalist id="all-tag-options">{allTags.map(t=><option value={t} key={t}/>)}</datalist>
              <div className="tag-chip-row">{allTags.map(t=>
                <button type="button" className={'pick'+(primary===t?' on':'')} onClick={()=>setPrimaryInput(t)} key={t}>#{t}</button>)}
              </div>

              <div className="gov-label">别名（勾选后将并入主标签）</div>
              <div className="alias-grid">
                {allTags.filter(t=>t!==primary).map(t=>
                  <label className="alias-opt" key={t}>
                    <input type="checkbox" checked={aliases.includes(t)} disabled={!primary} onChange={()=>toggleAlias(t)}/>
                    <span># {t}</span><small>{counts[t]} 篇</small>
                  </label>)}
                {!allTags.length&&<div className="no-result">文献库还没有任何标签</div>}
              </div>

              {plan.length>0&&<div className="plan">
                <div className="plan-head">将影响 <b>{plan.length}</b> 篇文献 —— 确认前不会修改文献库</div>
                <div className="plan-list">
                  {plan.map(r=><div className="plan-item" key={r.id}>
                    <div className="plan-meta"><span className="paper-year">{r.item.year}</span><strong>{r.item.title}</strong></div>
                    <div className="tagdiff">
                      {r.before.map(t=><span key={t} className={aliases.includes(t)?'tag-old':'tag-keep'}>#{t}</span>)}
                      <span className="arrow">→</span>
                      {r.after.map(t=><span key={t} className={t===primary?'tag-new':'tag-keep'}>#{t}</span>)}
                    </div>
                  </div>)}
                </div>
                <button className="primary full" onClick={commitMerge}>确认合并，修改以上 {plan.length} 篇文献</button>
              </div>}
              {!!primary&&aliases.length>0&&plan.length===0&&<div className="plan-empty">当前没有文献使用这些别名</div>}
            </div>

            {undoResult&&<div className={'result-panel '+(undoResult.blocked.length?'warn':'ok')}>
              <div className="rp-head">
                <h4>已撤销合并：#{undoResult.primary}</h4>
                <button className="rp-close" onClick={()=>setUndoResult(null)}>×</button>
              </div>
              <div>{undoResult.restored.length
                ?`已恢复 ${undoResult.restored.length} 篇未改动记录的旧标签。`
                :'没有可自动恢复的记录。'}</div>
              {undoResult.blocked.length>0&&<>
                <div>以下 {undoResult.blocked.length} 篇在合并后被改动，无法恢复：</div>
                <ul>{undoResult.blocked.map((b,i)=>
                  <li key={i}>{b.title}<span className="reason-tag">{b.reason}</span></li>)}</ul>
              </>}
            </div>}

            <div className="gov-card">
              <div className="gov-card-head"><h3>治理记录</h3><span>HISTORY</span></div>
              {merges.length===0
                ?<div className="no-result">还没有合并记录</div>
                :merges.map(m=><div className="merge-row" key={m.id}>
                    <div><strong>#{m.primary}</strong><span className="muted">并入了 {m.aliases.map(a=>'#'+a).join('、')}</span></div>
                    <div className="merge-meta">
                      <small>{fmtTime(m.time)} · {m.affected.length} 篇</small>
                      <button className="outline undo-btn" onClick={()=>undoMerge(m)}>撤销合并</button>
                    </div>
                  </div>)}
            </div>
          </div>
        </>
      ):(
        <>
          <header>
            <div><span className="crumb">RESEARCH / LIBRARY</span><h1>所有文献</h1></div>
            <div className="actions">
              <button className="outline" onClick={download}>↓ 导出引用</button>
              <button className="primary" onClick={()=>setShow(true)}>＋ 添加文献</button>
            </div>
          </header>
          <div className="toolbar">
            <div className="search">⌕<input placeholder="搜索标题、作者、摘要或标签（含已合并的旧标签）…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')}>×</button>}</div>
            <div className="tag-filter">{tags.map(t=><button className={tag===t?'on':''} onClick={()=>setTag(t)} key={t}>{t}</button>)}</div>
          </div>
          <div className="body">
            <section className="paper-list">
              {filtered.map(p=><button className={'paper '+(selected===p.id?'selected':'')} onClick={()=>setSelected(p.id)} key={p.id}>
                <div className="paper-year">{p.year}</div>
                <div className="paper-copy"><h3>{p.title}</h3><p>{p.authors}</p>
                  <div>{p.tags.map(t=><span key={t}>#{t}</span>)}</div></div>
                <small className={'status '+p.status}>{p.status}</small>
              </button>)}
              {!filtered.length&&<div className="no-result">没有找到匹配的文献</div>}
            </section>
            <section className="detail">{cur&&<>
              <div className="detail-top"><span className="status reading">{cur.status}</span><button onClick={()=>setNotice('已加入收藏')}>☆ 收藏</button></div>
              <h2>{cur.title}</h2><p className="authors">{cur.authors}</p>
              <div className="cite-actions">
                <button onClick={bib}>▣ 复制引用</button>
                <button onClick={()=>update('status',cur.status==='已读'?'待读':'已读')}>{cur.status==='已读'?'标记为待读':'标记为已读'}</button>
              </div>
              <div className="detail-section"><h4>摘要 <span>ABSTRACT</span></h4><p>{cur.abstract}</p></div>
              <div className="detail-section"><h4>出版信息 <span>PUBLICATION</span></h4>
                <div className="pub-grid">
                  <div><small>出版物</small><strong>{cur.venue}</strong></div>
                  <div><small>年份</small><strong>{cur.year}</strong></div>
                </div></div>
              <div className="detail-section"><h4>引用文本 <span>BIBTEX / TEXT</span></h4>
                <div className="cite-box">{cur.cite}<button onClick={bib}>复制</button></div></div>
              <div className="detail-section"><h4>我的笔记 <span>PRIVATE</span></h4>
                <textarea className="notes" placeholder="记录你的阅读想法…" value={cur.notes||''} onChange={e=>update('notes',e.target.value)}/></div>
            </>}</section>
          </div>
        </>
      )}
    </main>
    {show&&<div className="modal-bg"><div className="modal">
      <button className="close" onClick={()=>setShow(false)}>×</button>
      <span className="crumb">NEW REFERENCE</span><h2>添加一篇文献</h2>
      <label>标题<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="论文或书籍标题"/></label>
      <label>作者<input value={form.authors} onChange={e=>setForm({...form,authors:e.target.value})}/></label>
      <div className="two">
        <label>年份<input type="number" value={form.year} onChange={e=>setForm({...form,year:e.target.value})}/></label>
        <label>出版物<input value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/></label>
      </div>
      <label>关键词<input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="用逗号分隔"/></label>
      <label>摘要<textarea rows="3" value={form.abstract} onChange={e=>setForm({...form,abstract:e.target.value})}/></label>
      <button className="primary full" onClick={add}>保存文献</button>
    </div></div>}
    {notice&&<div className="toast">{notice}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
