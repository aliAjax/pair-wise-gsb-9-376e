import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

const seed=[
  {id:1,title:'The Extended Mind',authors:'Clark, A. & Chalmers, D.',year:1998,venue:'Analysis',tags:['具身认知','经典'],abstract:'本文提出心智延展论：当外部环境稳定地承担认知功能时，心智边界可以超越头脑与身体。',status:'阅读中',cite:'Clark, A. & Chalmers, D. (1998). The Extended Mind. Analysis.'},
  {id:2,title:'Situated Learning',authors:'Lave, J. & Wenger, E.',year:1991,venue:'Cambridge University Press',tags:['学习科学','社会'],abstract:'学习发生在真实情境的参与过程中，知识与共同体实践不可分割。',status:'待读',cite:'Lave, J. & Wenger, E. (1991). Situated Learning.'},
  {id:3,title:'Designing with Data',authors:'Miller, S.',year:2022,venue:'MIT Press',tags:['设计研究','方法'],abstract:'一套面向设计师的数据研究方法，讨论如何把定性洞察转化为可行动的设计决策。',status:'已读',cite:'Miller, S. (2022). Designing with Data. MIT Press.'},
  {id:4,title:'Social Learning Theory',authors:'Bandura, A.',year:1977,venue:'Prentice Hall',tags:['学习科学','社会学习'],abstract:'班杜拉系统阐述社会学习理论，强调观察、模仿与替代强化在行为习得中的作用。',status:'已读',cite:'Bandura, A. (1977). Social Learning Theory. Prentice Hall.'},
  {id:5,title:'社会化学习：网络时代的学习新范式',authors:'祝智庭, 等',year:2012,venue:'中国电化教育',tags:['在线学习','社会化学习'],abstract:'讨论互联网环境下面向社会互动的学习新范式，辨析相关概念的源流与用法。',status:'待读',cite:'祝智庭等 (2012). 社会化学习：网络时代的学习新范式. 中国电化教育.'}
];

const LS_ITEMS='research-library';
const LS_MERGES='tag-merges';

const readItems=()=>{try{const v=JSON.parse(localStorage.getItem(LS_ITEMS));return Array.isArray(v)&&v.length?v:seed}catch{return seed}};
const readMerges=()=>{try{const v=JSON.parse(localStorage.getItem(LS_MERGES));return Array.isArray(v)?v:[]}catch{return[]}};
const now=()=>Date.now();
const fmtTime=t=>new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
/* 指纹只覆盖用户可编辑字段；合并本身写入的 mergedAliases/updatedAt 不参与，便于判定“合并后是否被人动过” */
const SIG_KEYS=['title','authors','year','venue','tags','abstract','status','cite','notes'];
const sign=x=>JSON.stringify(SIG_KEYS.map(k=>x[k]));

