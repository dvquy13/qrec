#!/usr/bin/env bun
"use strict";var Pn=Object.create;var qe=Object.defineProperty;var $n=Object.getOwnPropertyDescriptor;var Fn=Object.getOwnPropertyNames;var jn=Object.getPrototypeOf,Un=Object.prototype.hasOwnProperty;var T=(e,t)=>()=>(e&&(t=e(e=0)),t);var pe=(e,t)=>{for(var n in t)qe(e,n,{get:t[n],enumerable:!0})},Bn=(e,t,n,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of Fn(t))!Un.call(e,r)&&r!==n&&qe(e,r,{get:()=>t[r],enumerable:!(s=$n(t,r))||s.enumerable});return e};var xe=(e,t,n)=>(n=e!=null?Pn(jn(e)):{},Bn(t||!e||!e.__esModule?qe(n,"default",{value:e,enumerable:!0}):n,e));function D(){return parseInt(process.env.QREC_PORT??"25927",10)}var F,it,w,$s,at,W,B,me,q,we,ge,J,fe,M=T(()=>{"use strict";F=require("path"),it=require("os"),w=process.env.QREC_DIR??(0,F.join)((0,it.homedir)(),".qrec"),$s=parseInt(process.env.QREC_PORT??"25927",10);at=(0,F.join)(w,"qrec.db"),W=(0,F.join)(w,"qrec.pid"),B=(0,F.join)(w,"enrich.pid"),me=(0,F.join)(w,"enrich-progress.json"),q=(0,F.join)(w,"qrec.log"),we=(0,F.join)(w,"activity.jsonl"),ge=(0,F.join)(w,"config.json"),J=(0,F.join)(w,"models"),fe=(0,F.join)(w,"archive")});function qn(){let e=process.env.BREW_PREFIX||process.env.HOMEBREW_PREFIX,t=[];e&&(t.push(`${e}/opt/sqlite/lib/libsqlite3.dylib`),t.push(`${e}/lib/libsqlite3.dylib`)),t.push("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib"),t.push("/usr/local/opt/sqlite/lib/libsqlite3.dylib");for(let n of t)try{if((0,Ie.statSync)(n).size>0)return n}catch{}return null}function te(e=Ge){let t=e.replace(/\/[^/]+$/,"");(0,Ie.mkdirSync)(t,{recursive:!0});let n=new He.Database(e);return n.loadExtension(Hn),n.exec("PRAGMA journal_mode = WAL"),n.exec("PRAGMA synchronous = NORMAL"),n.exec("PRAGMA cache_size = -32000"),n.exec("PRAGMA foreign_keys = ON"),Gn(n),n}function Gn(e){e.exec(`
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
  `)}var He,ct,Ie,Ge,Hn,he=T(()=>{"use strict";He=require("bun:sqlite"),ct=require("sqlite-vec"),Ie=require("fs");M();Ge=at;if(process.platform==="darwin"){let e=qn();if(!e)throw new Error(`sqlite-vec requires a Homebrew SQLite build that supports dynamic extension loading. Install with: brew install sqlite
Then set BREW_PREFIX if Homebrew is in a non-standard location.`);He.Database.setCustomSQLite(e)}Hn=(0,ct.getLoadablePath)()});function dt(e){if(e.length<=3600)return[{text:e,pos:0}];let t=Vn(e),n=[],s="",r=0;for(let o of t){let i=s?s+`

`+o.text:o.text;if(i.length<=3600)s||(r=o.pos),s=i;else if(s){n.push({text:s.trim(),pos:r});let a=s.slice(-lt),c=r+s.length-a.length;s=a+`

`+o.text,r=c}else{let a=Qn(o.text,o.pos);if(a.length>1){for(let d=0;d<a.length-1;d++)n.push(a[d]);let c=a[a.length-1];s=c.text,r=c.pos}else s=o.text,r=o.pos}}return s.trim()&&n.push({text:s.trim(),pos:r}),n}function Vn(e){let t=/^(#{1,6} .+)$/m,n=[],s=0,r=[],o,i=/^(#{1,6} .+)$/gm;for(;(o=i.exec(e))!==null;)o.index>0&&r.push(o.index);if(r.length===0)return[{text:e,pos:0}];for(let c of r){let d=e.slice(s,c);d.trim()&&n.push({text:d.trim(),pos:s}),s=c}let a=e.slice(s);return a.trim()&&n.push({text:a.trim(),pos:s}),n.length>0?n:[{text:e,pos:0}]}function Qn(e,t){let n=[],s=0;for(;s<e.length;){let r=s+3600;if(r>=e.length){n.push({text:e.slice(s).trim(),pos:t+s});break}let o=e.lastIndexOf(`

`,r);if(o>s+3600*.5)r=o;else{let i=e.lastIndexOf(`
`,r);i>s+3600*.5&&(r=i)}n.push({text:e.slice(s,r).trim(),pos:t+s}),s=Math.max(s+1,r-lt)}return n}var lt,ut=T(()=>{"use strict";lt=Math.floor(540)});var x,Ne=T(()=>{"use strict";x={phase:"starting",modelDownload:{percent:0,downloadedMB:0,totalMB:null},indexing:{indexed:0,total:0,current:""}}});function v(e){let t={ts:Date.now(),...e};try{(0,X.mkdirSync)(w,{recursive:!0}),(0,X.appendFileSync)(we,JSON.stringify(t)+`
`,"utf-8")}catch(n){console.warn("[activity] Failed to write activity log:",n)}}function pt(e=100){if(!(0,X.existsSync)(we))return[];try{return(0,X.readFileSync)(we,"utf-8").split(`
`).filter(s=>s.trim().length>0).map(s=>{try{return JSON.parse(s)}catch{return null}}).filter(s=>s!==null).slice(-e).reverse()}catch(t){return console.warn("[activity] Failed to read activity log:",t),[]}}var X,ce=T(()=>{"use strict";X=require("fs");M()});var ht={};pe(ht,{disposeEmbedder:()=>Qe,getEmbedder:()=>Xn});async function Wn(){if(!process.env.QREC_DIR&&(0,ve.existsSync)(Ve))return console.log(`[embed] Found model at legacy path: ${Ve}`),Ve;console.log(`[embed] Resolving model: ${mt}`),(0,ve.mkdirSync)(J,{recursive:!0}),x.phase="model_download",x.modelDownload={percent:0,downloadedMB:0,totalMB:null};let{resolveModelFile:e}=await import("node-llama-cpp"),t=await e(mt,{directory:J,onProgress({totalSize:n,downloadedSize:s}){x.modelDownload={percent:n?Math.round(s/n*100):0,downloadedMB:+(s/1048576).toFixed(1),totalMB:n?+(n/1048576).toFixed(1):null}}});return console.log(`[embed] Model ready at ${t}`),x.modelDownload.totalMB!==null&&v({type:"embed_model_downloaded",data:{totalMB:x.modelDownload.totalMB}}),t}async function Jn(){let e=await Wn();x.phase="model_loading",console.log(`[embed] Loading model from ${e}`);let{getLlama:t}=await import("node-llama-cpp");be=await t();let s=await(await be.loadModel({modelPath:e})).createEmbeddingContext({contextSize:8192});return console.log("[embed] Model loaded, embedding dimensions: 768"),s}async function Qe(){le&&(await le.dispose(),le=null),be&&(await be.dispose(),be=null,Ee=null)}async function Xn(){return Ee||(Ee=Jn().catch(e=>{throw Ee=null,e})),le||(le=await Ee),{dimensions:768,async embed(e){let t=le,n=24e3,s=e.length>n?e.slice(0,n):e;s!==e&&console.warn(`[embed] Truncated chunk from ${e.length} to ${n} chars`);let r=await t.getEmbeddingFor(s);return new Float32Array(r.vector)}}}var gt,ft,ve,mt,Ve,be,le,Ee,We=T(()=>{"use strict";gt=require("path"),ft=require("os"),ve=require("fs");M();Ne();ce();mt="hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",Ve=(0,gt.join)((0,ft.homedir)(),".cache","qmd","models","hf_ggml-org_embeddinggemma-300M-Q8_0.gguf"),be=null,le=null,Ee=null});var Et={};pe(Et,{getOllamaEmbedder:()=>zn});function zn(){let e=process.env.QREC_OLLAMA_HOST??Yn,t=process.env.QREC_OLLAMA_MODEL??Kn;return console.log(`[embed/ollama] Using Ollama at ${e}, model: ${t}`),{dimensions:768,async embed(n){let s=await fetch(`${e}/api/embeddings`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:t,prompt:n})});if(!s.ok){let o=await s.text().catch(()=>"");throw new Error(`Ollama embeddings request failed: HTTP ${s.status} \u2014 ${o}`)}let r=await s.json();if(!Array.isArray(r.embedding)||r.embedding.length===0)throw new Error("Ollama returned empty or invalid embedding");return new Float32Array(r.embedding)}}}var Yn,Kn,bt=T(()=>{"use strict";Yn="http://localhost:11434",Kn="nomic-embed-text"});var Rt={};pe(Rt,{getOpenAIEmbedder:()=>ts});function ts(){let e=process.env.QREC_OPENAI_KEY;if(!e)throw new Error("QREC_OPENAI_KEY environment variable is required for OpenAI embedding backend");let t=(process.env.QREC_OPENAI_BASE_URL??Zn).replace(/\/$/,""),n=process.env.QREC_OPENAI_MODEL??es,s=parseInt(process.env.QREC_OPENAI_DIMENSIONS??String(768),10);return console.log(`[embed/openai] Using OpenAI-compatible API at ${t}, model: ${n}, dimensions: ${s}`),{dimensions:s,async embed(r){let o={model:n,input:r};n.startsWith("text-embedding-3")&&(o.dimensions=s);let i=await fetch(`${t}/embeddings`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e}`},body:JSON.stringify(o)});if(!i.ok){let c=await i.text().catch(()=>"");throw new Error(`OpenAI embeddings request failed: HTTP ${i.status} \u2014 ${c}`)}let a=await i.json();if(!a.data?.[0]?.embedding||a.data[0].embedding.length===0)throw new Error("OpenAI returned empty or invalid embedding");return new Float32Array(a.data[0].embedding)}}}var Zn,es,yt=T(()=>{"use strict";Zn="https://api.openai.com/v1",es="text-embedding-3-small"});var St={};pe(St,{getStubEmbedder:()=>ns});function ns(){return{dimensions:768,async embed(e){return _t}}}var _t,Tt=T(()=>{"use strict";_t=new Float32Array(768);_t[0]=1});async function Ae(){let e=(process.env.QREC_EMBED_PROVIDER??"local").toLowerCase().trim();switch(e){case"local":case"":{let{getEmbedder:t}=await Promise.resolve().then(()=>(We(),ht));return t()}case"ollama":{let{getOllamaEmbedder:t}=await Promise.resolve().then(()=>(bt(),Et));return t()}case"openai":{let{getOpenAIEmbedder:t}=await Promise.resolve().then(()=>(yt(),Rt));return t()}case"stub":{let{getStubEmbedder:t}=await Promise.resolve().then(()=>(Tt(),St));return t()}default:throw new Error(`Unknown QREC_EMBED_PROVIDER: "${e}". Valid values: local, ollama, openai, stub`)}}var Je=T(()=>{"use strict"});function ss(e){let t=e;for(;;){try{if((0,Re.statSync)((0,j.join)(t,".claude")).isDirectory())return(0,j.basename)(t)}catch{}let n=(0,j.dirname)(t);if(n===t)break;t=n}for(t=e;;){try{if((0,Re.statSync)((0,j.join)(t,".git")).isDirectory())return(0,j.basename)(t)}catch{}let n=(0,j.dirname)(t);if(n===t)break;t=n}return(0,j.basename)(e)}function xt(e){return e.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g,"").replace(/<[^>]+\/>/g,"").trim()}function rs(e,t){let s={Bash:"command",Read:"file_path",Write:"file_path",Edit:"file_path",Glob:"pattern",Grep:"pattern",WebFetch:"url",WebSearch:"query",Agent:"description"}[e],r=s&&typeof t[s]=="string"?t[s]:JSON.stringify(t),o=r.length>80?r.slice(0,80)+"\u2026":r;return`${e}: \`${o}\``}function os(e){if(typeof e=="string")return{text:xt(e).trim(),isToolResult:!1};if(!Array.isArray(e))return{text:"",isToolResult:!1};if(e.every(s=>s?.type==="tool_result"))return{text:"",isToolResult:!0};let n=[];for(let s of e)if(s?.type==="text"&&typeof s.text=="string"){let r=xt(s.text).trim();r&&n.push(r)}return{text:n.join(`
`).trim(),isToolResult:!1}}function is(e){if(!Array.isArray(e))return{text:"",tools:[],thinking:[]};let t=[],n=[],s=[];for(let r of e)if(r?.type==="text"&&typeof r.text=="string"){let o=r.text.trim();o&&t.push(o)}else if(r?.type==="tool_use"&&r.name)n.push(rs(r.name,r.input??{}));else if(r?.type==="thinking"&&typeof r.thinking=="string"){let o=r.thinking.trim();o&&s.push(o)}return{text:t.join(`
`).trim(),tools:n,thinking:s}}async function ye(e){let t=(0,Re.readFileSync)(e,"utf-8"),n=(0,wt.createHash)("sha256").update(t).digest("hex"),r=(0,j.basename)(e,".jsonl").replace(/-/g,"").slice(0,8),o=t.split(`
`).filter(u=>u.trim()).map(u=>{try{return JSON.parse(u)}catch{return null}}).filter(u=>u!==null),i="",a="",c=null,d=[],l=[];for(let u of o){if(u.timestamp&&l.push(Date.parse(u.timestamp)),u.type==="file-history-snapshot"||u.type==="system"||u.type==="progress"||u.isMeta||u.isSidechain)continue;let y=u.message;if(y){if(!i&&u.cwd&&(i=ss(u.cwd)),!a&&u.timestamp&&(a=u.timestamp.slice(0,10)),y.role==="user"&&u.type==="user"){let{text:N,isToolResult:G}=os(y.content);if(G||!N)continue;c||(c=N.slice(0,120)),d.push({role:"user",text:N,tools:[],thinking:[],timestamp:u.timestamp??null})}if(y.role==="assistant"&&u.type==="assistant"){let{text:N,tools:G,thinking:Q}=is(y.content);if(!N&&G.length===0&&Q.length===0)continue;d.push({role:"assistant",text:N,tools:G,thinking:Q,timestamp:u.timestamp??null})}}}let p=900*1e3;l.sort((u,y)=>u-y);let g=0;for(let u=1;u<l.length;u++)g+=Math.min(l[u]-l[u-1],p);let h=Math.round(g/1e3),f=l.length>0?l[l.length-1]:Date.now();return{session_id:r,path:e,project:i,date:a,title:c,hash:n,duration_seconds:h,last_message_at:f,turns:d}}function It(e){let t=[`# Session: ${e.project} \u2014 ${e.date}`,""];e.title&&t.push(`_${e.title}_`,"");for(let n of e.turns)if(n.role==="user")t.push("## User","",n.text,"");else{t.push("## Assistant",""),n.text&&t.push(n.text,"");for(let s of n.tools)t.push(`> **Tool:** ${s}`);n.tools.length>0&&t.push("")}return t.join(`
`)}function Nt(e){let t=[];for(let n of e.turns){n.text&&t.push(`[${n.role==="user"?"User":"Assistant"}] ${n.text}`);for(let s of n.tools)t.push(`[Tool] ${s}`)}return t.join(`
`)}var wt,Re,j,Xe=T(()=>{"use strict";wt=require("crypto"),Re=require("fs"),j=require("path")});function as(e){let t=[];for(let n of(0,C.readdirSync)(e)){let s=(0,ne.join)(e,n);if((0,C.statSync)(s).isDirectory())for(let r of(0,C.readdirSync)(s))r.endsWith(".jsonl")&&t.push((0,ne.join)(s,r));else n.endsWith(".jsonl")&&t.push(s)}return t}function cs(e){return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function ls(e,t,n){let s=cs(n),r=[...e];for(let o=r.length-1;o>0;o--){let i=Math.floor(s()*(o+1));[r[o],r[i]]=[r[i],r[o]]}return r.slice(0,t)}async function vt(e,t=2){try{let n=await ye(e);if(n.turns.filter(o=>o.role==="user").length<t)return null;let r=Nt(n);return r.trim()?{id:n.session_id,path:e,project:n.project,date:n.date,title:n.title,hash:n.hash,duration_seconds:n.duration_seconds,last_message_at:n.last_message_at,chunkText:r}:null}catch(n){return console.warn("[indexer] Failed to parse JSONL:",e,n),null}}function ds(e,t,n){if(!e.startsWith(n))try{let s=(0,ne.join)(n,t);(0,C.mkdirSync)(s,{recursive:!0}),(0,C.copyFileSync)(e,(0,ne.join)(s,(0,ne.basename)(e)))}catch(s){console.warn(`[indexer] Archive failed for ${e}: ${s}`)}}async function _e(e,t,n={},s,r){let o=r??await Ae(),i=t.endsWith(".jsonl")&&(0,C.existsSync)(t),a=!i&&(0,C.existsSync)(t)&&(0,C.statSync)(t).isDirectory(),c=new Map,d=e.prepare("SELECT path, indexed_at FROM sessions").all();for(let E of d)c.set(E.path,E.indexed_at);let l=[];if(i){let E=await vt(t,At);if(!E){console.log("[indexer] Session skipped (too few user turns or empty)");return}l=[E]}else if(a){let E=as(t),L=n.force?E:E.filter(P=>{let ae=c.get(P);return ae?(0,C.statSync)(P).mtimeMs>=ae:!0}),Z=E.length-L.length;console.log(`[indexer] Found ${E.length} JSONL files (${Z} skipped by mtime, ${L.length} to check)`),l=(await Promise.all(L.map(P=>vt(P,At)))).filter(P=>P!==null)}else{console.error(`[indexer] Path not found or not a JSONL/directory: ${t}`);return}let p=new Map,g=e.prepare("SELECT id, hash FROM sessions").all();for(let E of g)p.set(E.id,E.hash);if(n.sessions&&n.sessions<l.length){let E=n.seed??42;l=ls(l,n.sessions,E),console.log(`[indexer] Sampled ${l.length} sessions (seed=${E})`)}let h=l.filter(({id:E,hash:L})=>n.force?!0:p.get(E)!==L),f=l.length-h.length,u=i?1:l.length;console.log(`[indexer] ${h.length} sessions to index (${u} total, ${f} up-to-date)`);let y=e.prepare(`
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
  `),Q=e.prepare("DELETE FROM chunks WHERE session_id = ?"),z=e.prepare("DELETE FROM chunks_vec WHERE chunk_id LIKE ?");for(let E=0;E<h.length;E++){let{id:L,path:Z,project:ie,date:P,title:ae,hash:Se,duration_seconds:je,last_message_at:Ue,chunkText:Be}=h[E],ue=n.archiveDir===void 0?fe:n.archiveDir;ue!==null&&ds(Z,ie,ue);let Te=dt(Be),m=Date.now(),_=e.transaction(()=>(Q.run(L),z.run(`${L}_%`),y.run(L,Z,ie,P,ae,Se,m,je,Ue),Te))();process.stdout.write(`[${E+1}/${h.length}] ${L} (${ie}/${P}) \u2014 ${_.length} chunks
`),s?.(E,h.length,L);let I=e.transaction(O=>{for(let{chunkId:U,seq:$,pos:ee,text:kn,embedding:Mn}of O)N.run(U,L,$,ee,kn,m),G.run(U,Buffer.from(Mn.buffer))}),S=[];for(let O=0;O<_.length;O++){let U=_[O],$=`${L}_${O}`,ee=await o.embed(U.text);S.push({chunkId:$,seq:O,pos:U.pos,text:U.text,embedding:ee})}I(S)}s?.(h.length,h.length,""),console.log(`[indexer] Done. Total sessions indexed: ${h.length}`)}async function Lt(e,t){let n=e.prepare(`
    SELECT c.id, c.text FROM chunks c
    LEFT JOIN chunks_vec v ON v.chunk_id = c.id
    WHERE c.seq = -1 AND v.chunk_id IS NULL
  `).all();if(n.length===0)return;console.log(`[indexer] Embedding ${n.length} summary chunk(s) into chunks_vec`);let s=e.prepare("INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)");for(let{id:r,text:o}of n){let i=await t.embed(o);s.run(r,Buffer.from(i.buffer))}console.log("[indexer] Summary chunks embedded.")}var C,ne,At,Ye=T(()=>{"use strict";C=require("fs"),ne=require("path");M();ut();Je();Xe();At=2});function Pt(e,t){for(let n of t)for(let s of e){let r=`${n}/${s}`;if((0,H.existsSync)(r)){let o=s.match(/\.so\.(\d+)/);return{path:r,soVersion:o?.[1]??null}}}return null}function ms(){try{let e=Bun.spawnSync(["nvidia-smi","--query-gpu=name,driver_version","--format=csv,noheader,nounits"]);if(e.exitCode!==0||!e.stdout)return null;let t=e.stdout.toString("utf-8").trim().split(", ");if(t.length<2)return null;let n=t[0].trim(),s=t[1].trim(),o=Bun.spawnSync(["nvidia-smi"]).stdout?.toString("utf-8").match(/CUDA Version:\s*([\d.]+)/);return{name:n,driver:s,cudaVersion:o?.[1]??"unknown"}}catch{return null}}function gs(){try{let e=(0,H.readFileSync)("/etc/os-release","utf-8"),t={};for(let n of e.split(`
`)){let s=n.match(/^(\w+)="?([^"]*)"?$/);s&&(t[s[1]]=s[2])}return t}catch{return{}}}function fs(){return(0,H.existsSync)("/usr/bin/apt-get")?"apt":(0,H.existsSync)("/usr/bin/dnf")?"dnf":(0,H.existsSync)("/usr/bin/yum")?"yum":(0,H.existsSync)("/usr/bin/pacman")?"pacman":"unknown"}function hs(){try{return(0,H.readdirSync)("/etc/apt/sources.list.d").some(e=>e.startsWith("cuda")||e.includes("nvidia"))}catch{return!1}}function Es(e){let t=e.libcudart,n=e.libcublas;return!t?.found||!n?.found?"linux-x64":t.soVersion==="13"&&n.soVersion==="13"?"linux-x64-cuda":"linux-x64-cuda-ext"}function bs(e,t,n){let s=e.cudaVersion!=="unknown"?e.cudaVersion.split(".").slice(0,2).join("-"):"12-8",r=s.split("-")[0],o=[];if(t==="apt"){if(!n){let i=gs(),a=i.ID?.toLowerCase()??"ubuntu",c=i.VERSION_ID?.replace(".","")??"2204";o.push(`wget https://developer.download.nvidia.com/compute/cuda/repos/${a}${c}/x86_64/cuda-keyring_1.1-1_all.deb`),o.push("sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt-get update")}o.push(`sudo apt install -y cuda-cudart-${s} libcublas-${s}`)}else t==="dnf"||t==="yum"?o.push(`sudo ${t} install -y cuda-cudart-${s} libcublas-${s}`):t==="pacman"?o.push("sudo pacman -S cuda"):(o.push("# Install CUDA runtime libs from your package manager or the NVIDIA CUDA toolkit"),o.push(`# Required: libcudart.so.${r}, libcublas.so.${r}, libcublasLt.so.${r}`));return o.push("qrec teardown && qrec serve --daemon"),o}function se(){if(de)return de;if(process.platform!=="linux")return de={gpuDetected:!1,gpuName:null,driverVersion:null,cudaDriverVersion:null,cudaRuntimeAvailable:!1,vulkanAvailable:!1,missingLibs:[],libProbes:{},selectedBackend:"cpu",activeBinaryName:null,pkgManager:"unknown",cudaRepoConfigured:null,advice:null,installSteps:null},de;let e=ms(),t={},n=[];for(let g of ps){let h=Pt(g.variants,Mt);t[g.name]={found:h!==null,path:h?.path??null,soVersion:h?.soVersion??null},h||n.push(g.name)}let s=Pt(["libvulkan.so","libvulkan.so.1"],Mt),r=e!==null&&n.length===0,o=s!==null,i=r?"cuda":o?"vulkan":"cpu",a=r?Es(t):"linux-x64",c=fs(),d=c==="apt"?hs():null,l=null,p=null;return e&&!r&&(l=`GPU detected (${e.name}) but CUDA runtime libs missing: ${n.join(", ")}.`,p=bs(e,c,d)),de={gpuDetected:e!==null,gpuName:e?.name??null,driverVersion:e?.driver??null,cudaDriverVersion:e?.cudaVersion??null,cudaRuntimeAvailable:r,vulkanAvailable:o,missingLibs:n,libProbes:t,selectedBackend:i,activeBinaryName:a,pkgManager:c,cudaRepoConfigured:d,advice:l,installSteps:p},de}var H,Mt,ps,de,Oe=T(()=>{"use strict";H=require("node:fs"),Mt=["/usr/lib","/usr/lib64","/usr/lib/x86_64-linux-gnu","/usr/lib/aarch64-linux-gnu","/usr/local/cuda/lib64","/usr/local/cuda/targets/x86_64-linux/lib","/usr/local/cuda/targets/aarch64-linux/lib",...process.env.LD_LIBRARY_PATH?.split(":").filter(Boolean)??[],...process.env.CUDA_PATH?[`${process.env.CUDA_PATH}/lib64`]:[]],ps=[{name:"libcudart",variants:["libcudart.so","libcudart.so.11","libcudart.so.12","libcudart.so.13"]},{name:"libcublas",variants:["libcublas.so","libcublas.so.11","libcublas.so.12","libcublas.so.13"]},{name:"libcublasLt",variants:["libcublasLt.so","libcublasLt.so.11","libcublasLt.so.12","libcublasLt.so.13"]}];de=null});function K(e=ge){try{let t=JSON.parse((0,Y.readFileSync)(e,"utf-8"));return{...$t,...t}}catch(t){return t.code!=="ENOENT"&&console.warn("[config] Failed to parse config.json, using defaults:",t),{...$t}}}function Ft(e=ge){(0,Y.existsSync)(e)||ze({},e)}function ze(e,t=ge){let s={...K(t),...e},r=t===ge?w:t.replace(/\/[^/]+$/,"");return(0,Y.mkdirSync)(r,{recursive:!0}),(0,Y.writeFileSync)(t,JSON.stringify(s,null,2),"utf-8"),s}var Y,$t,De=T(()=>{"use strict";Y=require("fs");M();$t={enrichEnabled:!0,enrichIdleMs:300*1e3,indexIntervalMs:6e4}});var jt,Ut=T(()=>{"use strict";jt=`You are a concise technical summarizer for AI coding sessions.
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
- No explanation outside the JSON block`});function Rs(e,t=6e3){let n=e.split(`
`),s=[],r=0;for(let o of n)if(!o.startsWith("[Tool]")){if(r+o.length>t){s.push("... (truncated)");break}s.push(o),r+=o.length+1}return s.join(`
`)}function Ce(e){return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}function ys(e){let t=e.replace(/<think>[\s\S]*?<\/think>/g,"").trim(),n=t.match(/\{[\s\S]*\}/);if(!n)return{title:"",summary:t.slice(0,500)||"",tags:[],entities:[],learnings:[],questions:[]};try{let s=JSON.parse(n[0]);return{title:typeof s.title=="string"?s.title:"",summary:typeof s.summary=="string"?s.summary:"",tags:Ce(s.tags),entities:Ce(s.entities),learnings:Ce(s.learnings),questions:Ce(s.questions)}}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}}async function Bt(e,t){let{LlamaChatSession:n}=await import("node-llama-cpp"),s=e.ctx.getSequence(),r=new n({contextSequence:s,systemPrompt:jt}),i=`/no_think

Transcript:

${Rs(t)}

JSON summary:`;try{let a=await r.prompt(i,{maxTokens:600,temperature:.1});return ys(a)}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}finally{s.dispose()}}var qt=T(()=>{"use strict";Ut()});var Qt={};pe(Qt,{ENRICHMENT_VERSION:()=>V,ENRICH_PID_FILE:()=>B,disposeSummarizer:()=>et,isEnrichAlive:()=>tt,isProcessAlive:()=>Me,loadSummarizer:()=>Ht,readEnrichPid:()=>ke,runEnrich:()=>ws,selectPendingSessions:()=>Vt});function ke(){if(!(0,k.existsSync)(B))return null;let e=parseInt((0,k.readFileSync)(B,"utf-8").trim(),10);return isNaN(e)?null:e}function Me(e){try{return process.kill(e,0),!0}catch{return!1}}function tt(){let e=ke();return e!==null&&Me(e)}function Ss(e){(0,k.mkdirSync)(w,{recursive:!0}),(0,k.writeFileSync)(B,String(e),"utf-8")}function Ze(){try{(0,k.unlinkSync)(B)}catch{}}async function Ht(){let{resolveModelFile:e,getLlama:t}=await import("node-llama-cpp");(0,k.mkdirSync)(J,{recursive:!0}),process.stdout.write(`[enrich] Resolving model...
`);let n=-1,s=!1,r=null,o=await e(_s,{directory:J,onProgress({totalSize:d,downloadedSize:l}){s=!0;let p=d?Math.round(l/d*100):0;if(process.stdout.write(`\r[enrich] Downloading model... ${p}%`),Math.abs(p-n)>=5){n=p;let g=d?Math.round(d/1024/1024):null;r=g;let h=Math.round(l/1024/1024);try{(0,k.writeFileSync)(me,JSON.stringify({percent:p,downloadedMB:h,totalMB:g}),"utf-8")}catch{}}}});s&&process.stdout.write(`
`),process.stdout.write(`[enrich] Model ready at ${o}
`);let i=await t(),a=await i.loadModel({modelPath:o}),c=await a.createContext({contextSize:8192,sequences:1,flashAttention:!0});console.log("[enrich] Model loaded.");try{(0,k.unlinkSync)(me)}catch{}return s&&v({type:"enrich_model_downloaded",data:{totalMB:r}}),v({type:"enrich_model_loaded"}),{llama:i,model:a,ctx:c}}async function et(e){await e.ctx.dispose(),await e.model.dispose(),await e.llama.dispose()}function Ts(e,t){return e.prepare("SELECT text FROM chunks WHERE session_id = ? ORDER BY seq").all(t).map(s=>s.text).join(`

`)}function Gt(e,t,n,s=[],r=[]){return[e,t.length>0?"Tags: "+t.join(", "):"",n.length>0?"Entities: "+n.join(", "):"",s.length>0?"Learnings: "+s.join(" "):"",r.length>0?"Questions: "+r.join(" "):""].filter(Boolean).join(`
`)}function xs(e){let t=e.prepare(`SELECT id, summary, tags, entities, learnings, questions FROM sessions
     WHERE enriched_at IS NOT NULL
       AND id NOT IN (SELECT session_id FROM chunks WHERE id = session_id || '_summary')`).all();if(t.length===0)return;console.log(`[enrich] Backfilling summary chunks for ${t.length} already-enriched session(s)`);let n=e.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let s of t){if(!s.summary)continue;let r=s.tags?JSON.parse(s.tags):[],o=s.entities?JSON.parse(s.entities):[],i=s.learnings?JSON.parse(s.learnings):[],a=s.questions?JSON.parse(s.questions):[],c=Gt(s.summary,r,o,i,a);n.run(`${s.id}_summary`,s.id,-1,-1,c,Date.now())}console.log("[enrich] Backfill done.")}function Vt(e,t){let n=t.minAgeMs!==void 0?Date.now()-t.minAgeMs:null,s;return t.force?s=n!==null?e.prepare("SELECT id FROM sessions WHERE last_message_at < ?").all(n):e.prepare("SELECT id FROM sessions").all():s=n!==null?e.prepare("SELECT id FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").all(V,n):e.prepare("SELECT id FROM sessions WHERE enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?").all(V),t.limit!==void 0?s.slice(0,t.limit):s}async function ws(e={}){Ss(process.pid);let t=te();try{xs(t);let n=Vt(t,e);if(e.limit!==void 0&&(n=n.slice(0,e.limit)),n.length===0){console.log("[enrich] No pending sessions. Exiting without loading model.");return}console.log(`[enrich] ${n.length} session(s) to enrich`);let s=Date.now();v({type:"enrich_started",data:{pending:n.length}});let r=0,o=!1,i=null;try{i=await Ht();let a=t.prepare("UPDATE sessions SET summary=?, tags=?, entities=?, learnings=?, questions=?, title = CASE WHEN ? != '' THEN ? ELSE title END, enriched_at=?, enrichment_version=? WHERE id=?"),c=t.prepare("DELETE FROM chunks WHERE id = ?"),d=t.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let l=0;l<n.length;l++){let{id:p}=n[l],g=Ts(t,p);if(!g.trim()){t.prepare("UPDATE sessions SET enriched_at=?, enrichment_version=? WHERE id=?").run(Date.now(),V,p),console.log(`[${l+1}/${n.length}] ${p} \u2014 skip (no chunks)`);continue}let h=Date.now(),f=await Bt(i,g),u=Date.now()-h,y=Date.now();if(a.run(f.summary,JSON.stringify(f.tags),JSON.stringify(f.entities),JSON.stringify(f.learnings),JSON.stringify(f.questions),f.title,f.title,y,V,p),f.summary||f.tags.length>0||f.entities.length>0||f.learnings.length>0||f.questions.length>0){let N=Gt(f.summary,f.tags,f.entities,f.learnings,f.questions);c.run(`${p}_summary`),d.run(`${p}_summary`,p,-1,-1,N,y)}v({type:"session_enriched",data:{sessionId:p,latencyMs:u}}),r++,console.log(`[${l+1}/${n.length}] ${p} \u2014 ${u}ms`),f.summary&&console.log(`  Summary: ${f.summary.slice(0,100)}`),f.tags.length>0&&console.log(`  Tags: ${f.tags.join(", ")}`),f.learnings.length>0&&console.log(`  Learnings: ${f.learnings.length}`),f.questions.length>0&&console.log(`  Questions: ${f.questions.length}`)}v({type:"enrich_complete",data:{enriched:r,durationMs:Date.now()-s}}),console.log("[enrich] Done."),t.close(),Ze(),o=!0,await et(i)}finally{if(!o){v({type:"enrich_complete",data:{enriched:r,durationMs:Date.now()-s}});try{t.close()}catch{}if(Ze(),i)try{await et(i)}catch{}}}}finally{try{t.close()}catch{}Ze()}}var k,V,_s,Pe=T(()=>{"use strict";k=require("fs");M();he();qt();ce();V=3,_s="hf:bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen_Qwen3-1.7B-Q4_K_M.gguf"});function Jt(e){if(!K().enrichEnabled)return;let t=ke();if(t!==null&&Me(t)){console.log("[server] Enrich child already running, skipping spawn.");return}let n=K().enrichIdleMs,s=Date.now()-n;if(e.prepare("SELECT COUNT(*) as n FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").get(V,s).n===0)return;let o=q,i=typeof Yt.dir=="string"?["bun","run",(0,st.join)(Yt.dir,"cli.ts"),"enrich"]:[process.argv[0],process.argv[1],"enrich"],a=Bun.spawn([...i,"--min-age-ms",String(n)],{detached:!0,stdio:["ignore",Bun.file(o),Bun.file(o)]});a.unref(),console.log(`[server] Spawned enrich child (PID ${a.pid})`)}async function Xt(e,t,n=!1){if(t.isIndexing||!(0,nt.existsSync)(Wt))return;t.isIndexing=!0;let s=Date.now();n&&v({type:"index_started"}),n&&(x.phase="indexing"),x.indexing={indexed:0,total:0,current:""};let r=0,o=-1,i=[];try{if(await _e(e,Wt,{},(a,c,d)=>{x.indexing={indexed:a,total:c,current:d},d&&a>o&&(n?v({type:"session_indexed",data:{sessionId:d}}):i.push(d),r++,o=a)}),n&&(0,nt.existsSync)(fe)&&(o=-1,await _e(e,fe,{},(a,c,d)=>{x.indexing={indexed:a,total:c,current:d},d&&a>o&&(v({type:"session_indexed",data:{sessionId:d}}),r++,o=a)})),!n&&r>0){v({type:"index_started"});for(let a of i)v({type:"session_indexed",data:{sessionId:a}})}(n||r>0)&&v({type:"index_complete",data:{newSessions:r,durationMs:Date.now()-s}}),t.embedder&&await Lt(e,t.embedder)}catch(a){console.error("[server] Index error:",a)}finally{t.isIndexing=!1,n&&(x.phase="ready")}}async function Zt(e,t,n=10,s=3e4){let r=se();process.platform==="linux"&&(console.log(`[server] GPU: ${r.gpuDetected?`${r.gpuName} (driver ${r.driverVersion}, CUDA ${r.cudaDriverVersion})`:"none detected"}`),console.log(`[server] Compute backend: ${r.selectedBackend}`),r.advice&&console.warn(`[server] WARNING: ${r.advice}`));for(let o=1;o<=n;o++)try{x.phase="model_loading",t.embedder=await Ae(),t.embedderError=null,console.log("[server] Model ready");let i=K().indexIntervalMs;Jt(e),setInterval(()=>Jt(e),i),await Xt(e,t,!0),x.phase="ready",setInterval(()=>Xt(e,t),i);return}catch(i){t.embedderError=String(i),console.error(`[server] Model load failed (attempt ${o}/${n}):`,i),o<n&&(console.log(`[server] Retrying in ${s/1e3}s...`),await Bun.sleep(s))}console.error("[server] Model load gave up after all retries."),x.phase="ready"}var nt,Kt,st,Yt,Wt,zt,_r,rt=T(()=>{"use strict";Je();Ye();Ne();ce();nt=require("fs"),Kt=require("os"),st=require("path");M();Pe();De();Oe();Yt={},Wt=process.env.QREC_PROJECTS_DIR??(0,st.join)((0,Kt.homedir)(),".claude","projects"),zt=parseInt(process.env.QREC_INDEX_INTERVAL_MS??"60000",10),_r=parseInt(process.env.QREC_ENRICH_IDLE_MS??String(300*1e3),10)});function Is(e,t=150){let n=[],s=/<mark>/g,r;for(;(r=s.exec(e))!==null;){let i=Math.max(0,r.index-t),a=e.indexOf("</mark>",r.index),c=Math.min(e.length,(a===-1?r.index:a+7)+t);n.push([i,c])}if(n.length===0)return e.slice(0,t*2);n.sort((i,a)=>i[0]-a[0]);let o=[n[0]];for(let i=1;i<n.length;i++){let a=o[o.length-1];n[i][0]<=a[1]?a[1]=Math.max(a[1],n[i][1]):o.push(n[i])}return o.map(([i,a])=>{let c=i>0?"\u2026":"",d=a<e.length?"\u2026":"",l=e.slice(i,a);return i>0&&(l=l.replace(/^[^<>]*>/,"")),l=l.replace(/<[^>]*$/,""),`${c}${l}${d}`}).join(" <span class='snippet-gap'>\u2026</span> ")}function Ns(e){return(0,tn.createHash)("sha256").update(e).digest("hex")}async function vs(e,t,n){let s=Ns(t),r=e.prepare("SELECT embedding FROM query_cache WHERE query_hash = ?").get(s);if(r){let c=r.embedding;return{embedding:new Float32Array(c.buffer,c.byteOffset,c.byteLength/4),cached:!0,embedMs:0}}let o=performance.now(),i=await n.embed(t),a=performance.now()-o;return e.prepare("INSERT OR REPLACE INTO query_cache (query_hash, embedding, created_at) VALUES (?, ?, ?)").run(s,Buffer.from(i.buffer),Date.now()),{embedding:i,cached:!1,embedMs:a}}async function nn(e,t,n,s=10,r){let o=performance.now(),i=performance.now(),a=[],c=n.replace(/[^a-zA-Z0-9\s'-]/g," ").replace(/\s+/g," ").trim();try{c.length>0&&(a=e.prepare("SELECT rowid, session_id, rank FROM chunks_fts WHERE text MATCH ? ORDER BY rank LIMIT ?").all(c,s*5))}catch(m){console.warn("[search] FTS5 query failed, falling back to KNN only:",m),a=[],c=""}let d=performance.now()-i,{embedding:l,embedMs:p}=await vs(e,n,t),g=performance.now(),h=Buffer.from(l.buffer),f=e.prepare("SELECT chunk_id, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ?").all(h,s*5),u=performance.now()-g,y=performance.now(),N=new Map;if(a.length>0){let m=a.map(S=>S.rowid),b=m.map(()=>"?").join(","),_=e.prepare(`SELECT rowid, id FROM chunks WHERE rowid IN (${b})`).all(...m),I=new Map(_.map(S=>[S.rowid,S.id]));for(let S=0;S<a.length;S++){let O=I.get(a[S].rowid);O&&N.set(O,{bm25Rank:S+1,rowid:a[S].rowid})}}for(let m=0;m<f.length;m++){let b=f[m].chunk_id,_=N.get(b);_?_.vecRank=m+1:N.set(b,{vecRank:m+1})}if(r&&(r.dateFrom||r.dateTo||r.project||r.tag)){let m=new Set;for(let b of N.keys())m.add(b.split("_").slice(0,-1).join("_"));if(m.size>0){let b=[...m],I=[`id IN (${b.map(()=>"?").join(",")})`],S=[...b];r.dateFrom&&(I.push("date >= ?"),S.push(r.dateFrom)),r.dateTo&&(I.push("date <= ?"),S.push(r.dateTo)),r.project&&(I.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),S.push(r.project)),r.tag&&(I.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),S.push(r.tag));let O=e.prepare(`SELECT id FROM sessions WHERE ${I.join(" AND ")}`).all(...S),U=new Set(O.map($=>$.id));for(let[$]of N){let ee=$.split("_").slice(0,-1).join("_");U.has(ee)||N.delete($)}}}let G=new Map;for(let[m,b]of N){let _=(b.bm25Rank!==void 0?1/(en+b.bm25Rank):0)+(b.vecRank!==void 0?1/(en+b.vecRank):0);G.set(m,_)}let Q=new Map;for(let[m,b]of G){let _=m.split("_").slice(0,-1).join("_"),I=Q.get(_);(!I||b>I.score)&&Q.set(_,{score:b,bestChunkId:m})}let z=[...Q.entries()].sort((m,b)=>b[1].score-m[1].score).slice(0,s),E=performance.now()-y,L=performance.now()-o;if(z.length===0)return[];let Z=z.map(([m])=>m),ie=Z.map(()=>"?").join(","),P=e.prepare(`SELECT id, project, date, indexed_at, last_message_at, title, summary FROM sessions WHERE id IN (${ie})`).all(...Z),ae=new Map(P.map(m=>[m.id,m])),Se=z.map(([,m])=>m.bestChunkId),je=Se.map(()=>"?").join(","),Ue=e.prepare(`SELECT id, session_id, text FROM chunks WHERE id IN (${je})`).all(...Se),Be=new Map(Ue.map(m=>[m.id,m])),ue=new Map;if(c.length>0)for(let[,{bestChunkId:m}]of z){let b=N.get(m)?.rowid;if(b!==void 0)try{let _=e.prepare("SELECT highlight(chunks_fts, 1, '<mark>', '</mark>') as hl FROM chunks_fts WHERE chunks_fts MATCH ? AND rowid = ?").get(c,b);_?.hl&&ue.set(m,_.hl)}catch(_){console.warn("[search] Highlight extraction failed:",_)}}let Te=[];for(let[m,{score:b,bestChunkId:_}]of z){let I=ae.get(m);if(!I)continue;let S=Be.get(_),O=S?S.text:"",U=O.slice(0,300)+(O.length>300?"\u2026":""),$=ue.get(_),ee=$?Is($):void 0;Te.push({session_id:m,score:b,preview:U,highlightedPreview:ee,project:I.project,date:I.date,indexed_at:I.indexed_at,last_message_at:I.last_message_at??null,title:I.title,summary:I.summary??null,latency:{bm25Ms:d,embedMs:p,knnMs:u,fusionMs:E,totalMs:L}})}return Te}var tn,en,sn=T(()=>{"use strict";tn=require("crypto");en=60});function rn(e,t,n,s,r){let o=s[0]??null;e.prepare(`
    INSERT INTO query_audit (query, k, result_count, top_session_id, top_score, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(t,n,s.length,o?.session_id??null,o?.score??null,r,Date.now())}function on(e,t=100){return e.prepare("SELECT * FROM query_audit ORDER BY created_at DESC LIMIT ?").all(t)}var an=T(()=>{"use strict"});function $e(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function cn(e){let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get();return Response.json({status:"ok",phase:x.phase,indexedSessions:t.count})}function ln(e){let t=e.prepare("SELECT COUNT(*) as n FROM sessions").get().n,n=e.prepare("SELECT COUNT(*) as n FROM chunks").get().n,s=e.prepare("SELECT MAX(indexed_at) as ts FROM sessions").get(),r=e.prepare("SELECT COUNT(*) as n FROM query_audit").get().n,o=e.prepare("SELECT COUNT(*) as n FROM sessions WHERE enriched_at IS NOT NULL AND enrichment_version >= ?").get(V).n,i=t-o;return Response.json({status:"ok",version:"0.7.4",phase:x.phase,sessions:t,chunks:n,lastIndexedAt:s.ts,searches:r,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",embedModel:process.env.QREC_EMBED_PROVIDER==="ollama"?process.env.QREC_OLLAMA_MODEL??"nomic-embed-text":process.env.QREC_EMBED_PROVIDER==="openai"?process.env.QREC_OPENAI_MODEL??"text-embedding-3-small":"gemma-300M",enrichModel:"Qwen3-1.7B",modelDownload:x.modelDownload,indexing:x.indexing,memoryMB:Math.round(process.memoryUsage().rss/1024/1024),enriching:tt(),enrichedCount:o,pendingCount:i,enrichEnabled:K().enrichEnabled,enrichProgress:(()=>{try{return JSON.parse((0,ot.readFileSync)(me,"utf-8"))}catch(a){return a.code!=="ENOENT"&&console.warn("[server] Failed to read enrich progress:",a),null}})(),compute:(()=>{let a=se();return{selectedBackend:a.selectedBackend,gpuDetected:a.gpuDetected,gpuName:a.gpuName,driverVersion:a.driverVersion,cudaDriverVersion:a.cudaDriverVersion,cudaRuntimeAvailable:a.cudaRuntimeAvailable,vulkanAvailable:a.vulkanAvailable,missingLibs:a.missingLibs,libProbes:a.libProbes,activeBinaryName:a.activeBinaryName,installSteps:a.installSteps,advice:a.advice}})()})}function dn(e){let t=e.prepare("SELECT project, MAX(date) as last_active FROM sessions WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY last_active DESC").all();return Response.json({projects:t.map(n=>n.project)})}async function un(e,t,n){if(!t.embedder)return Response.json({error:t.embedderError??`Model not ready yet (phase: ${x.phase})`},{status:503});let s;try{s=await n.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let r=s.query?.trim();if(!r)return Response.json({error:"Missing required field: query"},{status:400});let o=s.k??10,i={};s.dateFrom&&(i.dateFrom=s.dateFrom),s.dateTo&&(i.dateTo=s.dateTo),s.project&&(i.project=s.project),s.tag&&(i.tag=s.tag);let a=performance.now();try{let c=await nn(e,t.embedder,r,o,i),d=performance.now()-a;try{rn(e,r,o,c,d)}catch(p){console.warn("[server] Failed to write audit query:",p)}let l=c[0]?.latency.totalMs??0;return Response.json({results:c,latencyMs:l})}catch(c){return console.error("[server] Search error:",c),Response.json({error:String(c)},{status:500})}}async function pn(e,t){let n;try{n=await t.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let s=n.sql?.trim()??"";if(!s)return Response.json({error:"Missing required field: sql"},{status:400});if(!s.toUpperCase().startsWith("SELECT"))return Response.json({error:"Only SELECT queries are allowed"},{status:400});if(s.includes(";"))return Response.json({error:"Semicolons are not allowed (no statement stacking)"},{status:400});try{let r=e.prepare(s).all();return Response.json({rows:r,count:r.length})}catch(r){return Response.json({error:String(r)},{status:500})}}function mn(){return Response.json(K())}async function gn(e){let t;try{t=await e.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let n={};if(t.enrichEnabled!==void 0&&(n.enrichEnabled=!!t.enrichEnabled),t.enrichIdleMs!==void 0){let r=t.enrichIdleMs;if(!Number.isInteger(r)||r<6e4||r>36e5)return Response.json({error:"enrichIdleMs must be an integer between 60000 and 3600000"},{status:400});n.enrichIdleMs=r}if(t.indexIntervalMs!==void 0){let r=t.indexIntervalMs;if(!Number.isInteger(r)||r<1e4||r>36e5)return Response.json({error:"indexIntervalMs must be an integer between 10000 and 3600000"},{status:400});n.indexIntervalMs=r}let s=ze(n);return Response.json(s)}function fn(e,t){let s=Math.max(0,parseInt(t.searchParams.get("offset")??"0",10)||0),r=t.searchParams.get("date")??null,o=r??t.searchParams.get("dateFrom")??null,i=r??t.searchParams.get("dateTo")??null,a=t.searchParams.get("project")??null,c=t.searchParams.get("tag")??null,d=[],l=[];o&&(d.push("date >= ?"),l.push(o)),i&&(d.push("date <= ?"),l.push(i)),a&&(d.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),l.push(a)),c&&(d.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),l.push(c));let p=d.length>0?`WHERE ${d.join(" AND ")}`:"",g=e.prepare(`SELECT id, title, project, date, indexed_at, last_message_at, summary, tags, entities, learnings, questions FROM sessions ${p} ORDER BY COALESCE(last_message_at, indexed_at) DESC LIMIT ? OFFSET ?`).all(...l,100,s),h=e.prepare(`SELECT COUNT(*) as count FROM sessions ${p}`).get(...l).count,f=g.map(u=>({...u,tags:u.tags?JSON.parse(u.tags):null,entities:u.entities?JSON.parse(u.entities):null,learnings:u.learnings?JSON.parse(u.learnings):null,questions:u.questions?JSON.parse(u.questions):null}));return Response.json({sessions:f,total:h,offset:s,limit:100})}async function hn(e,t){let n=e.prepare("SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?").get(t);if(!n)return Response.json({error:"Session not found"},{status:404});try{let s=await ye(n.path);return Response.json({id:n.id,title:n.title,project:n.project,date:n.date,path:n.path,summary:n.summary??null,tags:n.tags?JSON.parse(n.tags):null,entities:n.entities?JSON.parse(n.entities):null,learnings:n.learnings?JSON.parse(n.learnings):null,questions:n.questions?JSON.parse(n.questions):null,turns:s.turns})}catch(s){return console.error("[server] Failed to parse session:",s),Response.json({error:String(s)},{status:500})}}async function En(e,t){let n=e.prepare("SELECT path, summary, tags, entities FROM sessions WHERE id = ?").get(t);if(!n)return new Response("Session not found",{status:404});try{let s=await ye(n.path),r=It(s);if(n.summary){let o=n.tags?JSON.parse(n.tags):[],i=n.entities?JSON.parse(n.entities):[];r=["## Summary","",n.summary,"",o.length>0?`**Tags:** ${o.join(", ")}`:"",i.length>0?`**Entities:** ${i.join(", ")}`:"","","---",""].filter((c,d,l)=>!(c===""&&l[d-1]==="")).join(`
`)+r}return new Response(r,{headers:{"Content-Type":"text/plain; charset=utf-8"}})}catch(s){return console.error("[server] Failed to render session markdown:",s),new Response(String(s),{status:500})}}function bn(e,t){let n=Math.min(52,Math.max(4,parseInt(t.searchParams.get("weeks")??"15",10)||15)),s=t.searchParams.get("metric")??"sessions",r=t.searchParams.get("project")??null,o=new Date;o.setDate(o.getDate()-n*7+1),o.setHours(0,0,0,0);let i=$e(o),a=r?" AND project = ?":"",c=r?[i,r]:[i],d;s==="hours"?d=e.prepare(`SELECT date, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ?${a} GROUP BY date ORDER BY date ASC`).all(...c):d=e.prepare(`SELECT date, COUNT(*) as count FROM sessions WHERE date >= ?${a} GROUP BY date ORDER BY date ASC`).all(...c);let l=new Map(d.map(u=>[u.date,u.count])),p=[],g=new Date(o),h=new Date;for(;$e(g)<=$e(h);){let u=$e(g);p.push({date:u,count:l.get(u)??0}),g.setDate(g.getDate()+1)}let f={};if(!r){let u;s==="hours"?u=e.prepare("SELECT date, project, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(i):u=e.prepare("SELECT date, project, COUNT(*) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(i);for(let y of u)f[y.date]||(f[y.date]={}),f[y.date][y.project]=y.count}return Response.json({days:p,metric:s,total:d.reduce((u,y)=>u+y.count,0),active_days:d.filter(u=>u.count>0).length,byProject:f})}function Rn(e,t){let n=parseInt(t.searchParams.get("limit")??"100",10);try{let s=on(e,n);return Response.json({entries:s})}catch(s){return Response.json({error:String(s)},{status:500})}}function yn(e){let t=parseInt(e.searchParams.get("limit")??"100",10),n=pt(t);return Response.json({entries:n})}function _n(e){let t=parseInt(e.searchParams.get("lines")??"100",10);try{let s=(0,ot.readFileSync)(q,"utf-8").split(`
`).filter(r=>r.length>0).slice(-t);return Response.json({lines:s})}catch{return Response.json({lines:[]})}}function Sn(){return Response.json({dbPath:Ge,logPath:q,modelCachePath:J,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",ollamaHost:process.env.QREC_OLLAMA_HOST??null,ollamaModel:process.env.QREC_OLLAMA_MODEL??null,openaiBaseUrl:process.env.QREC_OPENAI_BASE_URL??null,indexIntervalMs:zt,port:D(),platform:process.platform,bunVersion:process.versions.bun??null,nodeVersion:process.version})}var ot,Tn=T(()=>{"use strict";rt();sn();an();Xe();Ne();ce();De();Pe();M();he();ot=require("fs");Oe()});var Ds={};async function Ls(){if(wn!==null)return new Response(wn,{headers:{"Content-Type":"text/html; charset=utf-8"}});if(!(0,vn.existsSync)(In))return Response.json({error:"UI not found"},{status:404});let e=await Bun.file(In).text();return new Response(e,{headers:{"Content-Type":"text/html; charset=utf-8"}})}async function Nn(e,t,n){let s=e.slice(n.length);if(s.includes("..")||s.startsWith("/"))return new Response("Forbidden",{status:403});let r=(0,re.join)(t,s),o=Bun.file(r);if(!await o.exists())return new Response("Not found",{status:404});let i=s.split(".").pop()?.toLowerCase()??"",a=i==="css"?"text/css; charset=utf-8":i==="js"?"text/javascript; charset=utf-8":i==="svg"?"image/svg+xml":i==="woff2"?"font/woff2":i==="woff"?"font/woff":i==="ttf"?"font/ttf":"application/octet-stream";return new Response(o,{headers:{"Content-Type":a,"Cache-Control":"no-cache, no-store, must-revalidate"}})}async function Os(){console.log("[server] Starting qrec server..."),Ft();let e=te(),t={embedder:null,embedderError:null,isIndexing:!1},n=Bun.serve({port:xn,async fetch(s){let r=new URL(s.url),{method:o}=s,{pathname:i}=r;if(o==="GET"&&i==="/health")return cn(e);if(o==="GET"&&i==="/status")return ln(e);if(o==="GET"&&i==="/projects")return dn(e);if(o==="GET"&&i==="/stats/heatmap")return bn(e,r);if(o==="GET"&&i==="/sessions")return fn(e,r);if(o==="GET"&&i.startsWith("/sessions/")&&i.endsWith("/markdown")){let a=i.slice(10,-9);return a?En(e,a):Response.json({error:"Not found"},{status:404})}if(o==="GET"&&i.startsWith("/sessions/")){let a=i.slice(10);return!a||a.includes("/")?Response.json({error:"Not found"},{status:404}):hn(e,a)}return o==="POST"&&i==="/search"?un(e,t,s):o==="POST"&&i==="/query_db"?pn(e,s):o==="GET"&&i==="/settings"?mn():o==="POST"&&i==="/settings"?gn(s):o==="GET"&&i==="/audit/entries"?Rn(e,r):o==="GET"&&i==="/activity/entries"?yn(r):o==="GET"&&i.startsWith("/ui/")?Nn(i,An,"/ui/"):o==="GET"&&i.startsWith("/public/")?Nn(i,As,"/public/"):o==="GET"&&(i==="/"||i==="/search"||i==="/audit"||i==="/debug")?Ls():o==="GET"&&i==="/debug/log"?_n(r):o==="GET"&&i==="/debug/config"?Sn():Response.json({error:"Not found"},{status:404})}});console.log(`[server] Listening on http://localhost:${xn}`),v({type:"daemon_started"}),Zt(e,t),process.on("SIGTERM",()=>{console.log("[server] SIGTERM received, shutting down..."),e.close(),n.stop(),process.exit(0)}),process.on("SIGINT",()=>{console.log("[server] SIGINT received, shutting down..."),e.close(),n.stop(),process.exit(0)})}var vn,re,Cs,xn,wn,Fe,An,In,As,Ln=T(()=>{"use strict";he();De();M();ce();vn=require("fs"),re=require("path");rt();Tn();Cs={},xn=D(),wn=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>qrec</title>
<link rel="icon" type="image/svg+xml" href="/public/favicon.svg">
<link rel="stylesheet" href="/ui/styles.css">
<link rel="stylesheet" href="/ui/components.css">
<script src="https://cdn.jsdelivr.net/npm/marked@13/marked.min.js"></script>
</head>
<body>
<header>
  <img class="logo" src="/public/logo.svg" alt="qrec" onclick="showTab('dashboard')" style="cursor:pointer;">
  <h1 onclick="showTab('dashboard')" style="cursor:pointer;">qrec</h1>
  <nav>
    <button id="nav-dashboard" onclick="showTab('dashboard')">Dashboard</button>
    <button id="nav-search" onclick="showTab('search')">Search</button>
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
    <div id="dashboard-panel"></div>

    <div class="dashboard-recent">
      <div id="recent-sessions-panel"></div>
    </div>

    <div class="activity-section" id="db-activity-feed">
      <div class="activity-section-header">
        <span class="section-heading">Recent Activity</span>
        <span class="activity-live-dot" id="activity-live-dot"></span>
      </div>
      <div class="run-list" id="run-list"></div>
      <button class="show-more-btn" id="activity-show-more" style="display:none;">Show older entries</button>
    </div>

    <div class="last-updated" id="db-last-updated"></div>
  </div> <!-- /.dashboard-wrap -->
</main>
</div>

<!-- \u2500\u2500 Search tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-search" class="tab-panel">
<main>
  <div class="page-header">
    <h2 class="section-heading">Sessions</h2>
    <span class="badge" id="search-count">\u2014</span>
  </div>
  <div class="search-bar">
    <input type="text" id="query" placeholder="Search sessions\u2026">
    <button id="search-btn" onclick="doSearch()">Search</button>
    <button class="btn" id="clear-search-btn" onclick="clearSearch()" style="display:none;">\u2715</button>
  </div>
  <div id="latency-bar" class="latency-bar" style="display:none;"></div>
  <div class="search-toolbar">
    <div class="search-filters">
      <div class="filter-wrap">
        <input type="text" class="search-filter" id="filter-project"
               placeholder="Project\u2026" autocomplete="off"
               oninput="handleFilterInput(this,'project')" onchange="applyFilters()"
               onfocus="showFilterDropdown('project')" onblur="hideFilterDropdown('project')">
        <div class="filter-dropdown" id="dropdown-project" onmousedown="return false;"></div>
      </div>
      <div class="filter-wrap">
        <input type="text" class="search-filter" id="filter-tag"
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
  <div id="sessions-panel"></div>
</main>
</div>

<!-- \u2500\u2500 Session detail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->
<div id="tab-session-detail" class="tab-panel">
<main style="max-width:860px;">
  <div id="detail-loading" class="loading-state"><span class="spinner"></span></div>
  <div id="detail-error" class="error-state" style="display:none;"></div>
  <div id="detail-content" style="display:none;">
    <div id="session-detail-panel"></div>
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

<script src="/ui/components.js"></script>
<script src="/ui/activity-groups.js"></script>
<script src="/ui/app.js"></script>
</body>
</html>
`,Fe=Cs.dir,An=Fe?(0,re.join)(Fe,"..","ui"):(0,re.join)(__dirname,"..","..","ui"),In=(0,re.join)(An,"index.html"),As=Fe?(0,re.join)(Fe,"..","public"):(0,re.join)(__dirname,"..","..","public");Os().catch(e=>{console.error("[server] Fatal error:",e),process.exit(1)})});he();Ye();We();var Dt=require("path"),A=require("fs");M();var Ot={};function us(){(0,A.mkdirSync)(w,{recursive:!0})}function Ct(){if(!(0,A.existsSync)(W))return!1;let e=parseInt((0,A.readFileSync)(W,"utf-8").trim(),10);if(isNaN(e))return!1;try{return process.kill(e,0),!0}catch{try{(0,A.unlinkSync)(W)}catch{}return!1}}function Le(){if(!(0,A.existsSync)(W))return null;let e=parseInt((0,A.readFileSync)(W,"utf-8").trim(),10);return isNaN(e)?null:e}async function kt(){if(Ct()){let a=Le();console.log(`[daemon] qrec server already running (PID ${a})`);return}try{let a=[],c=Bun.spawnSync(["lsof","-ti",`:${D()}`],{stdio:["ignore","pipe","ignore"]});if(c.exitCode===0)a=new TextDecoder().decode(c.stdout).trim().split(`
`).filter(Boolean);else{let d=Bun.spawnSync(["ss","-tlnp",`sport = :${D()}`],{stdio:["ignore","pipe","ignore"]}),p=new TextDecoder().decode(d.stdout).match(/pid=(\d+)/g);p&&(a=p.map(g=>g.replace("pid=","")))}for(let d of a)try{process.kill(parseInt(d),"SIGKILL")}catch{}a.length>0&&await Bun.sleep(300)}catch{}us();let e=q;try{(0,A.writeFileSync)(e,"")}catch{}let t=typeof Ot.dir=="string"?["bun","run",(0,Dt.join)(Ot.dir,"server.ts")]:[process.argv[0],process.argv[1],"serve"],n=Bun.spawn(t,{detached:!0,stdio:["ignore",Bun.file(e),Bun.file(e)],env:process.env}),s=n.pid;(0,A.writeFileSync)(W,String(s),"utf-8"),n.unref(),console.log(`[daemon] qrec server started (PID ${s})`),console.log(`[daemon] Logs: ${e}`),console.log("[daemon] Waiting for server to be ready...");let r=parseInt(process.env.QREC_DAEMON_TIMEOUT_MS??"120000",10),o=Date.now()+r,i=!1;for(;Date.now()<o;){await Bun.sleep(500);try{if((await fetch(`http://localhost:${D()}/health`)).ok){i=!0;break}}catch{}}i?console.log(`[daemon] Server ready at http://localhost:${D()}`):(console.error(`[daemon] Server failed to start within 30 seconds. Check logs: ${e}`),process.exit(1))}async function Ke(){if(!Ct()){console.log("[daemon] No running qrec server found.");return}let e=Le();try{process.kill(e,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to PID ${e}`);let t=Date.now()+5e3;for(;Date.now()<t;){await Bun.sleep(200);try{process.kill(e,0)}catch{break}}}catch(t){console.error(`[daemon] Failed to send SIGTERM: ${t}`)}try{let t=(0,A.existsSync)(B)?(0,A.readFileSync)(B,"utf8").trim():null,n=t?parseInt(t,10):null;n&&(process.kill(n,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to enrich PID ${n}`))}catch{}try{(0,A.unlinkSync)(B)}catch{}try{(0,A.unlinkSync)(W)}catch{}console.log("[daemon] qrec server stopped.")}var oe=require("fs"),Cn=require("os");M();Oe();var[,,On,...R]=process.argv;{let e=R.indexOf("--port");if(e!==-1){let t=R[e+1];(!t||isNaN(parseInt(t,10)))&&(console.error("[cli] --port requires a numeric value"),process.exit(1)),process.env.QREC_PORT=t,R.splice(e,2)}}function ks(e=20){if(!(0,oe.existsSync)(q))return[];try{return(0,oe.readFileSync)(q,"utf-8").split(`
`).filter(s=>s.length>0).slice(-e)}catch{return[]}}function Dn(){let e=process.platform==="darwin"?"open":"xdg-open";try{Bun.spawnSync([e,`http://localhost:${D()}`])}catch{}}async function Ms(){switch(On){case"--version":case"-v":console.log("qrec 0.7.4"),process.exit(0);case"teardown":{let e=R.includes("--yes");await Ke(),(0,oe.existsSync)(w)||(console.log("[teardown] ~/.qrec/ not found, nothing to remove."),process.exit(0)),e||(process.stdout.write(`[teardown] Remove ${w} (DB, model, logs, pid, activity log)? [y/N] `),(await new Promise(n=>{process.stdin.setEncoding("utf-8"),process.stdin.once("data",s=>n(String(s).trim()))})).toLowerCase()!=="y"&&(console.log("[teardown] Aborted."),process.exit(0))),(0,oe.rmSync)(w,{recursive:!0,force:!0}),console.log("[teardown] Removed ~/.qrec/"),process.exit(0)}case"index":{let e,t=!1,n,s;if(!R[0]&&!process.stdin.isTTY){let o=await Bun.stdin.text();try{let i=JSON.parse(o.trim());if(!i.transcript_path)throw new Error("Missing transcript_path");e=i.transcript_path}catch(i){console.error(`[cli] index: failed to parse stdin: ${i}`),process.exit(1)}}else{let o=R.find(c=>!c.startsWith("--"))??`${(0,Cn.homedir)()}/.claude/projects/`;t=R.includes("--force");let i=R.indexOf("--sessions");n=i!==-1?parseInt(R[i+1],10):void 0;let a=R.indexOf("--seed");s=a!==-1?parseInt(R[a+1],10):void 0,e=o.replace("~",process.env.HOME??"")}console.log(`[cli] Indexing: ${e}${n?` (${n} sessions, seed=${s??42})`:""}`);let r=te();try{await _e(r,e,{force:t,sessions:n,seed:s})}finally{r.close(),await Qe()}process.exit(0)}case"serve":{let e=R.includes("--daemon"),t=R.includes("--no-open");e?(await kt(),t||Dn()):(t||setTimeout(Dn,1e3),await Promise.resolve().then(()=>(Ln(),Ds)));break}case"stop":{await Ke();break}case"search":{let e=c=>{let d=R.indexOf(c);return d===-1||d+1>=R.length?null:R[d+1]??null},t=R.filter(c=>!c.startsWith("--")).join(" ").trim(),n=parseInt(e("--k")??"10",10),s=e("--project"),r=e("--tag"),o=e("--from"),i=e("--to");if(!t&&!(s||r||o||i)&&(console.error('[cli] Usage: qrec search "<query>" [--project P] [--tag T] [--from DATE] [--to DATE] [--k N]'),process.exit(1)),t){let c={query:t,k:n};s&&(c.project=s),r&&(c.tag=r),o&&(c.dateFrom=o),i&&(c.dateTo=i);let d=await fetch(`http://localhost:${D()}/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c)});if(!d.ok){let l=await d.json().catch(()=>({}));console.error(`[cli] search failed (${d.status}): ${l.error??"unknown error"}`),process.exit(1)}console.log(JSON.stringify(await d.json(),null,2))}else{let c=new URLSearchParams({offset:"0",limit:String(n)});s&&c.set("project",s),r&&c.set("tag",r),o&&c.set("dateFrom",o),i&&c.set("dateTo",i);let d=await fetch(`http://localhost:${D()}/sessions?${c}`);if(!d.ok){let g=await d.json().catch(()=>({}));console.error(`[cli] browse failed (${d.status}): ${g.error??"unknown error"}`),process.exit(1)}let l=await d.json(),p=l.sessions.map(g=>({id:g.id,date:g.date,project:g.project,title:g.title,tags:Array.isArray(g.tags)?g.tags.join(", "):null,summary:typeof g.summary=="string"?g.summary.slice(0,120)+(g.summary.length>120?"\u2026":""):null}));console.log(JSON.stringify({total:l.total,results:p},null,2))}process.exit(0)}case"get":{let e=R[0]?.trim();e||(console.error("[cli] Usage: qrec get <session-id>"),process.exit(1));let t=await fetch(`http://localhost:${D()}/sessions/${e}/markdown`);t.status===404&&(console.error(`[cli] Session not found: ${e}`),process.exit(1)),t.ok||(console.error(`[cli] get failed (${t.status})`),process.exit(1)),console.log(await t.text()),process.exit(0)}case"status":{let e=te();try{let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get(),n=e.prepare("SELECT COUNT(*) as count FROM chunks").get(),s=e.prepare("SELECT MAX(indexed_at) as last FROM sessions").get(),r=Le(),o=r!==null,i="not checked";if(o)try{let l=await fetch(`http://localhost:${D()}/health`);l.ok?i=(await l.json()).status??"unknown":i=`http error ${l.status}`}catch{i="unreachable"}let a=s.last?new Date(s.last).toISOString():"never",c="0.7.4";if(console.log("=== qrec status ==="),console.log(`Version:        ${c}`),console.log(`Daemon PID:     ${r??"not running"}`),console.log(`HTTP health:    ${i}`),console.log(`Sessions:       ${t.count}`),console.log(`Chunks:         ${n.count}`),console.log(`Last indexed:   ${a}`),process.platform==="linux"){let l=se();console.log(""),console.log("--- Compute ---");let p=l.selectedBackend==="cpu"&&l.gpuDetected?" (fallback \u2014 CUDA libs missing)":"";console.log(`Backend:        ${l.selectedBackend}${p}`),l.gpuDetected?(console.log(`GPU:            ${l.gpuName} (driver ${l.driverVersion}, CUDA ${l.cudaDriverVersion})`),console.log(`CUDA runtime:   ${l.cudaRuntimeAvailable?"available":"NOT AVAILABLE"}`),l.cudaRuntimeAvailable?console.log(`Binary:         ${l.activeBinaryName}`):(console.log(`  Missing libs: ${l.missingLibs.join(", ")}`),l.installSteps&&(console.log("  Fix:"),l.installSteps.forEach((g,h)=>console.log(`    ${h+1}. ${g}`))))):console.log("GPU:            none detected"),l.vulkanAvailable&&console.log("Vulkan:         available")}console.log(""),console.log("--- Log tail (last 20 lines) ---");let d=ks(20);if(d.length===0)console.log("(no log entries)");else for(let l of d)console.log(l)}finally{e.close()}process.exit(0)}case"enrich":{let e=R.indexOf("--limit"),t=e!==-1?parseInt(R[e+1],10):void 0,n=R.indexOf("--min-age-ms"),s=n!==-1?parseInt(R[n+1],10):void 0,r=R.includes("--force"),{runEnrich:o}=await Promise.resolve().then(()=>(Pe(),Qt));await o({limit:t,minAgeMs:s,force:r}),process.exit(0)}case"doctor":{let e=se();console.log("=== qrec doctor ==="),console.log(""),process.platform!=="linux"&&(console.log(`Platform: ${process.platform}`),console.log("Metal/GPU acceleration is handled automatically by node-llama-cpp on macOS."),console.log("No CUDA probe needed."),process.exit(0));let t=r=>`[check] ${r}`,n=r=>`[FAIL]  ${r}`,s=r=>`        ${r}`;e.gpuDetected?console.log(t(`NVIDIA GPU ............ ${e.gpuName} (driver ${e.driverVersion}, CUDA ${e.cudaDriverVersion})`)):console.log(n("NVIDIA GPU ............ not detected (nvidia-smi not found or no output)"));for(let[r,o]of Object.entries(e.libProbes))o.found?console.log(t(`${r.padEnd(14)} .... .so.${o.soVersion} at ${o.path}`)):console.log(n(`${r.padEnd(14)} .... NOT FOUND`));e.vulkanAvailable?console.log(t("Vulkan ................ available")):console.log(t("Vulkan ................ not found (optional)")),e.activeBinaryName&&console.log(t(`node-llama-cpp binary . ${e.activeBinaryName}`)),console.log(""),e.cudaRuntimeAvailable?console.log(`Result: CUDA backend ready (${e.activeBinaryName})`):e.gpuDetected?(console.log("Result: CUDA libs missing \u2014 running on CPU (fallback)"),console.log(""),console.log("Fix:"),e.installSteps&&e.installSteps.forEach((r,o)=>console.log(`  ${o+1}. ${r}`)),e.cudaRepoConfigured===!1&&(console.log(""),console.log(s("Note: NVIDIA apt repo not found in /etc/apt/sources.list.d/")),console.log(s("      The wget step above adds it. Run apt-get update after.")))):console.log("Result: No NVIDIA GPU detected \u2014 running on CPU"),process.exit(0)}default:console.error(`Unknown command: ${On}`),console.error("Usage:"),console.error("  qrec teardown [--yes]             # remove all qrec data"),console.error("  qrec index [path] [--force]       # default: ~/.claude/projects/"),console.error("  qrec index                        # stdin JSON {transcript_path} (hook mode)"),console.error("  qrec serve [--daemon] [--no-open] [--port N]"),console.error("  qrec stop"),console.error('  qrec search "<query>" [--k N]   # search indexed sessions'),console.error("  qrec get <session-id>            # print full session markdown"),console.error("  qrec status"),console.error("  qrec enrich [--limit N]           # summarize unenriched sessions"),console.error("  qrec doctor                       # diagnose GPU/CUDA setup"),process.exit(1)}}Ms().catch(e=>{console.error("Fatal error:",e),process.exit(1)});
