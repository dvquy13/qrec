#!/usr/bin/env bun
"use strict";var Mn=Object.create;var Be=Object.defineProperty;var Pn=Object.getOwnPropertyDescriptor;var $n=Object.getOwnPropertyNames;var Fn=Object.getPrototypeOf,Un=Object.prototype.hasOwnProperty;var S=(e,t)=>()=>(e&&(t=e(e=0)),t);var ue=(e,t)=>{for(var n in t)Be(e,n,{get:t[n],enumerable:!0})},jn=(e,t,n,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of $n(t))!Un.call(e,r)&&r!==n&&Be(e,r,{get:()=>t[r],enumerable:!(s=Pn(t,r))||s.enumerable});return e};var xe=(e,t,n)=>(n=e!=null?Mn(Fn(e)):{},jn(t||!e||!e.__esModule?Be(n,"default",{value:e,enumerable:!0}):n,e));function D(){return parseInt(process.env.QREC_PORT??"25927",10)}var F,ot,w,Ps,it,W,B,pe,q,we,me,J,ge,M=S(()=>{"use strict";F=require("path"),ot=require("os"),w=process.env.QREC_DIR??(0,F.join)((0,ot.homedir)(),".qrec"),Ps=parseInt(process.env.QREC_PORT??"25927",10);it=(0,F.join)(w,"qrec.db"),W=(0,F.join)(w,"qrec.pid"),B=(0,F.join)(w,"enrich.pid"),pe=(0,F.join)(w,"enrich-progress.json"),q=(0,F.join)(w,"qrec.log"),we=(0,F.join)(w,"activity.jsonl"),me=(0,F.join)(w,"config.json"),J=(0,F.join)(w,"models"),ge=(0,F.join)(w,"archive")});function Bn(){let e=process.env.BREW_PREFIX||process.env.HOMEBREW_PREFIX,t=[];e&&(t.push(`${e}/opt/sqlite/lib/libsqlite3.dylib`),t.push(`${e}/lib/libsqlite3.dylib`)),t.push("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib"),t.push("/usr/local/opt/sqlite/lib/libsqlite3.dylib");for(let n of t)try{if((0,Ie.statSync)(n).size>0)return n}catch{}return null}function te(e=He){let t=e.replace(/\/[^/]+$/,"");(0,Ie.mkdirSync)(t,{recursive:!0});let n=new qe.Database(e);return n.loadExtension(qn),n.exec("PRAGMA journal_mode = WAL"),n.exec("PRAGMA synchronous = NORMAL"),n.exec("PRAGMA cache_size = -32000"),n.exec("PRAGMA foreign_keys = ON"),Hn(n),n}function Hn(e){e.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL,
      seq         INTEGER NOT NULL,
      pos         INTEGER NOT NULL,
      text        TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_session_id ON chunks(session_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_seq ON chunks(seq);

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      path        TEXT NOT NULL,
      project     TEXT NOT NULL,
      date        TEXT NOT NULL,
      title       TEXT,
      hash        TEXT NOT NULL,
      indexed_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_date    ON sessions(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);

    CREATE TABLE IF NOT EXISTS query_cache (
      query_hash  TEXT PRIMARY KEY,
      embedding   BLOB NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS query_audit (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      query          TEXT NOT NULL,
      k              INTEGER NOT NULL,
      result_count   INTEGER NOT NULL,
      top_session_id TEXT,
      top_score      REAL,
      duration_ms    REAL NOT NULL,
      created_at     INTEGER NOT NULL
    );
  `);for(let t of["ALTER TABLE sessions ADD COLUMN summary TEXT","ALTER TABLE sessions ADD COLUMN tags TEXT","ALTER TABLE sessions ADD COLUMN entities TEXT","ALTER TABLE sessions ADD COLUMN enriched_at INTEGER","ALTER TABLE sessions ADD COLUMN enrichment_version INTEGER","ALTER TABLE sessions ADD COLUMN learnings TEXT","ALTER TABLE sessions ADD COLUMN questions TEXT","ALTER TABLE sessions ADD COLUMN duration_seconds INTEGER","ALTER TABLE sessions ADD COLUMN last_message_at INTEGER"])try{e.exec(t)}catch{}e.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      session_id,
      text,
      content='chunks',
      content_rowid='rowid'
    );
  `),e.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding FLOAT[768] distance_metric=cosine
    );
  `),e.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, session_id, text) VALUES (new.rowid, new.session_id, new.text);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, session_id, text) VALUES ('delete', old.rowid, old.session_id, old.text);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, session_id, text) VALUES ('delete', old.rowid, old.session_id, old.text);
      INSERT INTO chunks_fts(rowid, session_id, text) VALUES (new.rowid, new.session_id, new.text);
    END;
  `)}var qe,at,Ie,He,qn,fe=S(()=>{"use strict";qe=require("bun:sqlite"),at=require("sqlite-vec"),Ie=require("fs");M();He=it;if(process.platform==="darwin"){let e=Bn();if(!e)throw new Error(`sqlite-vec requires a Homebrew SQLite build that supports dynamic extension loading. Install with: brew install sqlite
Then set BREW_PREFIX if Homebrew is in a non-standard location.`);qe.Database.setCustomSQLite(e)}qn=(0,at.getLoadablePath)()});function lt(e){if(e.length<=3600)return[{text:e,pos:0}];let t=Gn(e),n=[],s="",r=0;for(let o of t){let i=s?s+`

`+o.text:o.text;if(i.length<=3600)s||(r=o.pos),s=i;else if(s){n.push({text:s.trim(),pos:r});let a=s.slice(-ct),l=r+s.length-a.length;s=a+`

`+o.text,r=l}else{let a=Vn(o.text,o.pos);if(a.length>1){for(let u=0;u<a.length-1;u++)n.push(a[u]);let l=a[a.length-1];s=l.text,r=l.pos}else s=o.text,r=o.pos}}return s.trim()&&n.push({text:s.trim(),pos:r}),n}function Gn(e){let t=/^(#{1,6} .+)$/m,n=[],s=0,r=[],o,i=/^(#{1,6} .+)$/gm;for(;(o=i.exec(e))!==null;)o.index>0&&r.push(o.index);if(r.length===0)return[{text:e,pos:0}];for(let l of r){let u=e.slice(s,l);u.trim()&&n.push({text:u.trim(),pos:s}),s=l}let a=e.slice(s);return a.trim()&&n.push({text:a.trim(),pos:s}),n.length>0?n:[{text:e,pos:0}]}function Vn(e,t){let n=[],s=0;for(;s<e.length;){let r=s+3600;if(r>=e.length){n.push({text:e.slice(s).trim(),pos:t+s});break}let o=e.lastIndexOf(`

`,r);if(o>s+3600*.5)r=o;else{let i=e.lastIndexOf(`
`,r);i>s+3600*.5&&(r=i)}n.push({text:e.slice(s,r).trim(),pos:t+s}),s=Math.max(s+1,r-ct)}return n}var ct,dt=S(()=>{"use strict";ct=Math.floor(540)});var T,Ne=S(()=>{"use strict";T={phase:"starting",modelDownload:{percent:0,downloadedMB:0,totalMB:null},indexing:{indexed:0,total:0,current:""}}});function v(e){let t={ts:Date.now(),...e};try{(0,X.mkdirSync)(w,{recursive:!0}),(0,X.appendFileSync)(we,JSON.stringify(t)+`
`,"utf-8")}catch(n){console.warn("[activity] Failed to write activity log:",n)}}function ut(e=100){if(!(0,X.existsSync)(we))return[];try{return(0,X.readFileSync)(we,"utf-8").split(`
`).filter(s=>s.trim().length>0).map(s=>{try{return JSON.parse(s)}catch{return null}}).filter(s=>s!==null).slice(-e).reverse()}catch(t){return console.warn("[activity] Failed to read activity log:",t),[]}}var X,ae=S(()=>{"use strict";X=require("fs");M()});var ft={};ue(ft,{disposeEmbedder:()=>Ve,getEmbedder:()=>Jn});async function Qn(){if(!process.env.QREC_DIR&&(0,ve.existsSync)(Ge))return console.log(`[embed] Found model at legacy path: ${Ge}`),Ge;console.log(`[embed] Resolving model: ${pt}`),(0,ve.mkdirSync)(J,{recursive:!0}),T.phase="model_download",T.modelDownload={percent:0,downloadedMB:0,totalMB:null};let{resolveModelFile:e}=await import("node-llama-cpp"),t=await e(pt,{directory:J,onProgress({totalSize:n,downloadedSize:s}){T.modelDownload={percent:n?Math.round(s/n*100):0,downloadedMB:+(s/1048576).toFixed(1),totalMB:n?+(n/1048576).toFixed(1):null}}});return console.log(`[embed] Model ready at ${t}`),T.modelDownload.totalMB!==null&&v({type:"embed_model_downloaded",data:{totalMB:T.modelDownload.totalMB}}),t}async function Wn(){let e=await Qn();T.phase="model_loading",console.log(`[embed] Loading model from ${e}`);let{getLlama:t}=await import("node-llama-cpp");Ee=await t();let s=await(await Ee.loadModel({modelPath:e})).createEmbeddingContext({contextSize:8192});return console.log("[embed] Model loaded, embedding dimensions: 768"),s}async function Ve(){ce&&(await ce.dispose(),ce=null),Ee&&(await Ee.dispose(),Ee=null,he=null)}async function Jn(){return he||(he=Wn().catch(e=>{throw he=null,e})),ce||(ce=await he),{dimensions:768,async embed(e){let t=ce,n=24e3,s=e.length>n?e.slice(0,n):e;s!==e&&console.warn(`[embed] Truncated chunk from ${e.length} to ${n} chars`);let r=await t.getEmbeddingFor(s);return new Float32Array(r.vector)}}}var mt,gt,ve,pt,Ge,Ee,ce,he,Qe=S(()=>{"use strict";mt=require("path"),gt=require("os"),ve=require("fs");M();Ne();ae();pt="hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",Ge=(0,mt.join)((0,gt.homedir)(),".cache","qmd","models","hf_ggml-org_embeddinggemma-300M-Q8_0.gguf"),Ee=null,ce=null,he=null});var ht={};ue(ht,{getOllamaEmbedder:()=>Kn});function Kn(){let e=process.env.QREC_OLLAMA_HOST??Xn,t=process.env.QREC_OLLAMA_MODEL??Yn;return console.log(`[embed/ollama] Using Ollama at ${e}, model: ${t}`),{dimensions:768,async embed(n){let s=await fetch(`${e}/api/embeddings`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:t,prompt:n})});if(!s.ok){let o=await s.text().catch(()=>"");throw new Error(`Ollama embeddings request failed: HTTP ${s.status} \u2014 ${o}`)}let r=await s.json();if(!Array.isArray(r.embedding)||r.embedding.length===0)throw new Error("Ollama returned empty or invalid embedding");return new Float32Array(r.embedding)}}}var Xn,Yn,Et=S(()=>{"use strict";Xn="http://localhost:11434",Yn="nomic-embed-text"});var bt={};ue(bt,{getOpenAIEmbedder:()=>es});function es(){let e=process.env.QREC_OPENAI_KEY;if(!e)throw new Error("QREC_OPENAI_KEY environment variable is required for OpenAI embedding backend");let t=(process.env.QREC_OPENAI_BASE_URL??zn).replace(/\/$/,""),n=process.env.QREC_OPENAI_MODEL??Zn,s=parseInt(process.env.QREC_OPENAI_DIMENSIONS??String(768),10);return console.log(`[embed/openai] Using OpenAI-compatible API at ${t}, model: ${n}, dimensions: ${s}`),{dimensions:s,async embed(r){let o={model:n,input:r};n.startsWith("text-embedding-3")&&(o.dimensions=s);let i=await fetch(`${t}/embeddings`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e}`},body:JSON.stringify(o)});if(!i.ok){let l=await i.text().catch(()=>"");throw new Error(`OpenAI embeddings request failed: HTTP ${i.status} \u2014 ${l}`)}let a=await i.json();if(!a.data?.[0]?.embedding||a.data[0].embedding.length===0)throw new Error("OpenAI returned empty or invalid embedding");return new Float32Array(a.data[0].embedding)}}}var zn,Zn,Rt=S(()=>{"use strict";zn="https://api.openai.com/v1",Zn="text-embedding-3-small"});var _t={};ue(_t,{getStubEmbedder:()=>ts});function ts(){return{dimensions:768,async embed(e){return yt}}}var yt,St=S(()=>{"use strict";yt=new Float32Array(768);yt[0]=1});async function Ae(){let e=(process.env.QREC_EMBED_PROVIDER??"local").toLowerCase().trim();switch(e){case"local":case"":{let{getEmbedder:t}=await Promise.resolve().then(()=>(Qe(),ft));return t()}case"ollama":{let{getOllamaEmbedder:t}=await Promise.resolve().then(()=>(Et(),ht));return t()}case"openai":{let{getOpenAIEmbedder:t}=await Promise.resolve().then(()=>(Rt(),bt));return t()}case"stub":{let{getStubEmbedder:t}=await Promise.resolve().then(()=>(St(),_t));return t()}default:throw new Error(`Unknown QREC_EMBED_PROVIDER: "${e}". Valid values: local, ollama, openai, stub`)}}var We=S(()=>{"use strict"});function ns(e){let t=e;for(;;){try{if((0,be.statSync)((0,U.join)(t,".claude")).isDirectory())return(0,U.basename)(t)}catch{}let n=(0,U.dirname)(t);if(n===t)break;t=n}for(t=e;;){try{if((0,be.statSync)((0,U.join)(t,".git")).isDirectory())return(0,U.basename)(t)}catch{}let n=(0,U.dirname)(t);if(n===t)break;t=n}return(0,U.basename)(e)}function Tt(e){return e.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g,"").replace(/<[^>]+\/>/g,"").trim()}function ss(e,t){let s={Bash:"command",Read:"file_path",Write:"file_path",Edit:"file_path",Glob:"pattern",Grep:"pattern",WebFetch:"url",WebSearch:"query",Agent:"description"}[e],r=s&&typeof t[s]=="string"?t[s]:JSON.stringify(t),o=r.length>80?r.slice(0,80)+"\u2026":r;return`${e}: \`${o}\``}function rs(e){if(typeof e=="string")return{text:Tt(e).trim(),isToolResult:!1};if(!Array.isArray(e))return{text:"",isToolResult:!1};if(e.every(s=>s?.type==="tool_result"))return{text:"",isToolResult:!0};let n=[];for(let s of e)if(s?.type==="text"&&typeof s.text=="string"){let r=Tt(s.text).trim();r&&n.push(r)}return{text:n.join(`
`).trim(),isToolResult:!1}}function os(e){if(!Array.isArray(e))return{text:"",tools:[],thinking:[]};let t=[],n=[],s=[];for(let r of e)if(r?.type==="text"&&typeof r.text=="string"){let o=r.text.trim();o&&t.push(o)}else if(r?.type==="tool_use"&&r.name)n.push(ss(r.name,r.input??{}));else if(r?.type==="thinking"&&typeof r.thinking=="string"){let o=r.thinking.trim();o&&s.push(o)}return{text:t.join(`
`).trim(),tools:n,thinking:s}}async function Re(e){let t=(0,be.readFileSync)(e,"utf-8"),n=(0,xt.createHash)("sha256").update(t).digest("hex"),r=(0,U.basename)(e,".jsonl").replace(/-/g,"").slice(0,8),o=t.split(`
`).filter(d=>d.trim()).map(d=>{try{return JSON.parse(d)}catch{return null}}).filter(d=>d!==null),i="",a="",l=null,u=[],c=[];for(let d of o){if(d.timestamp&&c.push(Date.parse(d.timestamp)),d.type==="file-history-snapshot"||d.type==="system"||d.type==="progress"||d.isMeta||d.isSidechain)continue;let R=d.message;if(R){if(!i&&d.cwd&&(i=ns(d.cwd)),!a&&d.timestamp&&(a=d.timestamp.slice(0,10)),R.role==="user"&&d.type==="user"){let{text:N,isToolResult:G}=rs(R.content);if(G||!N)continue;l||(l=N.slice(0,120)),u.push({role:"user",text:N,tools:[],thinking:[],timestamp:d.timestamp??null})}if(R.role==="assistant"&&d.type==="assistant"){let{text:N,tools:G,thinking:Q}=os(R.content);if(!N&&G.length===0&&Q.length===0)continue;u.push({role:"assistant",text:N,tools:G,thinking:Q,timestamp:d.timestamp??null})}}}let g=900*1e3;c.sort((d,R)=>d-R);let h=0;for(let d=1;d<c.length;d++)h+=Math.min(c[d]-c[d-1],g);let f=Math.round(h/1e3),m=c.length>0?c[c.length-1]:Date.now();return{session_id:r,path:e,project:i,date:a,title:l,hash:n,duration_seconds:f,last_message_at:m,turns:u}}function wt(e){let t=[`# Session: ${e.project} \u2014 ${e.date}`,""];e.title&&t.push(`_${e.title}_`,"");for(let n of e.turns)if(n.role==="user")t.push("## User","",n.text,"");else{t.push("## Assistant",""),n.text&&t.push(n.text,"");for(let s of n.tools)t.push(`> **Tool:** ${s}`);n.tools.length>0&&t.push("")}return t.join(`
`)}function It(e){let t=[];for(let n of e.turns){n.text&&t.push(`[${n.role==="user"?"User":"Assistant"}] ${n.text}`);for(let s of n.tools)t.push(`[Tool] ${s}`)}return t.join(`
`)}var xt,be,U,Je=S(()=>{"use strict";xt=require("crypto"),be=require("fs"),U=require("path")});function is(e){let t=[];for(let n of(0,C.readdirSync)(e)){let s=(0,ne.join)(e,n);if((0,C.statSync)(s).isDirectory())for(let r of(0,C.readdirSync)(s))r.endsWith(".jsonl")&&t.push((0,ne.join)(s,r));else n.endsWith(".jsonl")&&t.push(s)}return t}function as(e){return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function cs(e,t,n){let s=as(n),r=[...e];for(let o=r.length-1;o>0;o--){let i=Math.floor(s()*(o+1));[r[o],r[i]]=[r[i],r[o]]}return r.slice(0,t)}async function Nt(e,t=2){try{let n=await Re(e);if(n.turns.filter(o=>o.role==="user").length<t)return null;let r=It(n);return r.trim()?{id:n.session_id,path:e,project:n.project,date:n.date,title:n.title,hash:n.hash,duration_seconds:n.duration_seconds,last_message_at:n.last_message_at,chunkText:r}:null}catch(n){return console.warn("[indexer] Failed to parse JSONL:",e,n),null}}function ls(e,t,n){if(!e.startsWith(n))try{let s=(0,ne.join)(n,t);(0,C.mkdirSync)(s,{recursive:!0}),(0,C.copyFileSync)(e,(0,ne.join)(s,(0,ne.basename)(e)))}catch(s){console.warn(`[indexer] Archive failed for ${e}: ${s}`)}}async function ye(e,t,n={},s,r){let o=r??await Ae(),i=t.endsWith(".jsonl")&&(0,C.existsSync)(t),a=!i&&(0,C.existsSync)(t)&&(0,C.statSync)(t).isDirectory(),l=new Map,u=e.prepare("SELECT path, indexed_at FROM sessions").all();for(let E of u)l.set(E.path,E.indexed_at);let c=[];if(i){let E=await Nt(t,vt);if(!E){console.log("[indexer] Session skipped (too few user turns or empty)");return}c=[E]}else if(a){let E=is(t),L=n.force?E:E.filter(P=>{let ie=l.get(P);return ie?(0,C.statSync)(P).mtimeMs>=ie:!0}),Z=E.length-L.length;console.log(`[indexer] Found ${E.length} JSONL files (${Z} skipped by mtime, ${L.length} to check)`),c=(await Promise.all(L.map(P=>Nt(P,vt)))).filter(P=>P!==null)}else{console.error(`[indexer] Path not found or not a JSONL/directory: ${t}`);return}let g=new Map,h=e.prepare("SELECT id, hash FROM sessions").all();for(let E of h)g.set(E.id,E.hash);if(n.sessions&&n.sessions<c.length){let E=n.seed??42;c=cs(c,n.sessions,E),console.log(`[indexer] Sampled ${c.length} sessions (seed=${E})`)}let f=c.filter(({id:E,hash:L})=>n.force?!0:g.get(E)!==L),m=c.length-f.length,d=i?1:c.length;console.log(`[indexer] ${f.length} sessions to index (${d} total, ${m} up-to-date)`);let R=e.prepare(`
    INSERT INTO sessions (id, path, project, date, title, hash, indexed_at, duration_seconds, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path=excluded.path, project=excluded.project, date=excluded.date,
      title=CASE WHEN excluded.hash != sessions.hash THEN excluded.title ELSE COALESCE(sessions.title, excluded.title) END,
      hash=excluded.hash, indexed_at=excluded.indexed_at,
      duration_seconds=excluded.duration_seconds, last_message_at=excluded.last_message_at,
      summary=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.summary END,
      tags=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.tags END,
      entities=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.entities END,
      enriched_at=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.enriched_at END,
      enrichment_version=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.enrichment_version END
  `),N=e.prepare(`
    INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),G=e.prepare(`
    INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding)
    VALUES (?, ?)
  `),Q=e.prepare("DELETE FROM chunks WHERE session_id = ?"),z=e.prepare("DELETE FROM chunks_vec WHERE chunk_id LIKE ?");for(let E=0;E<f.length;E++){let{id:L,path:Z,project:oe,date:P,title:ie,hash:Se,duration_seconds:Fe,last_message_at:Ue,chunkText:je}=f[E],de=n.archiveDir===void 0?ge:n.archiveDir;de!==null&&ls(Z,oe,de);let Te=lt(je),p=Date.now(),y=e.transaction(()=>(Q.run(L),z.run(`${L}_%`),R.run(L,Z,oe,P,ie,Se,p,Fe,Ue),Te))();process.stdout.write(`[${E+1}/${f.length}] ${L} (${oe}/${P}) \u2014 ${y.length} chunks
`),s?.(E,f.length,L);let I=e.transaction(O=>{for(let{chunkId:j,seq:$,pos:ee,text:Cn,embedding:kn}of O)N.run(j,L,$,ee,Cn,p),G.run(j,Buffer.from(kn.buffer))}),_=[];for(let O=0;O<y.length;O++){let j=y[O],$=`${L}_${O}`,ee=await o.embed(j.text);_.push({chunkId:$,seq:O,pos:j.pos,text:j.text,embedding:ee})}I(_)}s?.(f.length,f.length,""),console.log(`[indexer] Done. Total sessions indexed: ${f.length}`)}async function At(e,t){let n=e.prepare(`
    SELECT c.id, c.text FROM chunks c
    LEFT JOIN chunks_vec v ON v.chunk_id = c.id
    WHERE c.seq = -1 AND v.chunk_id IS NULL
  `).all();if(n.length===0)return;console.log(`[indexer] Embedding ${n.length} summary chunk(s) into chunks_vec`);let s=e.prepare("INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)");for(let{id:r,text:o}of n){let i=await t.embed(o);s.run(r,Buffer.from(i.buffer))}console.log("[indexer] Summary chunks embedded.")}var C,ne,vt,Xe=S(()=>{"use strict";C=require("fs"),ne=require("path");M();dt();We();Je();vt=2});function Mt(e,t){for(let n of t)for(let s of e){let r=`${n}/${s}`;if((0,H.existsSync)(r)){let o=s.match(/\.so\.(\d+)/);return{path:r,soVersion:o?.[1]??null}}}return null}function ps(){try{let e=Bun.spawnSync(["nvidia-smi","--query-gpu=name,driver_version","--format=csv,noheader,nounits"]);if(e.exitCode!==0||!e.stdout)return null;let t=e.stdout.toString("utf-8").trim().split(", ");if(t.length<2)return null;let n=t[0].trim(),s=t[1].trim(),o=Bun.spawnSync(["nvidia-smi"]).stdout?.toString("utf-8").match(/CUDA Version:\s*([\d.]+)/);return{name:n,driver:s,cudaVersion:o?.[1]??"unknown"}}catch{return null}}function ms(){try{let e=(0,H.readFileSync)("/etc/os-release","utf-8"),t={};for(let n of e.split(`
`)){let s=n.match(/^(\w+)="?([^"]*)"?$/);s&&(t[s[1]]=s[2])}return t}catch{return{}}}function gs(){return(0,H.existsSync)("/usr/bin/apt-get")?"apt":(0,H.existsSync)("/usr/bin/dnf")?"dnf":(0,H.existsSync)("/usr/bin/yum")?"yum":(0,H.existsSync)("/usr/bin/pacman")?"pacman":"unknown"}function fs(){try{return(0,H.readdirSync)("/etc/apt/sources.list.d").some(e=>e.startsWith("cuda")||e.includes("nvidia"))}catch{return!1}}function hs(e){let t=e.libcudart,n=e.libcublas;return!t?.found||!n?.found?"linux-x64":t.soVersion==="13"&&n.soVersion==="13"?"linux-x64-cuda":"linux-x64-cuda-ext"}function Es(e,t,n){let s=e.cudaVersion!=="unknown"?e.cudaVersion.split(".").slice(0,2).join("-"):"12-8",r=s.split("-")[0],o=[];if(t==="apt"){if(!n){let i=ms(),a=i.ID?.toLowerCase()??"ubuntu",l=i.VERSION_ID?.replace(".","")??"2204";o.push(`wget https://developer.download.nvidia.com/compute/cuda/repos/${a}${l}/x86_64/cuda-keyring_1.1-1_all.deb`),o.push("sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt-get update")}o.push(`sudo apt install -y cuda-cudart-${s} libcublas-${s}`)}else t==="dnf"||t==="yum"?o.push(`sudo ${t} install -y cuda-cudart-${s} libcublas-${s}`):t==="pacman"?o.push("sudo pacman -S cuda"):(o.push("# Install CUDA runtime libs from your package manager or the NVIDIA CUDA toolkit"),o.push(`# Required: libcudart.so.${r}, libcublas.so.${r}, libcublasLt.so.${r}`));return o.push("qrec teardown && qrec serve --daemon"),o}function se(){if(le)return le;if(process.platform!=="linux")return le={gpuDetected:!1,gpuName:null,driverVersion:null,cudaDriverVersion:null,cudaRuntimeAvailable:!1,vulkanAvailable:!1,missingLibs:[],libProbes:{},selectedBackend:"cpu",activeBinaryName:null,pkgManager:"unknown",cudaRepoConfigured:null,advice:null,installSteps:null},le;let e=ps(),t={},n=[];for(let h of us){let f=Mt(h.variants,kt);t[h.name]={found:f!==null,path:f?.path??null,soVersion:f?.soVersion??null},f||n.push(h.name)}let s=Mt(["libvulkan.so","libvulkan.so.1"],kt),r=e!==null&&n.length===0,o=s!==null,i=r?"cuda":o?"vulkan":"cpu",a=r?hs(t):"linux-x64",l=gs(),u=l==="apt"?fs():null,c=null,g=null;return e&&!r&&(c=`GPU detected (${e.name}) but CUDA runtime libs missing: ${n.join(", ")}.`,g=Es(e,l,u)),le={gpuDetected:e!==null,gpuName:e?.name??null,driverVersion:e?.driver??null,cudaDriverVersion:e?.cudaVersion??null,cudaRuntimeAvailable:r,vulkanAvailable:o,missingLibs:n,libProbes:t,selectedBackend:i,activeBinaryName:a,pkgManager:l,cudaRepoConfigured:u,advice:c,installSteps:g},le}var H,kt,us,le,Oe=S(()=>{"use strict";H=require("node:fs"),kt=["/usr/lib","/usr/lib64","/usr/lib/x86_64-linux-gnu","/usr/lib/aarch64-linux-gnu","/usr/local/cuda/lib64","/usr/local/cuda/targets/x86_64-linux/lib","/usr/local/cuda/targets/aarch64-linux/lib",...process.env.LD_LIBRARY_PATH?.split(":").filter(Boolean)??[],...process.env.CUDA_PATH?[`${process.env.CUDA_PATH}/lib64`]:[]],us=[{name:"libcudart",variants:["libcudart.so","libcudart.so.11","libcudart.so.12","libcudart.so.13"]},{name:"libcublas",variants:["libcublas.so","libcublas.so.11","libcublas.so.12","libcublas.so.13"]},{name:"libcublasLt",variants:["libcublasLt.so","libcublasLt.so.11","libcublasLt.so.12","libcublasLt.so.13"]}];le=null});function K(e=me){try{let t=JSON.parse((0,Y.readFileSync)(e,"utf-8"));return{...Pt,...t}}catch(t){return t.code!=="ENOENT"&&console.warn("[config] Failed to parse config.json, using defaults:",t),{...Pt}}}function $t(e=me){(0,Y.existsSync)(e)||Ke({},e)}function Ke(e,t=me){let s={...K(t),...e},r=t===me?w:t.replace(/\/[^/]+$/,"");return(0,Y.mkdirSync)(r,{recursive:!0}),(0,Y.writeFileSync)(t,JSON.stringify(s,null,2),"utf-8"),s}var Y,Pt,De=S(()=>{"use strict";Y=require("fs");M();Pt={enrichEnabled:!0,enrichIdleMs:300*1e3,indexIntervalMs:6e4}});var Ft,Ut=S(()=>{"use strict";Ft=`You are a concise technical summarizer for AI coding sessions.
Given a conversation transcript between a user and an AI coding assistant, produce a structured summary.

Output ONLY valid JSON with this exact shape:
{
  "title": "5-10 word descriptive title of what was done",
  "summary": "2-3 sentence description of what was accomplished",
  "tags": ["tag1", "tag2", "tag3"],
  "entities": ["FileName.ts", "functionName()", "ErrorType", "library-name"],
  "learnings": ["brief insight 1", "brief insight 2"],
  "questions": ["Question this session answers?", "Another question?", "A third question?"]
}

Rules:
- title: 5-10 words, verb-first, describes what was built/fixed/decided (e.g. "Fix FTS5 query sanitization bug", "Add project filter to dashboard")
- summary: focus on what was built/fixed/decided \u2014 not how the conversation went
- tags: 3-6 lowercase kebab-case labels (e.g. "bug-fix", "refactor", "typescript", "mcp", "database")
- entities: key technical artifacts mentioned (files, functions, errors, libraries) \u2014 max 8
- learnings: 2 or more brief technical insights, decisions, or gotchas discovered in this session \u2014 one sentence each; include all that are worth remembering
- questions: exactly 3 concrete questions a developer might ask that this session directly answers (e.g. "How do you fix X?", "What causes Y?")
- No explanation outside the JSON block`});function bs(e,t=6e3){let n=e.split(`
`),s=[],r=0;for(let o of n)if(!o.startsWith("[Tool]")){if(r+o.length>t){s.push("... (truncated)");break}s.push(o),r+=o.length+1}return s.join(`
`)}function Ce(e){return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}function Rs(e){let t=e.replace(/<think>[\s\S]*?<\/think>/g,"").trim(),n=t.match(/\{[\s\S]*\}/);if(!n)return{title:"",summary:t.slice(0,500)||"",tags:[],entities:[],learnings:[],questions:[]};try{let s=JSON.parse(n[0]);return{title:typeof s.title=="string"?s.title:"",summary:typeof s.summary=="string"?s.summary:"",tags:Ce(s.tags),entities:Ce(s.entities),learnings:Ce(s.learnings),questions:Ce(s.questions)}}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}}async function jt(e,t){let{LlamaChatSession:n}=await import("node-llama-cpp"),s=e.ctx.getSequence(),r=new n({contextSequence:s,systemPrompt:Ft}),i=`/no_think

Transcript:

${bs(t)}

JSON summary:`;try{let a=await r.prompt(i,{maxTokens:600,temperature:.1});return Rs(a)}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}finally{s.dispose()}}var Bt=S(()=>{"use strict";Ut()});var Vt={};ue(Vt,{ENRICHMENT_VERSION:()=>V,ENRICH_PID_FILE:()=>B,disposeSummarizer:()=>Ze,isEnrichAlive:()=>et,isProcessAlive:()=>Me,loadSummarizer:()=>qt,readEnrichPid:()=>ke,runEnrich:()=>xs,selectPendingSessions:()=>Gt});function ke(){if(!(0,k.existsSync)(B))return null;let e=parseInt((0,k.readFileSync)(B,"utf-8").trim(),10);return isNaN(e)?null:e}function Me(e){try{return process.kill(e,0),!0}catch{return!1}}function et(){let e=ke();return e!==null&&Me(e)}function _s(e){(0,k.mkdirSync)(w,{recursive:!0}),(0,k.writeFileSync)(B,String(e),"utf-8")}function ze(){try{(0,k.unlinkSync)(B)}catch{}}async function qt(){let{resolveModelFile:e,getLlama:t}=await import("node-llama-cpp");(0,k.mkdirSync)(J,{recursive:!0}),process.stdout.write(`[enrich] Resolving model...
`);let n=-1,s=!1,r=null,o=await e(ys,{directory:J,onProgress({totalSize:u,downloadedSize:c}){s=!0;let g=u?Math.round(c/u*100):0;if(process.stdout.write(`\r[enrich] Downloading model... ${g}%`),Math.abs(g-n)>=5){n=g;let h=u?Math.round(u/1024/1024):null;r=h;let f=Math.round(c/1024/1024);try{(0,k.writeFileSync)(pe,JSON.stringify({percent:g,downloadedMB:f,totalMB:h}),"utf-8")}catch{}}}});s&&process.stdout.write(`
`),process.stdout.write(`[enrich] Model ready at ${o}
`);let i=await t(),a=await i.loadModel({modelPath:o}),l=await a.createContext({contextSize:8192,sequences:1,flashAttention:!0});console.log("[enrich] Model loaded.");try{(0,k.unlinkSync)(pe)}catch{}return s&&v({type:"enrich_model_downloaded",data:{totalMB:r}}),v({type:"enrich_model_loaded"}),{llama:i,model:a,ctx:l}}async function Ze(e){await e.ctx.dispose(),await e.model.dispose(),await e.llama.dispose()}function Ss(e,t){return e.prepare("SELECT text FROM chunks WHERE session_id = ? ORDER BY seq").all(t).map(s=>s.text).join(`

`)}function Ht(e,t,n,s=[],r=[]){return[e,t.length>0?"Tags: "+t.join(", "):"",n.length>0?"Entities: "+n.join(", "):"",s.length>0?"Learnings: "+s.join(" "):"",r.length>0?"Questions: "+r.join(" "):""].filter(Boolean).join(`
`)}function Ts(e){let t=e.prepare(`SELECT id, summary, tags, entities, learnings, questions FROM sessions
     WHERE enriched_at IS NOT NULL
       AND id NOT IN (SELECT session_id FROM chunks WHERE id = session_id || '_summary')`).all();if(t.length===0)return;console.log(`[enrich] Backfilling summary chunks for ${t.length} already-enriched session(s)`);let n=e.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let s of t){if(!s.summary)continue;let r=s.tags?JSON.parse(s.tags):[],o=s.entities?JSON.parse(s.entities):[],i=s.learnings?JSON.parse(s.learnings):[],a=s.questions?JSON.parse(s.questions):[],l=Ht(s.summary,r,o,i,a);n.run(`${s.id}_summary`,s.id,-1,-1,l,Date.now())}console.log("[enrich] Backfill done.")}function Gt(e,t){let n=t.minAgeMs!==void 0?Date.now()-t.minAgeMs:null,s;return t.force?s=n!==null?e.prepare("SELECT id FROM sessions WHERE last_message_at < ?").all(n):e.prepare("SELECT id FROM sessions").all():s=n!==null?e.prepare("SELECT id FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").all(V,n):e.prepare("SELECT id FROM sessions WHERE enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?").all(V),t.limit!==void 0?s.slice(0,t.limit):s}async function xs(e={}){_s(process.pid);let t=te();try{Ts(t);let n=Gt(t,e);if(e.limit!==void 0&&(n=n.slice(0,e.limit)),n.length===0){console.log("[enrich] No pending sessions. Exiting without loading model.");return}console.log(`[enrich] ${n.length} session(s) to enrich`);let s=Date.now();v({type:"enrich_started",data:{pending:n.length}});let r=0,o=!1,i=null;try{i=await qt();let a=t.prepare("UPDATE sessions SET summary=?, tags=?, entities=?, learnings=?, questions=?, title = CASE WHEN ? != '' THEN ? ELSE title END, enriched_at=?, enrichment_version=? WHERE id=?"),l=t.prepare("DELETE FROM chunks WHERE id = ?"),u=t.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let c=0;c<n.length;c++){let{id:g}=n[c],h=Ss(t,g);if(!h.trim()){t.prepare("UPDATE sessions SET enriched_at=?, enrichment_version=? WHERE id=?").run(Date.now(),V,g),console.log(`[${c+1}/${n.length}] ${g} \u2014 skip (no chunks)`);continue}let f=Date.now(),m=await jt(i,h),d=Date.now()-f,R=Date.now();if(a.run(m.summary,JSON.stringify(m.tags),JSON.stringify(m.entities),JSON.stringify(m.learnings),JSON.stringify(m.questions),m.title,m.title,R,V,g),m.summary||m.tags.length>0||m.entities.length>0||m.learnings.length>0||m.questions.length>0){let N=Ht(m.summary,m.tags,m.entities,m.learnings,m.questions);l.run(`${g}_summary`),u.run(`${g}_summary`,g,-1,-1,N,R)}v({type:"session_enriched",data:{sessionId:g,latencyMs:d}}),r++,console.log(`[${c+1}/${n.length}] ${g} \u2014 ${d}ms`),m.summary&&console.log(`  Summary: ${m.summary.slice(0,100)}`),m.tags.length>0&&console.log(`  Tags: ${m.tags.join(", ")}`),m.learnings.length>0&&console.log(`  Learnings: ${m.learnings.length}`),m.questions.length>0&&console.log(`  Questions: ${m.questions.length}`)}v({type:"enrich_complete",data:{enriched:r,durationMs:Date.now()-s}}),console.log("[enrich] Done."),t.close(),ze(),o=!0,await Ze(i)}finally{if(!o){v({type:"enrich_complete",data:{enriched:r,durationMs:Date.now()-s}});try{t.close()}catch{}if(ze(),i)try{await Ze(i)}catch{}}}}finally{try{t.close()}catch{}ze()}}var k,V,ys,Pe=S(()=>{"use strict";k=require("fs");M();fe();Bt();ae();V=3,ys="hf:bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen_Qwen3-1.7B-Q4_K_M.gguf"});function Wt(e){if(!K().enrichEnabled)return;let t=ke();if(t!==null&&Me(t)){console.log("[server] Enrich child already running, skipping spawn.");return}let n=K().enrichIdleMs,s=Date.now()-n;if(e.prepare("SELECT COUNT(*) as n FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").get(V,s).n===0)return;let o=q,i=typeof Xt.dir=="string"?["bun","run",(0,nt.join)(Xt.dir,"cli.ts"),"enrich"]:[process.argv[0],process.argv[1],"enrich"],a=Bun.spawn([...i,"--min-age-ms",String(n)],{detached:!0,stdio:["ignore",Bun.file(o),Bun.file(o)]});a.unref(),console.log(`[server] Spawned enrich child (PID ${a.pid})`)}async function Jt(e,t,n=!1){if(t.isIndexing||!(0,tt.existsSync)(Qt))return;t.isIndexing=!0;let s=Date.now();n&&v({type:"index_started"}),n&&(T.phase="indexing"),T.indexing={indexed:0,total:0,current:""};let r=0,o=-1,i=[];try{if(await ye(e,Qt,{},(a,l,u)=>{T.indexing={indexed:a,total:l,current:u},u&&a>o&&(n?v({type:"session_indexed",data:{sessionId:u}}):i.push(u),r++,o=a)}),n&&(0,tt.existsSync)(ge)&&(o=-1,await ye(e,ge,{},(a,l,u)=>{T.indexing={indexed:a,total:l,current:u},u&&a>o&&(v({type:"session_indexed",data:{sessionId:u}}),r++,o=a)})),!n&&r>0){v({type:"index_started"});for(let a of i)v({type:"session_indexed",data:{sessionId:a}})}(n||r>0)&&v({type:"index_complete",data:{newSessions:r,durationMs:Date.now()-s}}),t.embedder&&await At(e,t.embedder)}catch(a){console.error("[server] Index error:",a)}finally{t.isIndexing=!1,n&&(T.phase="ready")}}async function zt(e,t,n=10,s=3e4){let r=se();process.platform==="linux"&&(console.log(`[server] GPU: ${r.gpuDetected?`${r.gpuName} (driver ${r.driverVersion}, CUDA ${r.cudaDriverVersion})`:"none detected"}`),console.log(`[server] Compute backend: ${r.selectedBackend}`),r.advice&&console.warn(`[server] WARNING: ${r.advice}`));for(let o=1;o<=n;o++)try{T.phase="model_loading",t.embedder=await Ae(),t.embedderError=null,console.log("[server] Model ready");let i=K().indexIntervalMs;Wt(e),setInterval(()=>Wt(e),i),await Jt(e,t,!0),T.phase="ready",setInterval(()=>Jt(e,t),i);return}catch(i){t.embedderError=String(i),console.error(`[server] Model load failed (attempt ${o}/${n}):`,i),o<n&&(console.log(`[server] Retrying in ${s/1e3}s...`),await Bun.sleep(s))}console.error("[server] Model load gave up after all retries."),T.phase="ready"}var tt,Yt,nt,Xt,Qt,Kt,yr,st=S(()=>{"use strict";We();Xe();Ne();ae();tt=require("fs"),Yt=require("os"),nt=require("path");M();Pe();De();Oe();Xt={},Qt=process.env.QREC_PROJECTS_DIR??(0,nt.join)((0,Yt.homedir)(),".claude","projects"),Kt=parseInt(process.env.QREC_INDEX_INTERVAL_MS??"60000",10),yr=parseInt(process.env.QREC_ENRICH_IDLE_MS??String(300*1e3),10)});function ws(e,t=150){let n=[],s=/<mark>/g,r;for(;(r=s.exec(e))!==null;){let i=Math.max(0,r.index-t),a=e.indexOf("</mark>",r.index),l=Math.min(e.length,(a===-1?r.index:a+7)+t);n.push([i,l])}if(n.length===0)return e.slice(0,t*2);n.sort((i,a)=>i[0]-a[0]);let o=[n[0]];for(let i=1;i<n.length;i++){let a=o[o.length-1];n[i][0]<=a[1]?a[1]=Math.max(a[1],n[i][1]):o.push(n[i])}return o.map(([i,a])=>{let l=i>0?"\u2026":"",u=a<e.length?"\u2026":"",c=e.slice(i,a);return i>0&&(c=c.replace(/^[^<>]*>/,"")),c=c.replace(/<[^>]*$/,""),`${l}${c}${u}`}).join(" <span class='snippet-gap'>\u2026</span> ")}function Is(e){return(0,en.createHash)("sha256").update(e).digest("hex")}async function Ns(e,t,n){let s=Is(t),r=e.prepare("SELECT embedding FROM query_cache WHERE query_hash = ?").get(s);if(r){let l=r.embedding;return{embedding:new Float32Array(l.buffer,l.byteOffset,l.byteLength/4),cached:!0,embedMs:0}}let o=performance.now(),i=await n.embed(t),a=performance.now()-o;return e.prepare("INSERT OR REPLACE INTO query_cache (query_hash, embedding, created_at) VALUES (?, ?, ?)").run(s,Buffer.from(i.buffer),Date.now()),{embedding:i,cached:!1,embedMs:a}}async function tn(e,t,n,s=10,r){let o=performance.now(),i=performance.now(),a=[],l=n.replace(/[^a-zA-Z0-9\s'-]/g," ").replace(/\s+/g," ").trim();try{l.length>0&&(a=e.prepare("SELECT rowid, session_id, rank FROM chunks_fts WHERE text MATCH ? ORDER BY rank LIMIT ?").all(l,s*5))}catch(p){console.warn("[search] FTS5 query failed, falling back to KNN only:",p),a=[],l=""}let u=performance.now()-i,{embedding:c,embedMs:g}=await Ns(e,n,t),h=performance.now(),f=Buffer.from(c.buffer),m=e.prepare("SELECT chunk_id, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ?").all(f,s*5),d=performance.now()-h,R=performance.now(),N=new Map;if(a.length>0){let p=a.map(_=>_.rowid),b=p.map(()=>"?").join(","),y=e.prepare(`SELECT rowid, id FROM chunks WHERE rowid IN (${b})`).all(...p),I=new Map(y.map(_=>[_.rowid,_.id]));for(let _=0;_<a.length;_++){let O=I.get(a[_].rowid);O&&N.set(O,{bm25Rank:_+1,rowid:a[_].rowid})}}for(let p=0;p<m.length;p++){let b=m[p].chunk_id,y=N.get(b);y?y.vecRank=p+1:N.set(b,{vecRank:p+1})}if(r&&(r.dateFrom||r.dateTo||r.project||r.tag)){let p=new Set;for(let b of N.keys())p.add(b.split("_").slice(0,-1).join("_"));if(p.size>0){let b=[...p],I=[`id IN (${b.map(()=>"?").join(",")})`],_=[...b];r.dateFrom&&(I.push("date >= ?"),_.push(r.dateFrom)),r.dateTo&&(I.push("date <= ?"),_.push(r.dateTo)),r.project&&(I.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),_.push(r.project)),r.tag&&(I.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),_.push(r.tag));let O=e.prepare(`SELECT id FROM sessions WHERE ${I.join(" AND ")}`).all(..._),j=new Set(O.map($=>$.id));for(let[$]of N){let ee=$.split("_").slice(0,-1).join("_");j.has(ee)||N.delete($)}}}let G=new Map;for(let[p,b]of N){let y=(b.bm25Rank!==void 0?1/(Zt+b.bm25Rank):0)+(b.vecRank!==void 0?1/(Zt+b.vecRank):0);G.set(p,y)}let Q=new Map;for(let[p,b]of G){let y=p.split("_").slice(0,-1).join("_"),I=Q.get(y);(!I||b>I.score)&&Q.set(y,{score:b,bestChunkId:p})}let z=[...Q.entries()].sort((p,b)=>b[1].score-p[1].score).slice(0,s),E=performance.now()-R,L=performance.now()-o;if(z.length===0)return[];let Z=z.map(([p])=>p),oe=Z.map(()=>"?").join(","),P=e.prepare(`SELECT id, project, date, indexed_at, last_message_at, title, summary FROM sessions WHERE id IN (${oe})`).all(...Z),ie=new Map(P.map(p=>[p.id,p])),Se=z.map(([,p])=>p.bestChunkId),Fe=Se.map(()=>"?").join(","),Ue=e.prepare(`SELECT id, session_id, text FROM chunks WHERE id IN (${Fe})`).all(...Se),je=new Map(Ue.map(p=>[p.id,p])),de=new Map;if(l.length>0)for(let[,{bestChunkId:p}]of z){let b=N.get(p)?.rowid;if(b!==void 0)try{let y=e.prepare("SELECT highlight(chunks_fts, 1, '<mark>', '</mark>') as hl FROM chunks_fts WHERE chunks_fts MATCH ? AND rowid = ?").get(l,b);y?.hl&&de.set(p,y.hl)}catch(y){console.warn("[search] Highlight extraction failed:",y)}}let Te=[];for(let[p,{score:b,bestChunkId:y}]of z){let I=ie.get(p);if(!I)continue;let _=je.get(y),O=_?_.text:"",j=O.slice(0,300)+(O.length>300?"\u2026":""),$=de.get(y),ee=$?ws($):void 0;Te.push({session_id:p,score:b,preview:j,highlightedPreview:ee,project:I.project,date:I.date,indexed_at:I.indexed_at,last_message_at:I.last_message_at??null,title:I.title,summary:I.summary??null,latency:{bm25Ms:u,embedMs:g,knnMs:d,fusionMs:E,totalMs:L}})}return Te}var en,Zt,nn=S(()=>{"use strict";en=require("crypto");Zt=60});function sn(e,t,n,s,r){let o=s[0]??null;e.prepare(`
    INSERT INTO query_audit (query, k, result_count, top_session_id, top_score, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(t,n,s.length,o?.session_id??null,o?.score??null,r,Date.now())}function rn(e,t=100){return e.prepare("SELECT * FROM query_audit ORDER BY created_at DESC LIMIT ?").all(t)}var on=S(()=>{"use strict"});function $e(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function an(e){let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get();return Response.json({status:"ok",phase:T.phase,indexedSessions:t.count})}function cn(e){let t=e.prepare("SELECT COUNT(*) as n FROM sessions").get().n,n=e.prepare("SELECT COUNT(*) as n FROM chunks").get().n,s=e.prepare("SELECT MAX(indexed_at) as ts FROM sessions").get(),r=e.prepare("SELECT COUNT(*) as n FROM query_audit").get().n,o=e.prepare("SELECT COUNT(*) as n FROM sessions WHERE enriched_at IS NOT NULL AND enrichment_version >= ?").get(V).n,i=t-o;return Response.json({status:"ok",version:"0.7.4",phase:T.phase,sessions:t,chunks:n,lastIndexedAt:s.ts,searches:r,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",embedModel:process.env.QREC_EMBED_PROVIDER==="ollama"?process.env.QREC_OLLAMA_MODEL??"nomic-embed-text":process.env.QREC_EMBED_PROVIDER==="openai"?process.env.QREC_OPENAI_MODEL??"text-embedding-3-small":"gemma-300M",enrichModel:"Qwen3-1.7B",modelDownload:T.modelDownload,indexing:T.indexing,memoryMB:Math.round(process.memoryUsage().rss/1024/1024),enriching:et(),enrichedCount:o,pendingCount:i,enrichEnabled:K().enrichEnabled,enrichProgress:(()=>{try{return JSON.parse((0,rt.readFileSync)(pe,"utf-8"))}catch(a){return a.code!=="ENOENT"&&console.warn("[server] Failed to read enrich progress:",a),null}})(),compute:(()=>{let a=se();return{selectedBackend:a.selectedBackend,gpuDetected:a.gpuDetected,gpuName:a.gpuName,driverVersion:a.driverVersion,cudaDriverVersion:a.cudaDriverVersion,cudaRuntimeAvailable:a.cudaRuntimeAvailable,vulkanAvailable:a.vulkanAvailable,missingLibs:a.missingLibs,libProbes:a.libProbes,activeBinaryName:a.activeBinaryName,installSteps:a.installSteps,advice:a.advice}})()})}function ln(e){let t=e.prepare("SELECT project, MAX(date) as last_active FROM sessions WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY last_active DESC").all();return Response.json({projects:t.map(n=>n.project)})}async function dn(e,t,n){if(!t.embedder)return Response.json({error:t.embedderError??`Model not ready yet (phase: ${T.phase})`},{status:503});let s;try{s=await n.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let r=s.query?.trim();if(!r)return Response.json({error:"Missing required field: query"},{status:400});let o=s.k??10,i={};s.dateFrom&&(i.dateFrom=s.dateFrom),s.dateTo&&(i.dateTo=s.dateTo),s.project&&(i.project=s.project),s.tag&&(i.tag=s.tag);let a=performance.now();try{let l=await tn(e,t.embedder,r,o,i),u=performance.now()-a;try{sn(e,r,o,l,u)}catch(g){console.warn("[server] Failed to write audit query:",g)}let c=l[0]?.latency.totalMs??0;return Response.json({results:l,latencyMs:c})}catch(l){return console.error("[server] Search error:",l),Response.json({error:String(l)},{status:500})}}async function un(e,t){let n;try{n=await t.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let s=n.sql?.trim()??"";if(!s)return Response.json({error:"Missing required field: sql"},{status:400});if(!s.toUpperCase().startsWith("SELECT"))return Response.json({error:"Only SELECT queries are allowed"},{status:400});if(s.includes(";"))return Response.json({error:"Semicolons are not allowed (no statement stacking)"},{status:400});try{let r=e.prepare(s).all();return Response.json({rows:r,count:r.length})}catch(r){return Response.json({error:String(r)},{status:500})}}function pn(){return Response.json(K())}async function mn(e){let t;try{t=await e.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let n={};if(t.enrichEnabled!==void 0&&(n.enrichEnabled=!!t.enrichEnabled),t.enrichIdleMs!==void 0){let r=t.enrichIdleMs;if(!Number.isInteger(r)||r<6e4||r>36e5)return Response.json({error:"enrichIdleMs must be an integer between 60000 and 3600000"},{status:400});n.enrichIdleMs=r}if(t.indexIntervalMs!==void 0){let r=t.indexIntervalMs;if(!Number.isInteger(r)||r<1e4||r>36e5)return Response.json({error:"indexIntervalMs must be an integer between 10000 and 3600000"},{status:400});n.indexIntervalMs=r}let s=Ke(n);return Response.json(s)}function gn(e,t){let s=Math.max(0,parseInt(t.searchParams.get("offset")??"0",10)||0),r=t.searchParams.get("date")??null,o=r??t.searchParams.get("dateFrom")??null,i=r??t.searchParams.get("dateTo")??null,a=t.searchParams.get("project")??null,l=t.searchParams.get("tag")??null,u=[],c=[];o&&(u.push("date >= ?"),c.push(o)),i&&(u.push("date <= ?"),c.push(i)),a&&(u.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),c.push(a)),l&&(u.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),c.push(l));let g=u.length>0?`WHERE ${u.join(" AND ")}`:"",h=e.prepare(`SELECT id, title, project, date, indexed_at, last_message_at, summary, tags, entities, learnings, questions FROM sessions ${g} ORDER BY COALESCE(last_message_at, indexed_at) DESC LIMIT ? OFFSET ?`).all(...c,100,s),f=e.prepare(`SELECT COUNT(*) as count FROM sessions ${g}`).get(...c).count,m=h.map(d=>({...d,tags:d.tags?JSON.parse(d.tags):null,entities:d.entities?JSON.parse(d.entities):null,learnings:d.learnings?JSON.parse(d.learnings):null,questions:d.questions?JSON.parse(d.questions):null}));return Response.json({sessions:m,total:f,offset:s,limit:100})}async function fn(e,t){let n=e.prepare("SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?").get(t);if(!n)return Response.json({error:"Session not found"},{status:404});try{let s=await Re(n.path);return Response.json({id:n.id,title:n.title,project:n.project,date:n.date,path:n.path,summary:n.summary??null,tags:n.tags?JSON.parse(n.tags):null,entities:n.entities?JSON.parse(n.entities):null,learnings:n.learnings?JSON.parse(n.learnings):null,questions:n.questions?JSON.parse(n.questions):null,turns:s.turns})}catch(s){return console.error("[server] Failed to parse session:",s),Response.json({error:String(s)},{status:500})}}async function hn(e,t){let n=e.prepare("SELECT path, summary, tags, entities FROM sessions WHERE id = ?").get(t);if(!n)return new Response("Session not found",{status:404});try{let s=await Re(n.path),r=wt(s);if(n.summary){let o=n.tags?JSON.parse(n.tags):[],i=n.entities?JSON.parse(n.entities):[];r=["## Summary","",n.summary,"",o.length>0?`**Tags:** ${o.join(", ")}`:"",i.length>0?`**Entities:** ${i.join(", ")}`:"","","---",""].filter((l,u,c)=>!(l===""&&c[u-1]==="")).join(`
`)+r}return new Response(r,{headers:{"Content-Type":"text/plain; charset=utf-8"}})}catch(s){return console.error("[server] Failed to render session markdown:",s),new Response(String(s),{status:500})}}function En(e,t){let n=Math.min(52,Math.max(4,parseInt(t.searchParams.get("weeks")??"15",10)||15)),s=t.searchParams.get("metric")??"sessions",r=t.searchParams.get("project")??null,o=new Date;o.setDate(o.getDate()-n*7+1),o.setHours(0,0,0,0);let i=$e(o),a=r?" AND project = ?":"",l=r?[i,r]:[i],u;s==="hours"?u=e.prepare(`SELECT date, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ?${a} GROUP BY date ORDER BY date ASC`).all(...l):u=e.prepare(`SELECT date, COUNT(*) as count FROM sessions WHERE date >= ?${a} GROUP BY date ORDER BY date ASC`).all(...l);let c=new Map(u.map(d=>[d.date,d.count])),g=[],h=new Date(o),f=new Date;for(;$e(h)<=$e(f);){let d=$e(h);g.push({date:d,count:c.get(d)??0}),h.setDate(h.getDate()+1)}let m={};if(!r){let d;s==="hours"?d=e.prepare("SELECT date, project, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(i):d=e.prepare("SELECT date, project, COUNT(*) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(i);for(let R of d)m[R.date]||(m[R.date]={}),m[R.date][R.project]=R.count}return Response.json({days:g,metric:s,total:u.reduce((d,R)=>d+R.count,0),active_days:u.filter(d=>d.count>0).length,byProject:m})}function bn(e,t){let n=parseInt(t.searchParams.get("limit")??"100",10);try{let s=rn(e,n);return Response.json({entries:s})}catch(s){return Response.json({error:String(s)},{status:500})}}function Rn(e){let t=parseInt(e.searchParams.get("limit")??"100",10),n=ut(t);return Response.json({entries:n})}function yn(e){let t=parseInt(e.searchParams.get("lines")??"100",10);try{let s=(0,rt.readFileSync)(q,"utf-8").split(`
`).filter(r=>r.length>0).slice(-t);return Response.json({lines:s})}catch{return Response.json({lines:[]})}}function _n(){return Response.json({dbPath:He,logPath:q,modelCachePath:J,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",ollamaHost:process.env.QREC_OLLAMA_HOST??null,ollamaModel:process.env.QREC_OLLAMA_MODEL??null,openaiBaseUrl:process.env.QREC_OPENAI_BASE_URL??null,indexIntervalMs:Kt,port:D(),platform:process.platform,bunVersion:process.versions.bun??null,nodeVersion:process.version})}var rt,Sn=S(()=>{"use strict";st();nn();on();Je();Ne();ae();De();Pe();M();fe();rt=require("fs");Oe()});var Os={};async function vs(){if(xn!==null)return new Response(xn,{headers:{"Content-Type":"text/html; charset=utf-8"}});if(!(0,Nn.existsSync)(In))return Response.json({error:"UI not found"},{status:404});let e=await Bun.file(In).text();return new Response(e,{headers:{"Content-Type":"text/html; charset=utf-8"}})}async function As(e){let t=e.slice(4);if(t.includes("..")||t.startsWith("/"))return new Response("Forbidden",{status:403});let n=(0,_e.join)(vn,t),s=Bun.file(n);if(!await s.exists())return new Response("Not found",{status:404});let r=t.split(".").pop()?.toLowerCase()??"",o=r==="css"?"text/css; charset=utf-8":r==="js"?"text/javascript; charset=utf-8":r==="woff2"?"font/woff2":r==="woff"?"font/woff":r==="ttf"?"font/ttf":"application/octet-stream";return new Response(s,{headers:{"Content-Type":o,"Cache-Control":"no-cache, no-store, must-revalidate"}})}async function Ls(){console.log("[server] Starting qrec server..."),$t();let e=te(),t={embedder:null,embedderError:null,isIndexing:!1},n=Bun.serve({port:Tn,async fetch(s){let r=new URL(s.url),{method:o}=s,{pathname:i}=r;if(o==="GET"&&i==="/health")return an(e);if(o==="GET"&&i==="/status")return cn(e);if(o==="GET"&&i==="/projects")return ln(e);if(o==="GET"&&i==="/stats/heatmap")return En(e,r);if(o==="GET"&&i==="/sessions")return gn(e,r);if(o==="GET"&&i.startsWith("/sessions/")&&i.endsWith("/markdown")){let a=i.slice(10,-9);return a?hn(e,a):Response.json({error:"Not found"},{status:404})}if(o==="GET"&&i.startsWith("/sessions/")){let a=i.slice(10);return!a||a.includes("/")?Response.json({error:"Not found"},{status:404}):fn(e,a)}return o==="POST"&&i==="/search"?dn(e,t,s):o==="POST"&&i==="/query_db"?un(e,s):o==="GET"&&i==="/settings"?pn():o==="POST"&&i==="/settings"?mn(s):o==="GET"&&i==="/audit/entries"?bn(e,r):o==="GET"&&i==="/activity/entries"?Rn(r):o==="GET"&&i.startsWith("/ui/")?As(i):o==="GET"&&(i==="/"||i==="/search"||i==="/audit"||i==="/debug")?vs():o==="GET"&&i==="/debug/log"?yn(r):o==="GET"&&i==="/debug/config"?_n():Response.json({error:"Not found"},{status:404})}});console.log(`[server] Listening on http://localhost:${Tn}`),v({type:"daemon_started"}),zt(e,t),process.on("SIGTERM",()=>{console.log("[server] SIGTERM received, shutting down..."),e.close(),n.stop(),process.exit(0)}),process.on("SIGINT",()=>{console.log("[server] SIGINT received, shutting down..."),e.close(),n.stop(),process.exit(0)})}var Nn,_e,Ds,Tn,xn,wn,vn,In,An=S(()=>{"use strict";fe();De();M();ae();Nn=require("fs"),_e=require("path");st();Sn();Ds={},Tn=D(),xn=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>qrec</title>
<link rel="stylesheet" href="/ui/styles.css">
<script src="https://cdn.jsdelivr.net/npm/marked@13/marked.min.js"></script>
</head>
<body>
<header>
  <div class="logo" onclick="showTab('dashboard')" style="cursor:pointer;">q</div>
  <h1 onclick="showTab('dashboard')" style="cursor:pointer;">qrec</h1>
  <nav>
    <button id="nav-dashboard" onclick="showTab('dashboard')">Dashboard</button>
    <button id="nav-sessions" onclick="showTab('sessions')">Search</button>
    <button id="nav-debug" onclick="showTab('debug')">Debug</button>
    <button id="nav-settings" onclick="showTab('settings')">Settings</button>
  </nav>
</header>

<!-- \u2500\u2500 Dashboard tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-dashboard" class="tab-panel">
<main>
  <div id="db-loading" class="loading-state"><span class="spinner"></span></div>
  <div id="db-error" class="error-state" style="display:none;"></div>

  <div class="dashboard-wrap" id="dashboard">
    <div class="dashboard-header">
      <h2 class="section-heading">Dashboard</h2>
    </div>

    <div class="dashboard-top">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Sessions <span class="stat-indexing-dot" id="stat-sessions-dot"></span></div>
          <div class="stat-value" id="stat-sessions">\u2014</div>
          <div class="stat-sub">indexed</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">AI Summaries <span class="stat-indexing-dot" id="stat-enrich-dot"></span></div>
          <div class="stat-value" id="info-ai-summaries">\u2014</div>
          <div class="stat-sub" id="info-ai-summaries-sub"></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Searches</div>
          <div class="stat-value" id="stat-searches">\u2014</div>
          <div class="stat-sub">queries run</div>
        </div>
      </div>
      <div class="dashboard-heatmap-col" id="dashboard-heatmap-section" style="display:none;">
        <div class="heatmap-controls">
          <div id="heatmap-metric-btns"></div>
          <div class="filter-wrap">
            <button class="btn heatmap-project-btn" id="heatmap-project-btn"
                    onclick="toggleHeatmapProjectDropdown()"
                    onblur="hideHeatmapProjectDropdown()">All projects \u25BE</button>
            <div class="filter-dropdown" id="heatmap-dropdown-project" onmousedown="return false;"></div>
          </div>
        </div>
        <div id="dashboard-heatmap"></div>
        <div class="heatmap-footer" id="dashboard-heatmap-footer"></div>
      </div>
    </div>

    <div class="dashboard-recent">
      <div class="dashboard-recent-header">
        <span class="section-heading" style="cursor:pointer;" onclick="showTab('sessions')">Recent Sessions</span>
      </div>
      <div id="dashboard-recent-list"></div>
    </div>

    <div class="activity-section" id="db-activity-feed">
      <div class="activity-section-header">
        <span class="section-heading">Recent Activity</span>
        <span class="activity-live-dot" id="activity-live-dot"></span>
      </div>
      <div class="run-list" id="run-list"></div>
      <button class="show-more-btn" id="activity-show-more" style="display:none;" onclick="showMoreRuns()">Show older entries</button>
    </div>

    <div class="last-updated" id="db-last-updated"></div>
  </div> <!-- /.dashboard-wrap -->
</main>
</div>

<!-- \u2500\u2500 Sessions tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-sessions" class="tab-panel">
<main>
  <div class="page-header">
    <h2 class="section-heading">Sessions</h2>
    <span class="badge" id="sessions-count">\u2014</span>
  </div>
  <div class="search-bar">
    <input type="text" id="query" placeholder="Search sessions\u2026">
    <button id="search-btn" onclick="doSearch()">Search</button>
    <button class="btn" id="clear-search-btn" onclick="clearSearch()" style="display:none;">\u2715</button>
  </div>
  <div id="latency-bar" class="latency-bar" style="display:none;"></div>
  <div class="sessions-toolbar">
    <div class="sessions-filters">
      <div class="filter-wrap">
        <input type="text" class="sessions-filter" id="filter-project"
               placeholder="Project\u2026" autocomplete="off"
               oninput="handleFilterInput(this,'project')" onchange="applyFilters()"
               onfocus="showFilterDropdown('project')" onblur="hideFilterDropdown('project')">
        <div class="filter-dropdown" id="dropdown-project" onmousedown="return false;"></div>
      </div>
      <div class="filter-wrap">
        <input type="text" class="sessions-filter" id="filter-tag"
               placeholder="Tag\u2026" autocomplete="off"
               oninput="handleFilterInput(this,'tag')" onchange="applyFilters()"
               onfocus="showFilterDropdown('tag')" onblur="hideFilterDropdown('tag')">
        <div class="filter-dropdown" id="dropdown-tag" onmousedown="return false;"></div>
      </div>
      <div class="filter-wrap" id="date-filter-wrap">
        <button class="btn date-btn" id="date-btn" onclick="toggleDatePicker(event)">Date \u25BE</button>
        <div class="date-picker-dropdown" id="date-picker-dropdown" style="display:none;" onmousedown="return false;">
          <div class="date-picker-presets">
            <button class="btn date-preset" data-preset="today" onclick="setDatePreset('today')">Today</button>
            <button class="btn date-preset" data-preset="week" onclick="setDatePreset('week')">This week</button>
            <button class="btn date-preset" data-preset="month" onclick="setDatePreset('month')">This month</button>
          </div>
          <div class="date-picker-sep"></div>
          <div class="date-picker-custom">
            <div class="date-picker-row">
              <label class="date-picker-label">From</label>
              <input type="date" id="date-from" class="date-input">
            </div>
            <div class="date-picker-row">
              <label class="date-picker-label">To</label>
              <input type="date" id="date-to" class="date-input">
            </div>
            <button class="btn date-apply-btn" onclick="applyCustomDateRange()">Apply</button>
          </div>
        </div>
      </div>
      <button class="btn" id="clear-filters-btn" onclick="clearFilters()" style="display:none;">Clear</button>
    </div>
    <div class="filter-wrap">
      <button class="btn fields-btn" id="fields-btn" onclick="toggleFieldsPicker()">Fields \u25BE</button>
      <div class="fields-picker" id="fields-picker" style="display:none;" onmousedown="return false;">
        <div class="fields-picker-title">Preview fields</div>
        <label class="fields-option"><input type="checkbox" id="field-summary" onchange="onFieldChange()"> Summary</label>
        <label class="fields-option"><input type="checkbox" id="field-tags" onchange="onFieldChange()"> Tags</label>
        <label class="fields-option"><input type="checkbox" id="field-entities" onchange="onFieldChange()"> Entities</label>
        <label class="fields-option"><input type="checkbox" id="field-learnings" onchange="onFieldChange()"> Learnings</label>
        <label class="fields-option"><input type="checkbox" id="field-questions" onchange="onFieldChange()"> Questions</label>
      </div>
    </div>
  </div>
  <div id="sessions-content">
    <div class="loading-state"><span class="spinner"></span></div>
  </div>
</main>
</div>

<!-- \u2500\u2500 Session detail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-session-detail" class="tab-panel">
<main style="max-width:860px;">
  <div id="detail-loading" class="loading-state"><span class="spinner"></span></div>
  <div id="detail-error" class="error-state" style="display:none;"></div>
  <div id="detail-content" style="display:none;">
    <div class="detail-header">
      <div class="detail-title" id="detail-title"></div>
    </div>
    <div class="detail-meta" id="detail-meta"></div>
    <div class="turns" id="detail-turns"></div>
  </div>
</main>
</div>

<!-- \u2500\u2500 Debug tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-debug" class="tab-panel">
<main>
  <div class="page-header">
    <h2 class="section-heading">Debug</h2>
  </div>
  <div class="debug-sections">

    <div class="section">
      <div class="section-header">
        <span class="section-title">Live stats</span>
        <span class="meta-line"><span id="dbg-version" style="font-family:var(--mono)">\u2014</span> \xB7 <span id="dbg-stats-meta">Loading\u2026</span></span>
      </div>
      <div class="stats-strip">
        <div class="stat-item"><div class="label">Sessions</div><div class="value" id="dbg-sessions">\u2014</div></div>
        <div class="stat-item"><div class="label">Chunks</div><div class="value" id="dbg-chunks">\u2014</div></div>
        <div class="stat-item"><div class="label">Searches</div><div class="value" id="dbg-searches">\u2014</div></div>
        <div class="stat-item"><div class="label">Provider</div><div class="value" id="dbg-provider" style="font-size:13px;font-family:'Menlo',monospace;">\u2014</div></div>
      </div>
    </div>

    <div class="section" id="dbg-compute-section">
      <div class="section-header">
        <span class="section-title">Compute</span>
        <span class="meta-line" id="dbg-compute-meta"></span>
      </div>
      <div id="dbg-compute-body">
        <table class="config-table"><tr><td colspan="2" style="padding:16px;color:var(--text-muted);font-size:13px;"><span class="spinner"></span> Loading\u2026</td></tr></table>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">Server log</span>
        <div class="section-actions">
          <span class="meta-line" id="dbg-log-meta">Loading\u2026</span>
          <button class="btn" onclick="fetchLog()">Refresh</button>
          <button class="btn" id="autoscroll-btn" onclick="toggleAutoscroll()">Autoscroll: on</button>
        </div>
      </div>
      <div class="log-body" id="dbg-log-body">
        <span class="log-empty">Loading log\u2026</span>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><span class="section-title">Configuration</span></div>
      <table class="config-table" id="dbg-config-table">
        <tr><td colspan="2" style="padding:20px;color:var(--text-muted);font-size:13px;"><span class="spinner"></span> Loading\u2026</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-header"><span class="section-title">Test tools</span></div>
      <div class="tool-grid">
        <div class="tool-row">
          <div class="tool-desc">
            Health check
            <small>GET /health \u2014 verifies the server is responding.</small>
          </div>
          <button class="btn" onclick="runHealth()">Run</button>
        </div>
        <div class="tool-row">
          <div class="tool-desc">
            Test search
            <small>POST /search \u2014 sends a sample query and shows raw JSON response.</small>
          </div>
          <button class="btn" onclick="runSearch()">Run</button>
        </div>
      </div>
      <div id="tool-output" style="display:none;padding:14px 16px;background:var(--bg2);border-top:1px solid var(--border);">
        <pre id="tool-pre" style="font-family:'Menlo',monospace;font-size:11.5px;white-space:pre-wrap;word-break:break-all;color:var(--text);max-height:200px;overflow:auto;"></pre>
      </div>
    </div>

  </div>
</main>
</div>

<!-- \u2500\u2500 Settings tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-settings" class="tab-panel">
<main>
  <div class="page-header">
    <h2 class="section-heading">Settings</h2>
  </div>
  <div class="settings-wrap">

    <div class="section">
      <div class="section-header"><span class="section-title">Enrichment</span></div>
      <div class="settings-body">
        <div class="settings-row">
          <div class="settings-row-label">
            <span class="settings-row-name">AI Summaries</span>
            <span class="settings-row-desc">Generate summaries, tags, and entities for indexed sessions</span>
          </div>
          <label class="toggle">
            <input type="checkbox" id="setting-enrich-enabled">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">
            <span class="settings-row-name">Enrich delay</span>
            <span class="settings-row-desc">Wait this long after a session ends before enriching it</span>
          </div>
          <select id="setting-enrich-idle" class="settings-select">
            <option value="60000">1 min</option>
            <option value="300000">5 min (default)</option>
            <option value="900000">15 min</option>
            <option value="1800000">30 min</option>
            <option value="3600000">1 hour</option>
          </select>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">Indexing</span>
        <span class="restart-badge">\u26A0 restart required to apply</span>
      </div>
      <div class="settings-body">
        <div class="settings-row">
          <div class="settings-row-label">
            <span class="settings-row-name">Scan interval</span>
            <span class="settings-row-desc">How often to check for new or changed sessions</span>
          </div>
          <select id="setting-index-interval" class="settings-select">
            <option value="30000">30 sec</option>
            <option value="60000">1 min (default)</option>
            <option value="300000">5 min</option>
            <option value="900000">15 min</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-actions">
      <button class="btn btn-primary" id="settings-save-btn" onclick="saveSettingsForm()">Save settings</button>
      <span class="settings-feedback" id="settings-feedback"></span>
    </div>

  </div>
</main>
</div>

<script src="/ui/activity-groups.js"></script>
<script src="/ui/app.js"></script>
</body>
</html>
`,wn=Ds.dir,vn=wn?(0,_e.join)(wn,"..","ui"):(0,_e.join)(__dirname,"..","..","ui"),In=(0,_e.join)(vn,"index.html");Ls().catch(e=>{console.error("[server] Fatal error:",e),process.exit(1)})});fe();Xe();Qe();var Ot=require("path"),A=require("fs");M();var Lt={};function ds(){(0,A.mkdirSync)(w,{recursive:!0})}function Dt(){if(!(0,A.existsSync)(W))return!1;let e=parseInt((0,A.readFileSync)(W,"utf-8").trim(),10);if(isNaN(e))return!1;try{return process.kill(e,0),!0}catch{try{(0,A.unlinkSync)(W)}catch{}return!1}}function Le(){if(!(0,A.existsSync)(W))return null;let e=parseInt((0,A.readFileSync)(W,"utf-8").trim(),10);return isNaN(e)?null:e}async function Ct(){if(Dt()){let a=Le();console.log(`[daemon] qrec server already running (PID ${a})`);return}try{let a=[],l=Bun.spawnSync(["lsof","-ti",`:${D()}`],{stdio:["ignore","pipe","ignore"]});if(l.exitCode===0)a=new TextDecoder().decode(l.stdout).trim().split(`
`).filter(Boolean);else{let u=Bun.spawnSync(["ss","-tlnp",`sport = :${D()}`],{stdio:["ignore","pipe","ignore"]}),g=new TextDecoder().decode(u.stdout).match(/pid=(\d+)/g);g&&(a=g.map(h=>h.replace("pid=","")))}for(let u of a)try{process.kill(parseInt(u),"SIGKILL")}catch{}a.length>0&&await Bun.sleep(300)}catch{}ds();let e=q;try{(0,A.writeFileSync)(e,"")}catch{}let t=typeof Lt.dir=="string"?["bun","run",(0,Ot.join)(Lt.dir,"server.ts")]:[process.argv[0],process.argv[1],"serve"],n=Bun.spawn(t,{detached:!0,stdio:["ignore",Bun.file(e),Bun.file(e)],env:process.env}),s=n.pid;(0,A.writeFileSync)(W,String(s),"utf-8"),n.unref(),console.log(`[daemon] qrec server started (PID ${s})`),console.log(`[daemon] Logs: ${e}`),console.log("[daemon] Waiting for server to be ready...");let r=parseInt(process.env.QREC_DAEMON_TIMEOUT_MS??"120000",10),o=Date.now()+r,i=!1;for(;Date.now()<o;){await Bun.sleep(500);try{if((await fetch(`http://localhost:${D()}/health`)).ok){i=!0;break}}catch{}}i?console.log(`[daemon] Server ready at http://localhost:${D()}`):(console.error(`[daemon] Server failed to start within 30 seconds. Check logs: ${e}`),process.exit(1))}async function Ye(){if(!Dt()){console.log("[daemon] No running qrec server found.");return}let e=Le();try{process.kill(e,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to PID ${e}`);let t=Date.now()+5e3;for(;Date.now()<t;){await Bun.sleep(200);try{process.kill(e,0)}catch{break}}}catch(t){console.error(`[daemon] Failed to send SIGTERM: ${t}`)}try{let t=(0,A.existsSync)(B)?(0,A.readFileSync)(B,"utf8").trim():null,n=t?parseInt(t,10):null;n&&(process.kill(n,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to enrich PID ${n}`))}catch{}try{(0,A.unlinkSync)(B)}catch{}try{(0,A.unlinkSync)(W)}catch{}console.log("[daemon] qrec server stopped.")}var re=require("fs"),Dn=require("os");M();Oe();var[,,Ln,...x]=process.argv;{let e=x.indexOf("--port");if(e!==-1){let t=x[e+1];(!t||isNaN(parseInt(t,10)))&&(console.error("[cli] --port requires a numeric value"),process.exit(1)),process.env.QREC_PORT=t,x.splice(e,2)}}function Cs(e=20){if(!(0,re.existsSync)(q))return[];try{return(0,re.readFileSync)(q,"utf-8").split(`
`).filter(s=>s.length>0).slice(-e)}catch{return[]}}function On(){let e=process.platform==="darwin"?"open":"xdg-open";try{Bun.spawnSync([e,`http://localhost:${D()}`])}catch{}}async function ks(){switch(Ln){case"--version":case"-v":console.log("qrec 0.7.4"),process.exit(0);case"teardown":{let e=x.includes("--yes");await Ye(),(0,re.existsSync)(w)||(console.log("[teardown] ~/.qrec/ not found, nothing to remove."),process.exit(0)),e||(process.stdout.write(`[teardown] Remove ${w} (DB, model, logs, pid, activity log)? [y/N] `),(await new Promise(n=>{process.stdin.setEncoding("utf-8"),process.stdin.once("data",s=>n(String(s).trim()))})).toLowerCase()!=="y"&&(console.log("[teardown] Aborted."),process.exit(0))),(0,re.rmSync)(w,{recursive:!0,force:!0}),console.log("[teardown] Removed ~/.qrec/"),process.exit(0)}case"index":{let e,t=!1,n,s;if(!x[0]&&!process.stdin.isTTY){let o=await Bun.stdin.text();try{let i=JSON.parse(o.trim());if(!i.transcript_path)throw new Error("Missing transcript_path");e=i.transcript_path}catch(i){console.error(`[cli] index: failed to parse stdin: ${i}`),process.exit(1)}}else{let o=x.find(l=>!l.startsWith("--"))??`${(0,Dn.homedir)()}/.claude/projects/`;t=x.includes("--force");let i=x.indexOf("--sessions");n=i!==-1?parseInt(x[i+1],10):void 0;let a=x.indexOf("--seed");s=a!==-1?parseInt(x[a+1],10):void 0,e=o.replace("~",process.env.HOME??"")}console.log(`[cli] Indexing: ${e}${n?` (${n} sessions, seed=${s??42})`:""}`);let r=te();try{await ye(r,e,{force:t,sessions:n,seed:s})}finally{r.close(),await Ve()}process.exit(0)}case"serve":{let e=x.includes("--daemon"),t=x.includes("--no-open");e?(await Ct(),t||On()):(t||setTimeout(On,1e3),await Promise.resolve().then(()=>(An(),Os)));break}case"stop":{await Ye();break}case"search":{let e=x.filter(r=>!r.startsWith("--")).join(" ").trim();e||(console.error('[cli] Usage: qrec search "<query>" [--k N]'),process.exit(1));let t=x.indexOf("--k"),n=t!==-1?parseInt(x[t+1],10):10,s=await fetch(`http://localhost:${D()}/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,k:n})});if(!s.ok){let r=await s.json().catch(()=>({}));console.error(`[cli] search failed (${s.status}): ${r.error??"unknown error"}`),process.exit(1)}console.log(JSON.stringify(await s.json(),null,2)),process.exit(0)}case"get":{let e=x[0]?.trim();e||(console.error("[cli] Usage: qrec get <session-id>"),process.exit(1));let t=await fetch(`http://localhost:${D()}/sessions/${e}/markdown`);t.status===404&&(console.error(`[cli] Session not found: ${e}`),process.exit(1)),t.ok||(console.error(`[cli] get failed (${t.status})`),process.exit(1)),console.log(await t.text()),process.exit(0)}case"status":{let e=te();try{let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get(),n=e.prepare("SELECT COUNT(*) as count FROM chunks").get(),s=e.prepare("SELECT MAX(indexed_at) as last FROM sessions").get(),r=Le(),o=r!==null,i="not checked";if(o)try{let c=await fetch(`http://localhost:${D()}/health`);c.ok?i=(await c.json()).status??"unknown":i=`http error ${c.status}`}catch{i="unreachable"}let a=s.last?new Date(s.last).toISOString():"never",l="0.7.4";if(console.log("=== qrec status ==="),console.log(`Version:        ${l}`),console.log(`Daemon PID:     ${r??"not running"}`),console.log(`HTTP health:    ${i}`),console.log(`Sessions:       ${t.count}`),console.log(`Chunks:         ${n.count}`),console.log(`Last indexed:   ${a}`),process.platform==="linux"){let c=se();console.log(""),console.log("--- Compute ---");let g=c.selectedBackend==="cpu"&&c.gpuDetected?" (fallback \u2014 CUDA libs missing)":"";console.log(`Backend:        ${c.selectedBackend}${g}`),c.gpuDetected?(console.log(`GPU:            ${c.gpuName} (driver ${c.driverVersion}, CUDA ${c.cudaDriverVersion})`),console.log(`CUDA runtime:   ${c.cudaRuntimeAvailable?"available":"NOT AVAILABLE"}`),c.cudaRuntimeAvailable?console.log(`Binary:         ${c.activeBinaryName}`):(console.log(`  Missing libs: ${c.missingLibs.join(", ")}`),c.installSteps&&(console.log("  Fix:"),c.installSteps.forEach((h,f)=>console.log(`    ${f+1}. ${h}`))))):console.log("GPU:            none detected"),c.vulkanAvailable&&console.log("Vulkan:         available")}console.log(""),console.log("--- Log tail (last 20 lines) ---");let u=Cs(20);if(u.length===0)console.log("(no log entries)");else for(let c of u)console.log(c)}finally{e.close()}process.exit(0)}case"enrich":{let e=x.indexOf("--limit"),t=e!==-1?parseInt(x[e+1],10):void 0,n=x.indexOf("--min-age-ms"),s=n!==-1?parseInt(x[n+1],10):void 0,r=x.includes("--force"),{runEnrich:o}=await Promise.resolve().then(()=>(Pe(),Vt));await o({limit:t,minAgeMs:s,force:r}),process.exit(0)}case"doctor":{let e=se();console.log("=== qrec doctor ==="),console.log(""),process.platform!=="linux"&&(console.log(`Platform: ${process.platform}`),console.log("Metal/GPU acceleration is handled automatically by node-llama-cpp on macOS."),console.log("No CUDA probe needed."),process.exit(0));let t=r=>`[check] ${r}`,n=r=>`[FAIL]  ${r}`,s=r=>`        ${r}`;e.gpuDetected?console.log(t(`NVIDIA GPU ............ ${e.gpuName} (driver ${e.driverVersion}, CUDA ${e.cudaDriverVersion})`)):console.log(n("NVIDIA GPU ............ not detected (nvidia-smi not found or no output)"));for(let[r,o]of Object.entries(e.libProbes))o.found?console.log(t(`${r.padEnd(14)} .... .so.${o.soVersion} at ${o.path}`)):console.log(n(`${r.padEnd(14)} .... NOT FOUND`));e.vulkanAvailable?console.log(t("Vulkan ................ available")):console.log(t("Vulkan ................ not found (optional)")),e.activeBinaryName&&console.log(t(`node-llama-cpp binary . ${e.activeBinaryName}`)),console.log(""),e.cudaRuntimeAvailable?console.log(`Result: CUDA backend ready (${e.activeBinaryName})`):e.gpuDetected?(console.log("Result: CUDA libs missing \u2014 running on CPU (fallback)"),console.log(""),console.log("Fix:"),e.installSteps&&e.installSteps.forEach((r,o)=>console.log(`  ${o+1}. ${r}`)),e.cudaRepoConfigured===!1&&(console.log(""),console.log(s("Note: NVIDIA apt repo not found in /etc/apt/sources.list.d/")),console.log(s("      The wget step above adds it. Run apt-get update after.")))):console.log("Result: No NVIDIA GPU detected \u2014 running on CPU"),process.exit(0)}default:console.error(`Unknown command: ${Ln}`),console.error("Usage:"),console.error("  qrec teardown [--yes]             # remove all qrec data"),console.error("  qrec index [path] [--force]       # default: ~/.claude/projects/"),console.error("  qrec index                        # stdin JSON {transcript_path} (hook mode)"),console.error("  qrec serve [--daemon] [--no-open] [--port N]"),console.error("  qrec stop"),console.error('  qrec search "<query>" [--k N]   # search indexed sessions'),console.error("  qrec get <session-id>            # print full session markdown"),console.error("  qrec status"),console.error("  qrec enrich [--limit N]           # summarize unenriched sessions"),console.error("  qrec doctor                       # diagnose GPU/CUDA setup"),process.exit(1)}}ks().catch(e=>{console.error("Fatal error:",e),process.exit(1)});