function App(){
  const[items,setItems]=useState(readItems);
  const[merges,setMerges]=useState(readMerges);
  const[view,setView]=useState('library');
  const[selected,setSelected]=useState(1);
  const[query,setQuery]=useState('');
  const[tag,setTag]=useState('全部');
  const[show,setShow]=useState(false);
  const[notice,setNotice]=useState('');
  const[undo,setUndo]=useState(null);
  const[form,setForm]=useState({title:'',authors:'',year:'2024',venue:'',abstract:'',tags:''});

  useEffect(()=>localStorage.setItem(LS_ITEMS,JSON.stringify(items)),[items]);
  useEffect(()=>localStorage.setItem(LS_MERGES,JSON.stringify(merges)),[merges]);

  /* 真实标签（筛选区只显示文献当前持有的标签，因此别名合并后只剩主标签） */
  const tags=useMemo(()=>['全部',...new Set(items.flatMap(x=>x.tags))],[items]);
  /* 已并入主标签的旧标签索引：不进筛选器，但参与搜索 */
  const aliasSet=useMemo(()=>new Set(merges.flatMap(m=>m.aliases)),[merges]);

  /* 当前筛选标签因合并消失时，自动回到“全部” */
  useEffect(()=>{if(tag!=='全部'&&!tags.includes(tag))setTag('全部')},[tags,tag]);

  const searchable=x=>[x.title,x.authors,x.abstract,...x.tags,...(x.mergedAliases||[])].join(' ').toLowerCase();
  const filtered=useMemo(()=>items.filter(x=>(tag==='全部'||x.tags.includes(tag))&&searchable(x).includes(query.toLowerCase())),[items,tag,query]);
  const cur=items.find(x=>x.id===selected)||items[0];

  const update=(k,v)=>setItems(items.map(x=>x.id===cur.id?{...x,[k]:v,updatedAt:now()}:x));
  const add=()=>{
    if(!form.title)return;
    const p={...form,id:now(),year:+form.year,tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),status:'待读',cite:`${form.authors} (${form.year}). ${form.title}. ${form.venue}.`};
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

  /* 合并：预览确认后调用。为每篇受影响文献记录合并前标签 + 合并后指纹，供安全撤销使用 */
  const mergeTags=(primary,aliasPick)=>{
    const aliases=[...aliasPick].filter(t=>t!==primary);
    if(!primary||!aliases.length)return;
    const at=now();const affected=[];
    const next=items.map(x=>{
      const hit=x.tags.filter(t=>aliasPick.has(t));
      if(!hit.length)return x;
      const merged={
        ...x,
        tags:[...new Set(x.tags.map(t=>aliasPick.has(t)?primary:t))],
        mergedAliases:[...new Set([...(x.mergedAliases||[]),...hit])],
        updatedAt:at
      };
      affected.push({id:x.id,title:x.title,prevTags:x.tags,prevAliases:x.mergedAliases||[],sig:sign(merged)});
      return merged;
    });
    if(!affected.length)return;
    setMerges([{id:at,at,primary,aliases,affected},...merges]);
    setItems(next);
    if(tag!=='全部'&&aliases.includes(tag))setTag('全部');
    setNotice(`已合并：${aliases.map(t=>'#'+t).join('、')} → #${primary}（${affected.length} 篇）`);
  };

  /* 撤销：只恢复合并后未被修改、且仍存在的记录；其余列为无法恢复 */
  const undoMerge=rec=>{
    const restored=[];const blocked=[];
    const next=items.map(x=>({...x}));
    for(const e of rec.affected){
      const curItem=next.find(x=>x.id===e.id);
      if(!curItem){blocked.push({title:e.title,reason:'条目已删除'});continue;}
      if(sign(curItem)!==e.sig){blocked.push({title:curItem.title,reason:'合并后该条目被修改过'});continue;}
      curItem.tags=e.prevTags;
      curItem.mergedAliases=e.prevAliases;
      curItem.updatedAt=now();
      restored.push(curItem.title);
    }
    setItems(next);
    setMerges(merges.filter(m=>m.id!==rec.id));
    setUndo({primary:rec.primary,restored,blocked});
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
        <button className={view==='governance'?'active':''} onClick={()=>setView('governance')}>⇄ <span>标签治理</span><b>{merges.length}</b></button>
      </nav>
      <div className="side-tags">
        <small>标签</small>
        {tags.slice(1,5).map(t=><button onClick={()=>{setTag(t);setView('library')}} key={t}># {t}</button>)}
      </div>
      <div className="side-foot"><button>⚙ 偏好设置</button><small>本地数据库 · 已同步</small></div>
    </aside>

    {view==='library'
      ? <main>
          <header>
            <div><span className="crumb">RESEARCH / LIBRARY</span><h1>所有文献</h1></div>
            <div className="actions">
              <button className="outline" onClick={download}>↓ 导出引用</button>
              <button className="primary" onClick={()=>setShow(true)}>＋ 添加文献</button>
            </div>
          </header>
          <div className="toolbar">
            <div className="search">⌕<input placeholder="搜索标题、作者、摘要或标签（含已合并旧标签）…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')}>×</button>}</div>
            <div className="tag-filter">{tags.map(t=><button className={tag===t?'on':''} onClick={()=>setTag(t)} key={t}>{t}</button>)}</div>
          </div>
          <div className="body">
            <section className="paper-list">
              {filtered.map(p=><button className={'paper '+(selected===p.id?'selected':'')} onClick={()=>setSelected(p.id)} key={p.id}>
                <div className="paper-year">{p.year}</div>
                <div className="paper-copy">
                  <h3>{p.title}</h3>
                  <p>{p.authors}</p>
                  <div>
                    {p.tags.map(t=><span key={t}>#{t}</span>)}
                    {(p.mergedAliases||[]).map(t=><span className="alias-tag" key={'a'+t} title="旧标签已并入主标签，搜索仍可命中">#{t} ↪</span>)}
                  </div>
                </div>
                <small className={'status '+p.status}>{p.status}</small>
              </button>)}
              {!filtered.length&&<div className="no-result">没有找到匹配的文献</div>}
            </section>
            <section className="detail">
              {cur&&<>
                <div className="detail-top"><span className="status reading">{cur.status}</span><button onClick={()=>setNotice('已加入收藏')}>☆ 收藏</button></div>
                <h2>{cur.title}</h2>
                <p className="authors">{cur.authors}</p>
                <div className="detail-tags">
                  {cur.tags.map(t=><span key={t}>#{t}</span>)}
                  {(cur.mergedAliases||[]).length>0&&<em>旧标签：{cur.mergedAliases.map(t=>'#'+t).join(' ')}</em>}
                </div>
                <div className="cite-actions">
                  <button onClick={bib}>▣ 复制引用</button>
                  <button onClick={()=>update('status',cur.status==='已读'?'待读':'已读')}>{cur.status==='已读'?'标记为待读':'标记为已读'}</button>
                </div>
                <div className="detail-section"><h4>摘要 <span>ABSTRACT</span></h4><p>{cur.abstract}</p></div>
                <div className="detail-section"><h4>出版信息 <span>PUBLICATION</span></h4>
                  <div className="pub-grid">
                    <div><small>出版物</small><strong>{cur.venue}</strong></div>
                    <div><small>年份</small><strong>{cur.year}</strong></div>
                  </div>
                </div>
                <div className="detail-section"><h4>引用文本 <span>BIBTEX / TEXT</span></h4>
                  <div className="cite-box">{cur.cite}<button onClick={bib}>复制</button></div>
                </div>
                <div className="detail-section"><h4>我的笔记 <span>PRIVATE</span></h4>
                  <textarea className="notes" placeholder="记录你的阅读想法…" value={cur.notes||''} onChange={e=>update('notes',e.target.value)}/>
                </div>
              </>}
            </section>
          </div>
        </main>
      : <main>
          <header>
            <div><span className="crumb">RESEARCH / TAG GOVERNANCE</span><h1>标签治理</h1></div>
            <div className="actions"><button className="outline" onClick={()=>setView('library')}>← 返回文献库</button></div>
          </header>
          <Governance items={items} tags={tags.slice(1)} aliases={aliasSet} merges={merges} onMerge={mergeTags} onUndo={undoMerge}/>
        </main>}

    {show&&<div className="modal-bg">
      <div className="modal">
        <button className="close" onClick={()=>setShow(false)}>×</button>
        <span className="crumb">NEW REFERENCE</span>
        <h2>添加一篇文献</h2>
        <label>标题<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="论文或书籍标题"/></label>
        <label>作者<input value={form.authors} onChange={e=>setForm({...form,authors:e.target.value})}/></label>
        <div className="two">
          <label>年份<input type="number" value={form.year} onChange={e=>setForm({...form,year:e.target.value})}/></label>
          <label>出版物<input value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/></label>
        </div>
        <label>关键词<input value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="用逗号分隔"/></label>
        <label>摘要<textarea rows="3" value={form.abstract} onChange={e=>setForm({...form,abstract:e.target.value})}/></label>
        <button className="primary full" onClick={add}>保存文献</button>
      </div>
    </div>}

    {undo&&<div className="modal-bg">
      <div className="modal undo-modal">
        <button className="close" onClick={()=>setUndo(null)}>×</button>
        <span className="crumb">UNDO MERGE</span>
        <h2>撤销结果 · #{undo.primary}</h2>
        <p className="undo-summary">已恢复 {undo.restored.length} 篇{undo.blocked.length>0?`，${undo.blocked.length} 篇无法恢复`:''}。为避免覆盖他人修改，合并后被改动或已删除的条目不会被还原。</p>
        {undo.restored.length>0&&<div className="undo-group ok"><h4>✓ 已恢复旧标签</h4>
          <ul>{undo.restored.map(t=><li key={t}>{t}</li>)}</ul>
        </div>}
        {undo.blocked.length>0&&<div className="undo-group warn"><h4>⚠ 无法恢复</h4>
          <ul>{undo.blocked.map((t,i)=><li key={i}><span>{t.title}</span><small>{t.reason}</small></li>)}</ul>
        </div>}
        <button className="primary full" onClick={()=>setUndo(null)}>知道了</button>
      </div>
    </div>}

    {notice&&<div className="toast" onClick={()=>setNotice('')}>{notice}</div>}
  </div>;
}

function Governance({items,tags,aliases,merges,onMerge,onUndo}){
  const[primary,setPrimary]=useState('');
  const[picked,setPicked]=useState(()=>new Set());
  const[confirmed,setConfirmed]=useState(false);

  const choosePrimary=t=>{setPrimary(t);setPicked(prev=>{const n=new Set(prev);n.delete(t);return n});setConfirmed(false)};
  const toggleAlias=t=>{setPicked(prev=>{const n=new Set(prev);n.has(t)?n.delete(t):n.add(t);return n});setConfirmed(false)};
  const affected=useMemo(()=>items.filter(x=>x.tags.some(t=>picked.has(t))),[items,picked]);

  const doMerge=()=>{onMerge(primary,picked);setPrimary('');setPicked(new Set());setConfirmed(false)};

  return <div className="gov">
    <section className="gov-card">
      <h3>① 选择主标签与别名 <span>PICK CANONICAL TAG</span></h3>
      <p className="hint">单选一个主标签，再勾选需要并入它的别名标签（例如把 <b>#社会</b>、<b>#社会化学习</b> 并入 <b>#社会学习</b>）。</p>
      <div className="tag-pick">
        {tags.map(t=><label className={'tag-row '+(primary===t?'is-primary':'')+(picked.has(t)?' is-alias':'')} key={t}>
          <input type="radio" name="primary" checked={primary===t} onChange={()=>choosePrimary(t)}/>
          <span className="pick-name">#{t}</span>
          <input type="checkbox" checked={picked.has(t)} disabled={primary===t} onChange={()=>toggleAlias(t)}/>
          <small>别名</small>
          {aliases.has(t)&&<em className="merged-hint">（已是某主标签的旧标签）</em>}
        </label>)}
      </div>
    </section>

    <section className="gov-card">
      <h3>② 预览受影响文献 <span>REVIEW BEFORE WRITE</span></h3>
      {!primary||picked.size===0
        ? <p className="hint muted">请先选择主标签并勾选至少一个别名。</p>
        : affected.length===0
          ? <p className="hint muted">当前没有文献使用所选别名，合并不影响任何条目。</p>
          : <>
            <p className="hint">将影响 <b>{affected.length}</b> 篇文献，别名会被替换为 <b>#{primary}</b>，旧标签仍保留在搜索索引中：</p>
            <ul className="affected-list">
              {affected.map(x=>{
                const hit=x.tags.filter(t=>picked.has(t));
                return <li key={x.id}>
                  <div className="affected-title">{x.title}</div>
                  <div className="affected-tags">
                    {x.tags.map(t=><span key={t} className={hit.includes(t)?'tag-old':'tag-stay'}>#{t}{hit.includes(t)&&' →'}</span>)}
                    <span className="tag-new">#{primary}</span>
                  </div>
                </li>;
              })}
            </ul>
            <div className="gov-confirm">
              <button className={'primary '+(confirmed?'armed':'')} onClick={()=>{if(!confirmed){setConfirmed(true);return}doMerge()}}>
                {confirmed?`再次点击确认：合并 ${affected.length} 篇`:`确认无误，合并到 #${primary}（${affected.length} 篇）`}
              </button>
              {confirmed&&<button className="outline" onClick={()=>setConfirmed(false)}>取消</button>}
            </div>
          </>}
    </section>

    <section className="gov-card">
      <h3>③ 合并记录与撤销 <span>MERGE HISTORY</span></h3>
      {merges.length===0
        ? <p className="hint muted">尚无合并记录。</p>
        : <ul className="merge-list">
          {merges.map(m=><li key={m.id}>
            <div className="merge-main">
              <strong>#{m.primary}</strong>
              <span className="merge-arrow">←</span>
              {m.aliases.map(t=><span className="merge-alias" key={t}>#{t}</span>)}
              <b>{m.affected.length} 篇</b>
              <small>{fmtTime(m.at)}</small>
            </div>
            <ul className="merge-papers">{m.affected.map(e=><li key={e.id}>{e.title}</li>)}</ul>
            <button className="outline undo-btn" onClick={()=>onUndo(m)}>↩ 撤销此次合并</button>
          </li>)}
        </ul>}
    </section>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
