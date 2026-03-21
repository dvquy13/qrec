#!/usr/bin/env bun
"use strict";var Zn=Object.create;var Je=Object.defineProperty;var es=Object.getOwnPropertyDescriptor;var ts=Object.getOwnPropertyNames;var ns=Object.getPrototypeOf,ss=Object.prototype.hasOwnProperty;var w=(e,t)=>()=>(e&&(t=e(e=0)),t);var fe=(e,t)=>{for(var n in t)Je(e,n,{get:t[n],enumerable:!0})},rs=(e,t,n,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of ts(t))!ss.call(e,r)&&r!==n&&Je(e,r,{get:()=>t[r],enumerable:!(s=es(t,r))||s.enumerable});return e};var Ie=(e,t,n)=>(n=e!=null?Zn(ns(e)):{},rs(t||!e||!e.__esModule?Je(n,"default",{value:e,enumerable:!0}):n,e));function C(){return parseInt(process.env.QREC_PORT??"25927",10)}var U,wt,x,vr,Tt,J,H,he,G,Oe,Ee,X,ye,k=w(()=>{"use strict";U=require("path"),wt=require("os"),x=process.env.QREC_DIR??(0,U.join)((0,wt.homedir)(),".qrec"),vr=parseInt(process.env.QREC_PORT??"25927",10);Tt=(0,U.join)(x,"qrec.db"),J=(0,U.join)(x,"qrec.pid"),H=(0,U.join)(x,"enrich.pid"),he=(0,U.join)(x,"enrich-progress.json"),G=(0,U.join)(x,"qrec.log"),Oe=(0,U.join)(x,"activity.jsonl"),Ee=(0,U.join)(x,"config.json"),X=(0,U.join)(x,"models"),ye=(0,U.join)(x,"archive")});function ys(){let e=process.env.BREW_PREFIX||process.env.HOMEBREW_PREFIX,t=[];e&&(t.push(`${e}/opt/sqlite/lib/libsqlite3.dylib`),t.push(`${e}/lib/libsqlite3.dylib`)),t.push("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib"),t.push("/usr/local/opt/sqlite/lib/libsqlite3.dylib");for(let n of t)try{if((0,Ce.statSync)(n).size>0)return n}catch{}return null}function se(e=et){let t=e.replace(/\/[^/]+$/,"");(0,Ce.mkdirSync)(t,{recursive:!0});let n=new Ze.Database(e);return n.loadExtension(bs),n.exec("PRAGMA journal_mode = WAL"),n.exec("PRAGMA synchronous = NORMAL"),n.exec("PRAGMA cache_size = -32000"),n.exec("PRAGMA foreign_keys = ON"),Rs(n),n}function Rs(e){e.exec(`
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
  `)}var Ze,xt,Ce,et,bs,be=w(()=>{"use strict";Ze=require("bun:sqlite"),xt=require("sqlite-vec"),Ce=require("fs");k();et=Tt;if(process.platform==="darwin"){let e=ys();if(!e)throw new Error(`sqlite-vec requires a Homebrew SQLite build that supports dynamic extension loading. Install with: brew install sqlite
Then set BREW_PREFIX if Homebrew is in a non-standard location.`);Ze.Database.setCustomSQLite(e)}bs=(0,xt.getLoadablePath)()});function It(e){if(e.length<=3600)return[{text:e,pos:0}];let t=_s(e),n=[],s="",r=0;for(let i of t){let a=s?s+`

`+i.text:i.text;if(a.length<=3600)s||(r=i.pos),s=a;else if(s){n.push({text:s.trim(),pos:r});let o=s.slice(-vt),c=r+s.length-o.length;s=o+`

`+i.text,r=c}else{let o=Ss(i.text,i.pos);if(o.length>1){for(let d=0;d<o.length-1;d++)n.push(o[d]);let c=o[o.length-1];s=c.text,r=c.pos}else s=i.text,r=i.pos}}return s.trim()&&n.push({text:s.trim(),pos:r}),n}function _s(e){let t=/^(#{1,6} .+)$/m,n=[],s=0,r=[],i,a=/^(#{1,6} .+)$/gm;for(;(i=a.exec(e))!==null;)i.index>0&&r.push(i.index);if(r.length===0)return[{text:e,pos:0}];for(let c of r){let d=e.slice(s,c);d.trim()&&n.push({text:d.trim(),pos:s}),s=c}let o=e.slice(s);return o.trim()&&n.push({text:o.trim(),pos:s}),n.length>0?n:[{text:e,pos:0}]}function Ss(e,t){let n=[],s=0;for(;s<e.length;){let r=s+3600;if(r>=e.length){n.push({text:e.slice(s).trim(),pos:t+s});break}let i=e.lastIndexOf(`

`,r);if(i>s+3600*.5)r=i;else{let a=e.lastIndexOf(`
`,r);a>s+3600*.5&&(r=a)}n.push({text:e.slice(s,r).trim(),pos:t+s}),s=Math.max(s+1,r-vt)}return n}var vt,At=w(()=>{"use strict";vt=Math.floor(540)});var T,De=w(()=>{"use strict";T={phase:"starting",modelDownload:{percent:0,downloadedMB:0,totalMB:null},indexing:{indexed:0,total:0,current:""}}});function A(e){let t={ts:Date.now(),...e};try{(0,Y.mkdirSync)(x,{recursive:!0}),(0,Y.appendFileSync)(Oe,JSON.stringify(t)+`
`,"utf-8")}catch(n){console.warn("[activity] Failed to write activity log:",n)}}function Nt(e=100){if(!(0,Y.existsSync)(Oe))return[];try{return(0,Y.readFileSync)(Oe,"utf-8").split(`
`).filter(s=>s.trim().length>0).map(s=>{try{return JSON.parse(s)}catch{return null}}).filter(s=>s!==null).slice(-e).reverse()}catch(t){return console.warn("[activity] Failed to read activity log:",t),[]}}var Y,ue=w(()=>{"use strict";Y=require("fs");k()});var Dt={};fe(Dt,{disposeEmbedder:()=>nt,getEmbedder:()=>xs});async function ws(){if(!process.env.QREC_DIR&&(0,Me.existsSync)(tt))return console.log(`[embed] Found model at legacy path: ${tt}`),tt;console.log(`[embed] Resolving model: ${Lt}`),(0,Me.mkdirSync)(X,{recursive:!0}),T.phase="model_download",T.modelDownload={percent:0,downloadedMB:0,totalMB:null};let{resolveModelFile:e}=await import("node-llama-cpp"),t=await e(Lt,{directory:X,onProgress({totalSize:n,downloadedSize:s}){T.modelDownload={percent:n?Math.round(s/n*100):0,downloadedMB:+(s/1048576).toFixed(1),totalMB:n?+(n/1048576).toFixed(1):null}}});return console.log(`[embed] Model ready at ${t}`),T.modelDownload.totalMB!==null&&A({type:"embed_model_downloaded",data:{totalMB:T.modelDownload.totalMB}}),t}async function Ts(){let e=await ws();T.phase="model_loading",console.log(`[embed] Loading model from ${e}`);let{getLlama:t}=await import("node-llama-cpp");_e=await t();let s=await(await _e.loadModel({modelPath:e})).createEmbeddingContext({contextSize:8192});return console.log("[embed] Model loaded, embedding dimensions: 768"),s}async function nt(){de&&(await de.dispose(),de=null),_e&&(await _e.dispose(),_e=null,Re=null)}async function xs(){return Re||(Re=Ts().catch(e=>{throw Re=null,e})),de||(de=await Re),{dimensions:768,async embed(e){let t=de,n=24e3,s=e.length>n?e.slice(0,n):e;s!==e&&console.warn(`[embed] Truncated chunk from ${e.length} to ${n} chars`);let r=await t.getEmbeddingFor(s);return new Float32Array(r.vector)}}}var Ot,Ct,Me,Lt,tt,_e,de,Re,st=w(()=>{"use strict";Ot=require("path"),Ct=require("os"),Me=require("fs");k();De();ue();Lt="hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",tt=(0,Ot.join)((0,Ct.homedir)(),".cache","qmd","models","hf_ggml-org_embeddinggemma-300M-Q8_0.gguf"),_e=null,de=null,Re=null});var Mt={};fe(Mt,{getOllamaEmbedder:()=>As});function As(){let e=process.env.QREC_OLLAMA_HOST??vs,t=process.env.QREC_OLLAMA_MODEL??Is;return console.log(`[embed/ollama] Using Ollama at ${e}, model: ${t}`),{dimensions:768,async embed(n){let s=await fetch(`${e}/api/embeddings`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:t,prompt:n})});if(!s.ok){let i=await s.text().catch(()=>"");throw new Error(`Ollama embeddings request failed: HTTP ${s.status} \u2014 ${i}`)}let r=await s.json();if(!Array.isArray(r.embedding)||r.embedding.length===0)throw new Error("Ollama returned empty or invalid embedding");return new Float32Array(r.embedding)}}}var vs,Is,kt=w(()=>{"use strict";vs="http://localhost:11434",Is="nomic-embed-text"});var Pt={};fe(Pt,{getOpenAIEmbedder:()=>Os});function Os(){let e=process.env.QREC_OPENAI_KEY;if(!e)throw new Error("QREC_OPENAI_KEY environment variable is required for OpenAI embedding backend");let t=(process.env.QREC_OPENAI_BASE_URL??Ns).replace(/\/$/,""),n=process.env.QREC_OPENAI_MODEL??Ls,s=parseInt(process.env.QREC_OPENAI_DIMENSIONS??String(768),10);return console.log(`[embed/openai] Using OpenAI-compatible API at ${t}, model: ${n}, dimensions: ${s}`),{dimensions:s,async embed(r){let i={model:n,input:r};n.startsWith("text-embedding-3")&&(i.dimensions=s);let a=await fetch(`${t}/embeddings`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e}`},body:JSON.stringify(i)});if(!a.ok){let c=await a.text().catch(()=>"");throw new Error(`OpenAI embeddings request failed: HTTP ${a.status} \u2014 ${c}`)}let o=await a.json();if(!o.data?.[0]?.embedding||o.data[0].embedding.length===0)throw new Error("OpenAI returned empty or invalid embedding");return new Float32Array(o.data[0].embedding)}}}var Ns,Ls,$t=w(()=>{"use strict";Ns="https://api.openai.com/v1",Ls="text-embedding-3-small"});var Ut={};fe(Ut,{getStubEmbedder:()=>Cs});function Cs(){return{dimensions:768,async embed(e){return jt}}}var jt,Ft=w(()=>{"use strict";jt=new Float32Array(768);jt[0]=1});async function ke(){let e=(process.env.QREC_EMBED_PROVIDER??"local").toLowerCase().trim();switch(e){case"local":case"":{let{getEmbedder:t}=await Promise.resolve().then(()=>(st(),Dt));return t()}case"ollama":{let{getOllamaEmbedder:t}=await Promise.resolve().then(()=>(kt(),Mt));return t()}case"openai":{let{getOpenAIEmbedder:t}=await Promise.resolve().then(()=>($t(),Pt));return t()}case"stub":{let{getStubEmbedder:t}=await Promise.resolve().then(()=>(Ft(),Ut));return t()}default:throw new Error(`Unknown QREC_EMBED_PROVIDER: "${e}". Valid values: local, ollama, openai, stub`)}}var rt=w(()=>{"use strict"});function Ds(e){let t=e;for(;;){try{if((0,Se.statSync)((0,F.join)(t,".claude")).isDirectory())return(0,F.basename)(t)}catch{}let n=(0,F.dirname)(t);if(n===t)break;t=n}for(t=e;;){try{if((0,Se.statSync)((0,F.join)(t,".git")).isDirectory())return(0,F.basename)(t)}catch{}let n=(0,F.dirname)(t);if(n===t)break;t=n}return(0,F.basename)(e)}function Bt(e){return e.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g,"").replace(/<[^>]+\/>/g,"").trim()}function Ms(e,t){let s={Bash:"command",Read:"file_path",Write:"file_path",Edit:"file_path",Glob:"pattern",Grep:"pattern",WebFetch:"url",WebSearch:"query",Agent:"description"}[e],r=s&&typeof t[s]=="string"?t[s]:JSON.stringify(t),i=r.length>80?r.slice(0,80)+"\u2026":r;return`${e}: \`${i}\``}function ks(e){if(typeof e=="string")return{text:Bt(e).trim(),isToolResult:!1};if(!Array.isArray(e))return{text:"",isToolResult:!1};if(e.every(s=>s?.type==="tool_result"))return{text:"",isToolResult:!0};let n=[];for(let s of e)if(s?.type==="text"&&typeof s.text=="string"){let r=Bt(s.text).trim();r&&n.push(r)}return{text:n.join(`
`).trim(),isToolResult:!1}}function Ps(e){if(!Array.isArray(e))return{text:"",tools:[],thinking:[]};let t=[],n=[],s=[];for(let r of e)if(r?.type==="text"&&typeof r.text=="string"){let i=r.text.trim();i&&t.push(i)}else if(r?.type==="tool_use"&&r.name)n.push(Ms(r.name,r.input??{}));else if(r?.type==="thinking"&&typeof r.thinking=="string"){let i=r.thinking.trim();i&&s.push(i)}return{text:t.join(`
`).trim(),tools:n,thinking:s}}async function we(e){let t=(0,Se.readFileSync)(e,"utf-8"),n=(0,qt.createHash)("sha256").update(t).digest("hex"),r=(0,F.basename)(e,".jsonl").replace(/-/g,"").slice(0,8),i=t.split(`
`).filter(l=>l.trim()).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(l=>l!==null),a="",o="",c=null,d=[],u=[];for(let l of i){if(l.timestamp&&u.push(Date.parse(l.timestamp)),l.type==="file-history-snapshot"||l.type==="system"||l.type==="progress"||l.isMeta||l.isSidechain)continue;let f=l.message;if(f){if(!a&&l.cwd&&(a=Ds(l.cwd)),!o&&l.timestamp&&(o=l.timestamp.slice(0,10)),f.role==="user"&&l.type==="user"){let{text:E,isToolResult:I}=ks(f.content);if(I||!E)continue;c||(c=E.slice(0,120)),d.push({role:"user",text:E,tools:[],thinking:[],timestamp:l.timestamp??null})}if(f.role==="assistant"&&l.type==="assistant"){let{text:E,tools:I,thinking:W}=Ps(f.content);if(!E&&I.length===0&&W.length===0)continue;d.push({role:"assistant",text:E,tools:I,thinking:W,timestamp:l.timestamp??null})}}}let g=900*1e3;u.sort((l,f)=>l-f);let y=0;for(let l=1;l<u.length;l++)y+=Math.min(u[l]-u[l-1],g);let p=Math.round(y/1e3),m=u.length>0?u[u.length-1]:Date.now();return{session_id:r,path:e,project:a,date:o,title:c,hash:n,duration_seconds:p,last_message_at:m,turns:d}}function Ht(e){let t=[`# Session: ${e.project} \u2014 ${e.date}`,""];e.title&&t.push(`_${e.title}_`,"");for(let n of e.turns)if(n.role==="user")t.push("## User","",n.text,"");else{t.push("## Assistant",""),n.text&&t.push(n.text,"");for(let s of n.tools)t.push(`> **Tool:** ${s}`);n.tools.length>0&&t.push("")}return t.join(`
`)}function Gt(e){let t=[];for(let n of e.turns){n.text&&t.push(`[${n.role==="user"?"User":"Assistant"}] ${n.text}`);for(let s of n.tools)t.push(`[Tool] ${s}`)}return t.join(`
`)}var qt,Se,F,ot=w(()=>{"use strict";qt=require("crypto"),Se=require("fs"),F=require("path")});function $s(e){let t=[];for(let n of(0,D.readdirSync)(e)){let s=(0,re.join)(e,n);if((0,D.statSync)(s).isDirectory())for(let r of(0,D.readdirSync)(s))r.endsWith(".jsonl")&&t.push((0,re.join)(s,r));else n.endsWith(".jsonl")&&t.push(s)}return t}function js(e){return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function Us(e,t,n){let s=js(n),r=[...e];for(let i=r.length-1;i>0;i--){let a=Math.floor(s()*(i+1));[r[i],r[a]]=[r[a],r[i]]}return r.slice(0,t)}async function Vt(e,t=2){try{let n=await we(e);if(n.turns.filter(i=>i.role==="user").length<t)return null;let r=Gt(n);return r.trim()?{id:n.session_id,path:e,project:n.project,date:n.date,title:n.title,hash:n.hash,duration_seconds:n.duration_seconds,last_message_at:n.last_message_at,chunkText:r}:null}catch(n){return console.warn("[indexer] Failed to parse JSONL:",e,n),null}}function Fs(e,t,n){if(!e.startsWith(n))try{let s=(0,re.join)(n,t);(0,D.mkdirSync)(s,{recursive:!0}),(0,D.copyFileSync)(e,(0,re.join)(s,(0,re.basename)(e)))}catch(s){console.warn(`[indexer] Archive failed for ${e}: ${s}`)}}async function Te(e,t,n={},s,r){let i=r??await ke(),a=t.endsWith(".jsonl")&&(0,D.existsSync)(t),o=!a&&(0,D.existsSync)(t)&&(0,D.statSync)(t).isDirectory(),c=new Map,d=e.prepare("SELECT path, indexed_at FROM sessions").all();for(let b of d)c.set(b.path,b.indexed_at);let u=[];if(a){let b=await Vt(t,Qt);if(!b){console.log("[indexer] Session skipped (too few user turns or empty)");return}u=[b]}else if(o){let b=$s(t),L=n.force?b:b.filter(P=>{let le=c.get(P);return le?(0,D.statSync)(P).mtimeMs>=le:!0}),ee=b.length-L.length;console.log(`[indexer] Found ${b.length} JSONL files (${ee} skipped by mtime, ${L.length} to check)`),u=(await Promise.all(L.map(P=>Vt(P,Qt)))).filter(P=>P!==null)}else{console.error(`[indexer] Path not found or not a JSONL/directory: ${t}`);return}let g=new Map,y=e.prepare("SELECT id, hash FROM sessions").all();for(let b of y)g.set(b.id,b.hash);if(n.sessions&&n.sessions<u.length){let b=n.seed??42;u=Us(u,n.sessions,b),console.log(`[indexer] Sampled ${u.length} sessions (seed=${b})`)}let p=u.filter(({id:b,hash:L})=>n.force?!0:g.get(b)!==L),m=u.length-p.length,l=a?1:u.length;console.log(`[indexer] ${p.length} sessions to index (${l} total, ${m} up-to-date)`);let f=e.prepare(`
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
  `),E=e.prepare(`
    INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),I=e.prepare(`
    INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding)
    VALUES (?, ?)
  `),W=e.prepare("DELETE FROM chunks WHERE session_id = ?"),Z=e.prepare("DELETE FROM chunks_vec WHERE chunk_id LIKE ?");for(let b=0;b<p.length;b++){let{id:L,path:ee,project:ce,date:P,title:le,hash:xe,duration_seconds:Ve,last_message_at:Qe,chunkText:We}=p[b],ge=n.archiveDir===void 0?ye:n.archiveDir;ge!==null&&Fs(ee,ce,ge);let ve=It(We),h=Date.now(),_=e.transaction(()=>(W.run(L),Z.run(`${L}_%`),f.run(L,ee,ce,P,le,xe,h,Ve,Qe),ve))();process.stdout.write(`[${b+1}/${p.length}] ${L} (${ce}/${P}) \u2014 ${_.length} chunks
`),s?.(b,p.length,L);let v=e.transaction(O=>{for(let{chunkId:B,seq:$,pos:te,text:Kn,embedding:zn}of O)E.run(B,L,$,te,Kn,h),I.run(B,Buffer.from(zn.buffer))}),S=[];for(let O=0;O<_.length;O++){let B=_[O],$=`${L}_${O}`,te=await i.embed(B.text);S.push({chunkId:$,seq:O,pos:B.pos,text:B.text,embedding:te})}v(S)}s?.(p.length,p.length,""),console.log(`[indexer] Done. Total sessions indexed: ${p.length}`)}async function Wt(e,t){let n=e.prepare(`
    SELECT c.id, c.text FROM chunks c
    LEFT JOIN chunks_vec v ON v.chunk_id = c.id
    WHERE c.seq = -1 AND v.chunk_id IS NULL
  `).all();if(n.length===0)return;console.log(`[indexer] Embedding ${n.length} summary chunk(s) into chunks_vec`);let s=e.prepare("INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)");for(let{id:r,text:i}of n){let a=await t.embed(i);s.run(r,Buffer.from(a.buffer))}console.log("[indexer] Summary chunks embedded.")}var D,re,Qt,it=w(()=>{"use strict";D=require("fs"),re=require("path");k();At();rt();ot();Qt=2});function Zt(e,t){for(let n of t)for(let s of e){let r=`${n}/${s}`;if((0,V.existsSync)(r)){let i=s.match(/\.so\.(\d+)/);return{path:r,soVersion:i?.[1]??null}}}return null}function Hs(){try{let e=Bun.spawnSync(["nvidia-smi","--query-gpu=name,driver_version","--format=csv,noheader,nounits"]);if(e.exitCode!==0||!e.stdout)return null;let t=e.stdout.toString("utf-8").trim().split(", ");if(t.length<2)return null;let n=t[0].trim(),s=t[1].trim(),i=Bun.spawnSync(["nvidia-smi"]).stdout?.toString("utf-8").match(/CUDA Version:\s*([\d.]+)/);return{name:n,driver:s,cudaVersion:i?.[1]??"unknown"}}catch{return null}}function Gs(){try{let e=(0,V.readFileSync)("/etc/os-release","utf-8"),t={};for(let n of e.split(`
`)){let s=n.match(/^(\w+)="?([^"]*)"?$/);s&&(t[s[1]]=s[2])}return t}catch{return{}}}function Vs(){return(0,V.existsSync)("/usr/bin/apt-get")?"apt":(0,V.existsSync)("/usr/bin/dnf")?"dnf":(0,V.existsSync)("/usr/bin/yum")?"yum":(0,V.existsSync)("/usr/bin/pacman")?"pacman":"unknown"}function Qs(){try{return(0,V.readdirSync)("/etc/apt/sources.list.d").some(e=>e.startsWith("cuda")||e.includes("nvidia"))}catch{return!1}}function Ws(e){let t=e.libcudart,n=e.libcublas;return!t?.found||!n?.found?"linux-x64":t.soVersion==="13"&&n.soVersion==="13"?"linux-x64-cuda":"linux-x64-cuda-ext"}function Js(e,t,n){let s=e.cudaVersion!=="unknown"?e.cudaVersion.split(".").slice(0,2).join("-"):"12-8",r=s.split("-")[0],i=[];if(t==="apt"){if(!n){let a=Gs(),o=a.ID?.toLowerCase()??"ubuntu",c=a.VERSION_ID?.replace(".","")??"2204";i.push(`wget https://developer.download.nvidia.com/compute/cuda/repos/${o}${c}/x86_64/cuda-keyring_1.1-1_all.deb`),i.push("sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt-get update")}i.push(`sudo apt install -y cuda-cudart-${s} libcublas-${s}`)}else t==="dnf"||t==="yum"?i.push(`sudo ${t} install -y cuda-cudart-${s} libcublas-${s}`):t==="pacman"?i.push("sudo pacman -S cuda"):(i.push("# Install CUDA runtime libs from your package manager or the NVIDIA CUDA toolkit"),i.push(`# Required: libcudart.so.${r}, libcublas.so.${r}, libcublasLt.so.${r}`));return i.push("qrec teardown && qrec serve --daemon"),i}function oe(){if(pe)return pe;if(process.platform!=="linux")return pe={gpuDetected:!1,gpuName:null,driverVersion:null,cudaDriverVersion:null,cudaRuntimeAvailable:!1,vulkanAvailable:!1,missingLibs:[],libProbes:{},selectedBackend:"cpu",activeBinaryName:null,pkgManager:"unknown",cudaRepoConfigured:null,advice:null,installSteps:null},pe;let e=Hs(),t={},n=[];for(let y of qs){let p=Zt(y.variants,zt);t[y.name]={found:p!==null,path:p?.path??null,soVersion:p?.soVersion??null},p||n.push(y.name)}let s=Zt(["libvulkan.so","libvulkan.so.1"],zt),r=e!==null&&n.length===0,i=s!==null,a=r?"cuda":i?"vulkan":"cpu",o=r?Ws(t):"linux-x64",c=Vs(),d=c==="apt"?Qs():null,u=null,g=null;return e&&!r&&(u=`GPU detected (${e.name}) but CUDA runtime libs missing: ${n.join(", ")}.`,g=Js(e,c,d)),pe={gpuDetected:e!==null,gpuName:e?.name??null,driverVersion:e?.driver??null,cudaDriverVersion:e?.cudaVersion??null,cudaRuntimeAvailable:r,vulkanAvailable:i,missingLibs:n,libProbes:t,selectedBackend:a,activeBinaryName:o,pkgManager:c,cudaRepoConfigured:d,advice:u,installSteps:g},pe}var V,zt,qs,pe,$e=w(()=>{"use strict";V=require("node:fs"),zt=["/usr/lib","/usr/lib64","/usr/lib/x86_64-linux-gnu","/usr/lib/aarch64-linux-gnu","/usr/local/cuda/lib64","/usr/local/cuda/targets/x86_64-linux/lib","/usr/local/cuda/targets/aarch64-linux/lib",...process.env.LD_LIBRARY_PATH?.split(":").filter(Boolean)??[],...process.env.CUDA_PATH?[`${process.env.CUDA_PATH}/lib64`]:[]],qs=[{name:"libcudart",variants:["libcudart.so","libcudart.so.11","libcudart.so.12","libcudart.so.13"]},{name:"libcublas",variants:["libcublas.so","libcublas.so.11","libcublas.so.12","libcublas.so.13"]},{name:"libcublasLt",variants:["libcublasLt.so","libcublasLt.so.11","libcublasLt.so.12","libcublasLt.so.13"]}];pe=null});function z(e=Ee){try{let t=JSON.parse((0,K.readFileSync)(e,"utf-8"));return{...en,...t}}catch(t){return t.code!=="ENOENT"&&console.warn("[config] Failed to parse config.json, using defaults:",t),{...en}}}function tn(e=Ee){(0,K.existsSync)(e)||ct({},e)}function ct(e,t=Ee){let s={...z(t),...e},r=t===Ee?x:t.replace(/\/[^/]+$/,"");return(0,K.mkdirSync)(r,{recursive:!0}),(0,K.writeFileSync)(t,JSON.stringify(s,null,2),"utf-8"),s}var K,en,je=w(()=>{"use strict";K=require("fs");k();en={enrichEnabled:!0,enrichIdleMs:300*1e3,indexIntervalMs:6e4}});var nn,sn=w(()=>{"use strict";nn=`You are a concise technical summarizer for AI coding sessions.
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
- No explanation outside the JSON block`});function Xs(e,t=6e3){let n=e.split(`
`),s=[],r=0;for(let i of n)if(!i.startsWith("[Tool]")){if(r+i.length>t){s.push("... (truncated)");break}s.push(i),r+=i.length+1}return s.join(`
`)}function Ue(e){return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}function Ys(e){let t=e.replace(/<think>[\s\S]*?<\/think>/g,"").trim(),n=t.match(/\{[\s\S]*\}/);if(!n)return{title:"",summary:t.slice(0,500)||"",tags:[],entities:[],learnings:[],questions:[]};try{let s=JSON.parse(n[0]);return{title:typeof s.title=="string"?s.title:"",summary:typeof s.summary=="string"?s.summary:"",tags:Ue(s.tags),entities:Ue(s.entities),learnings:Ue(s.learnings),questions:Ue(s.questions)}}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}}async function rn(e,t){let{LlamaChatSession:n}=await import("node-llama-cpp"),s=e.ctx.getSequence(),r=new n({contextSequence:s,systemPrompt:nn}),a=`/no_think

Transcript:

${Xs(t)}

JSON summary:`;try{let o=await r.prompt(a,{maxTokens:600,temperature:.1});return Ys(o)}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}finally{s.dispose()}}var on=w(()=>{"use strict";sn()});var un={};fe(un,{ENRICHMENT_VERSION:()=>Q,ENRICH_PID_FILE:()=>H,disposeSummarizer:()=>ut,isEnrichAlive:()=>dt,isProcessAlive:()=>Be,loadSummarizer:()=>an,readEnrichPid:()=>Fe,runEnrich:()=>tr,selectPendingSessions:()=>ln});function Fe(){if(!(0,M.existsSync)(H))return null;let e=parseInt((0,M.readFileSync)(H,"utf-8").trim(),10);return isNaN(e)?null:e}function Be(e){try{return process.kill(e,0),!0}catch{return!1}}function dt(){let e=Fe();return e!==null&&Be(e)}function zs(e){(0,M.mkdirSync)(x,{recursive:!0}),(0,M.writeFileSync)(H,String(e),"utf-8")}function lt(){try{(0,M.unlinkSync)(H)}catch{}}async function an(){let{resolveModelFile:e,getLlama:t}=await import("node-llama-cpp");(0,M.mkdirSync)(X,{recursive:!0}),process.stdout.write(`[enrich] Resolving model...
`);let n=-1,s=!1,r=null,i=await e(Ks,{directory:X,onProgress({totalSize:d,downloadedSize:u}){s=!0;let g=d?Math.round(u/d*100):0;if(process.stdout.write(`\r[enrich] Downloading model... ${g}%`),Math.abs(g-n)>=5){n=g;let y=d?Math.round(d/1024/1024):null;r=y;let p=Math.round(u/1024/1024);try{(0,M.writeFileSync)(he,JSON.stringify({percent:g,downloadedMB:p,totalMB:y}),"utf-8")}catch{}}}});s&&process.stdout.write(`
`),process.stdout.write(`[enrich] Model ready at ${i}
`);let a=await t(),o=await a.loadModel({modelPath:i}),c=await o.createContext({contextSize:8192,sequences:1,flashAttention:!0});console.log("[enrich] Model loaded.");try{(0,M.unlinkSync)(he)}catch{}return s&&A({type:"enrich_model_downloaded",data:{totalMB:r}}),A({type:"enrich_model_loaded"}),{llama:a,model:o,ctx:c}}async function ut(e){await e.ctx.dispose(),await e.model.dispose(),await e.llama.dispose()}function Zs(e,t){return e.prepare("SELECT text FROM chunks WHERE session_id = ? ORDER BY seq").all(t).map(s=>s.text).join(`

`)}function cn(e,t,n,s=[],r=[]){return[e,t.length>0?"Tags: "+t.join(", "):"",n.length>0?"Entities: "+n.join(", "):"",s.length>0?"Learnings: "+s.join(" "):"",r.length>0?"Questions: "+r.join(" "):""].filter(Boolean).join(`
`)}function er(e){let t=e.prepare(`SELECT id, summary, tags, entities, learnings, questions FROM sessions
     WHERE enriched_at IS NOT NULL
       AND id NOT IN (SELECT session_id FROM chunks WHERE id = session_id || '_summary')`).all();if(t.length===0)return;console.log(`[enrich] Backfilling summary chunks for ${t.length} already-enriched session(s)`);let n=e.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let s of t){if(!s.summary)continue;let r=s.tags?JSON.parse(s.tags):[],i=s.entities?JSON.parse(s.entities):[],a=s.learnings?JSON.parse(s.learnings):[],o=s.questions?JSON.parse(s.questions):[],c=cn(s.summary,r,i,a,o);n.run(`${s.id}_summary`,s.id,-1,-1,c,Date.now())}console.log("[enrich] Backfill done.")}function ln(e,t){let n=t.minAgeMs!==void 0?Date.now()-t.minAgeMs:null,s;return t.force?s=n!==null?e.prepare("SELECT id FROM sessions WHERE last_message_at < ?").all(n):e.prepare("SELECT id FROM sessions").all():s=n!==null?e.prepare("SELECT id FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").all(Q,n):e.prepare("SELECT id FROM sessions WHERE enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?").all(Q),t.limit!==void 0?s.slice(0,t.limit):s}async function tr(e={}){zs(process.pid);let t=se();try{er(t);let n=ln(t,e);if(e.limit!==void 0&&(n=n.slice(0,e.limit)),n.length===0){console.log("[enrich] No pending sessions. Exiting without loading model.");return}console.log(`[enrich] ${n.length} session(s) to enrich`);let s=Date.now();A({type:"enrich_started",data:{pending:n.length}});let r=0,i=!1,a=null;try{a=await an();let o=t.prepare("UPDATE sessions SET summary=?, tags=?, entities=?, learnings=?, questions=?, title = CASE WHEN ? != '' THEN ? ELSE title END, enriched_at=?, enrichment_version=? WHERE id=?"),c=t.prepare("DELETE FROM chunks WHERE id = ?"),d=t.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let u=0;u<n.length;u++){let{id:g}=n[u],y=Zs(t,g);if(!y.trim()){t.prepare("UPDATE sessions SET enriched_at=?, enrichment_version=? WHERE id=?").run(Date.now(),Q,g),console.log(`[${u+1}/${n.length}] ${g} \u2014 skip (no chunks)`);continue}let p=Date.now(),m=await rn(a,y),l=Date.now()-p,f=Date.now();if(o.run(m.summary,JSON.stringify(m.tags),JSON.stringify(m.entities),JSON.stringify(m.learnings),JSON.stringify(m.questions),m.title,m.title,f,Q,g),m.summary||m.tags.length>0||m.entities.length>0||m.learnings.length>0||m.questions.length>0){let E=cn(m.summary,m.tags,m.entities,m.learnings,m.questions);c.run(`${g}_summary`),d.run(`${g}_summary`,g,-1,-1,E,f)}A({type:"session_enriched",data:{sessionId:g,latencyMs:l}}),r++,console.log(`[${u+1}/${n.length}] ${g} \u2014 ${l}ms`),m.summary&&console.log(`  Summary: ${m.summary.slice(0,100)}`),m.tags.length>0&&console.log(`  Tags: ${m.tags.join(", ")}`),m.learnings.length>0&&console.log(`  Learnings: ${m.learnings.length}`),m.questions.length>0&&console.log(`  Questions: ${m.questions.length}`)}A({type:"enrich_complete",data:{enriched:r,durationMs:Date.now()-s}}),console.log("[enrich] Done."),t.close(),lt(),i=!0,await ut(a)}finally{if(!i){A({type:"enrich_complete",data:{enriched:r,durationMs:Date.now()-s}});try{t.close()}catch{}if(lt(),a)try{await ut(a)}catch{}}}}finally{try{t.close()}catch{}lt()}}var M,Q,Ks,qe=w(()=>{"use strict";M=require("fs");k();be();on();ue();Q=3,Ks="hf:bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen_Qwen3-1.7B-Q4_K_M.gguf"});function pn(e){if(!z().enrichEnabled)return;let t=Fe();if(t!==null&&Be(t)){console.log("[server] Enrich child already running, skipping spawn.");return}let n=z().enrichIdleMs,s=Date.now()-n;if(e.prepare("SELECT COUNT(*) as n FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").get(Q,s).n===0)return;let i=G,a=typeof gn.dir=="string"?["bun","run",(0,mt.join)(gn.dir,"cli.ts"),"enrich"]:[process.argv[0],process.argv[1],"enrich"],o=Bun.spawn([...a,"--min-age-ms",String(n)],{detached:!0,stdio:["ignore",Bun.file(i),Bun.file(i)]});o.unref(),console.log(`[server] Spawned enrich child (PID ${o.pid})`)}async function mn(e,t,n=!1){if(t.isIndexing||!(0,pt.existsSync)(dn))return;t.isIndexing=!0;let s=Date.now();n&&A({type:"index_started"}),n&&(T.phase="indexing"),T.indexing={indexed:0,total:0,current:""};let r=0,i=-1,a=[];try{if(await Te(e,dn,{},(o,c,d)=>{T.indexing={indexed:o,total:c,current:d},d&&o>i&&(n?A({type:"session_indexed",data:{sessionId:d}}):a.push(d),r++,i=o)}),n&&(0,pt.existsSync)(ye)&&(i=-1,await Te(e,ye,{},(o,c,d)=>{T.indexing={indexed:o,total:c,current:d},d&&o>i&&(A({type:"session_indexed",data:{sessionId:d}}),r++,i=o)})),!n&&r>0){A({type:"index_started"});for(let o of a)A({type:"session_indexed",data:{sessionId:o}})}(n||r>0)&&A({type:"index_complete",data:{newSessions:r,durationMs:Date.now()-s}}),t.embedder&&await Wt(e,t.embedder)}catch(o){console.error("[server] Index error:",o)}finally{t.isIndexing=!1,n&&(T.phase="ready")}}async function En(e,t,n=10,s=3e4){let r=oe();process.platform==="linux"&&(console.log(`[server] GPU: ${r.gpuDetected?`${r.gpuName} (driver ${r.driverVersion}, CUDA ${r.cudaDriverVersion})`:"none detected"}`),console.log(`[server] Compute backend: ${r.selectedBackend}`),r.advice&&console.warn(`[server] WARNING: ${r.advice}`));for(let i=1;i<=n;i++)try{T.phase="model_loading",t.embedder=await ke(),t.embedderError=null,console.log("[server] Model ready");let a=z().indexIntervalMs;pn(e),setInterval(()=>pn(e),a),await mn(e,t,!0),T.phase="ready",setInterval(()=>mn(e,t),a);return}catch(a){t.embedderError=String(a),console.error(`[server] Model load failed (attempt ${i}/${n}):`,a),i<n&&(console.log(`[server] Retrying in ${s/1e3}s...`),await Bun.sleep(s))}console.error("[server] Model load gave up after all retries."),T.phase="ready"}var pt,fn,mt,gn,dn,hn,uo,gt=w(()=>{"use strict";rt();it();De();ue();pt=require("fs"),fn=require("os"),mt=require("path");k();qe();je();$e();gn={},dn=process.env.QREC_PROJECTS_DIR??(0,mt.join)((0,fn.homedir)(),".claude","projects"),hn=parseInt(process.env.QREC_INDEX_INTERVAL_MS??"60000",10),uo=parseInt(process.env.QREC_ENRICH_IDLE_MS??String(300*1e3),10)});function nr(e,t=150){let n=[],s=/<mark>/g,r;for(;(r=s.exec(e))!==null;){let a=Math.max(0,r.index-t),o=e.indexOf("</mark>",r.index),c=Math.min(e.length,(o===-1?r.index:o+7)+t);n.push([a,c])}if(n.length===0)return e.slice(0,t*2);n.sort((a,o)=>a[0]-o[0]);let i=[n[0]];for(let a=1;a<n.length;a++){let o=i[i.length-1];n[a][0]<=o[1]?o[1]=Math.max(o[1],n[a][1]):i.push(n[a])}return i.map(([a,o])=>{let c=a>0?"\u2026":"",d=o<e.length?"\u2026":"",u=e.slice(a,o);return a>0&&(u=u.replace(/^[^<>]*>/,"")),u=u.replace(/<[^>]*$/,""),`${c}${u}${d}`}).join(" <span class='snippet-gap'>\u2026</span> ")}function sr(e){return(0,bn.createHash)("sha256").update(e).digest("hex")}async function rr(e,t,n){let s=sr(t),r=e.prepare("SELECT embedding FROM query_cache WHERE query_hash = ?").get(s);if(r){let c=r.embedding;return{embedding:new Float32Array(c.buffer,c.byteOffset,c.byteLength/4),cached:!0,embedMs:0}}let i=performance.now(),a=await n.embed(t),o=performance.now()-i;return e.prepare("INSERT OR REPLACE INTO query_cache (query_hash, embedding, created_at) VALUES (?, ?, ?)").run(s,Buffer.from(a.buffer),Date.now()),{embedding:a,cached:!1,embedMs:o}}async function Rn(e,t,n,s=10,r){let i=performance.now(),a=performance.now(),o=[],c=n.replace(/[^a-zA-Z0-9\s'-]/g," ").replace(/\s+/g," ").trim();try{c.length>0&&(o=e.prepare("SELECT rowid, session_id, rank FROM chunks_fts WHERE text MATCH ? ORDER BY rank LIMIT ?").all(c,s*5))}catch(h){console.warn("[search] FTS5 query failed, falling back to KNN only:",h),o=[],c=""}let d=performance.now()-a,{embedding:u,embedMs:g}=await rr(e,n,t),y=performance.now(),p=Buffer.from(u.buffer),m=e.prepare("SELECT chunk_id, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ?").all(p,s*5),l=performance.now()-y,f=performance.now(),E=new Map;if(o.length>0){let h=o.map(S=>S.rowid),R=h.map(()=>"?").join(","),_=e.prepare(`SELECT rowid, id FROM chunks WHERE rowid IN (${R})`).all(...h),v=new Map(_.map(S=>[S.rowid,S.id]));for(let S=0;S<o.length;S++){let O=v.get(o[S].rowid);O&&E.set(O,{bm25Rank:S+1,rowid:o[S].rowid})}}for(let h=0;h<m.length;h++){let R=m[h].chunk_id,_=E.get(R);_?_.vecRank=h+1:E.set(R,{vecRank:h+1})}if(r&&(r.dateFrom||r.dateTo||r.project||r.tag)){let h=new Set;for(let R of E.keys())h.add(R.split("_").slice(0,-1).join("_"));if(h.size>0){let R=[...h],v=[`id IN (${R.map(()=>"?").join(",")})`],S=[...R];r.dateFrom&&(v.push("date >= ?"),S.push(r.dateFrom)),r.dateTo&&(v.push("date <= ?"),S.push(r.dateTo)),r.project&&(v.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),S.push(r.project)),r.tag&&(v.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),S.push(r.tag));let O=e.prepare(`SELECT id FROM sessions WHERE ${v.join(" AND ")}`).all(...S),B=new Set(O.map($=>$.id));for(let[$]of E){let te=$.split("_").slice(0,-1).join("_");B.has(te)||E.delete($)}}}let I=new Map;for(let[h,R]of E){let _=(R.bm25Rank!==void 0?1/(yn+R.bm25Rank):0)+(R.vecRank!==void 0?1/(yn+R.vecRank):0);I.set(h,_)}let W=new Map;for(let[h,R]of I){let _=h.split("_").slice(0,-1).join("_"),v=W.get(_);(!v||R>v.score)&&W.set(_,{score:R,bestChunkId:h})}let Z=[...W.entries()].sort((h,R)=>R[1].score-h[1].score).slice(0,s),b=performance.now()-f,L=performance.now()-i;if(Z.length===0)return[];let ee=Z.map(([h])=>h),ce=ee.map(()=>"?").join(","),P=e.prepare(`SELECT id, project, date, indexed_at, last_message_at, title, summary FROM sessions WHERE id IN (${ce})`).all(...ee),le=new Map(P.map(h=>[h.id,h])),xe=Z.map(([,h])=>h.bestChunkId),Ve=xe.map(()=>"?").join(","),Qe=e.prepare(`SELECT id, session_id, text FROM chunks WHERE id IN (${Ve})`).all(...xe),We=new Map(Qe.map(h=>[h.id,h])),ge=new Map;if(c.length>0)for(let[,{bestChunkId:h}]of Z){let R=E.get(h)?.rowid;if(R!==void 0)try{let _=e.prepare("SELECT highlight(chunks_fts, 1, '<mark>', '</mark>') as hl FROM chunks_fts WHERE chunks_fts MATCH ? AND rowid = ?").get(c,R);_?.hl&&ge.set(h,_.hl)}catch(_){console.warn("[search] Highlight extraction failed:",_)}}let ve=[];for(let[h,{score:R,bestChunkId:_}]of Z){let v=le.get(h);if(!v)continue;let S=We.get(_),O=S?S.text:"",B=O.slice(0,300)+(O.length>300?"\u2026":""),$=ge.get(_),te=$?nr($):void 0;ve.push({session_id:h,score:R,preview:B,highlightedPreview:te,project:v.project,date:v.date,indexed_at:v.indexed_at,last_message_at:v.last_message_at??null,title:v.title,summary:v.summary??null,latency:{bm25Ms:d,embedMs:g,knnMs:l,fusionMs:b,totalMs:L}})}return ve}var bn,yn,_n=w(()=>{"use strict";bn=require("crypto");yn=60});function Sn(e,t,n,s,r){let i=s[0]??null;e.prepare(`
    INSERT INTO query_audit (query, k, result_count, top_session_id, top_score, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(t,n,s.length,i?.session_id??null,i?.score??null,r,Date.now())}function wn(e,t=100){return e.prepare("SELECT * FROM query_audit ORDER BY created_at DESC LIMIT ?").all(t)}var Tn=w(()=>{"use strict"});function He(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function xn(e){let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get();return Response.json({status:"ok",phase:T.phase,indexedSessions:t.count})}function vn(e){let t=e.prepare("SELECT COUNT(*) as n FROM sessions").get().n,n=e.prepare("SELECT COUNT(*) as n FROM chunks").get().n,s=e.prepare("SELECT MAX(indexed_at) as ts FROM sessions").get(),r=e.prepare("SELECT COUNT(*) as n FROM query_audit").get().n,i=e.prepare("SELECT COUNT(*) as n FROM sessions WHERE enriched_at IS NOT NULL AND enrichment_version >= ?").get(Q).n,a=t-i;return Response.json({status:"ok",version:"0.7.4",phase:T.phase,sessions:t,chunks:n,lastIndexedAt:s.ts,searches:r,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",embedModel:process.env.QREC_EMBED_PROVIDER==="ollama"?process.env.QREC_OLLAMA_MODEL??"nomic-embed-text":process.env.QREC_EMBED_PROVIDER==="openai"?process.env.QREC_OPENAI_MODEL??"text-embedding-3-small":"gemma-300M",enrichModel:"Qwen3-1.7B",modelDownload:T.modelDownload,indexing:T.indexing,memoryMB:Math.round(process.memoryUsage().rss/1024/1024),enriching:dt(),enrichedCount:i,pendingCount:a,enrichEnabled:z().enrichEnabled,enrichProgress:(()=>{try{return JSON.parse((0,ft.readFileSync)(he,"utf-8"))}catch(o){return o.code!=="ENOENT"&&console.warn("[server] Failed to read enrich progress:",o),null}})(),compute:(()=>{let o=oe();return{selectedBackend:o.selectedBackend,gpuDetected:o.gpuDetected,gpuName:o.gpuName,driverVersion:o.driverVersion,cudaDriverVersion:o.cudaDriverVersion,cudaRuntimeAvailable:o.cudaRuntimeAvailable,vulkanAvailable:o.vulkanAvailable,missingLibs:o.missingLibs,libProbes:o.libProbes,activeBinaryName:o.activeBinaryName,installSteps:o.installSteps,advice:o.advice}})()})}function In(e){let t=e.prepare("SELECT project, MAX(date) as last_active FROM sessions WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY last_active DESC").all();return Response.json({projects:t.map(n=>n.project)})}async function An(e,t,n){if(!t.embedder)return Response.json({error:t.embedderError??`Model not ready yet (phase: ${T.phase})`},{status:503});let s;try{s=await n.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let r=s.query?.trim();if(!r)return Response.json({error:"Missing required field: query"},{status:400});let i=s.k??10,a={};s.dateFrom&&(a.dateFrom=s.dateFrom),s.dateTo&&(a.dateTo=s.dateTo),s.project&&(a.project=s.project),s.tag&&(a.tag=s.tag);let o=performance.now();try{let c=await Rn(e,t.embedder,r,i,a),d=performance.now()-o;try{Sn(e,r,i,c,d)}catch(g){console.warn("[server] Failed to write audit query:",g)}let u=c[0]?.latency.totalMs??0;return Response.json({results:c,latencyMs:u})}catch(c){return console.error("[server] Search error:",c),Response.json({error:String(c)},{status:500})}}async function Nn(e,t){let n;try{n=await t.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let s=n.sql?.trim()??"";if(!s)return Response.json({error:"Missing required field: sql"},{status:400});if(!s.toUpperCase().startsWith("SELECT"))return Response.json({error:"Only SELECT queries are allowed"},{status:400});if(s.includes(";"))return Response.json({error:"Semicolons are not allowed (no statement stacking)"},{status:400});try{let r=e.prepare(s).all();return Response.json({rows:r,count:r.length})}catch(r){return Response.json({error:String(r)},{status:500})}}function Ln(){return Response.json(z())}async function On(e){let t;try{t=await e.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let n={};if(t.enrichEnabled!==void 0&&(n.enrichEnabled=!!t.enrichEnabled),t.enrichIdleMs!==void 0){let r=t.enrichIdleMs;if(!Number.isInteger(r)||r<6e4||r>36e5)return Response.json({error:"enrichIdleMs must be an integer between 60000 and 3600000"},{status:400});n.enrichIdleMs=r}if(t.indexIntervalMs!==void 0){let r=t.indexIntervalMs;if(!Number.isInteger(r)||r<1e4||r>36e5)return Response.json({error:"indexIntervalMs must be an integer between 10000 and 3600000"},{status:400});n.indexIntervalMs=r}let s=ct(n);return Response.json(s)}function Cn(e,t){let n=Math.min(100,Math.max(1,parseInt(t.searchParams.get("limit")??"100",10)||100)),s=Math.max(0,parseInt(t.searchParams.get("offset")??"0",10)||0),r=t.searchParams.get("date")??null,i=r??t.searchParams.get("dateFrom")??null,a=r??t.searchParams.get("dateTo")??null,o=t.searchParams.get("project")??null,c=t.searchParams.get("tag")??null,d=[],u=[];i&&(d.push("date >= ?"),u.push(i)),a&&(d.push("date <= ?"),u.push(a)),o&&(d.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),u.push(o)),c&&(d.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),u.push(c));let g=d.length>0?`WHERE ${d.join(" AND ")}`:"",y=e.prepare(`SELECT id, title, project, date, indexed_at, last_message_at, summary, tags, entities, learnings, questions FROM sessions ${g} ORDER BY COALESCE(last_message_at, indexed_at) DESC LIMIT ? OFFSET ?`).all(...u,n,s),p=e.prepare(`SELECT COUNT(*) as count FROM sessions ${g}`).get(...u).count,m=y.map(l=>({...l,tags:l.tags?JSON.parse(l.tags):null,entities:l.entities?JSON.parse(l.entities):null,learnings:l.learnings?JSON.parse(l.learnings):null,questions:l.questions?JSON.parse(l.questions):null}));return Response.json({sessions:m,total:p,offset:s,limit:n})}function Dn(e){let t=/^([0-9a-f]{8})-[0-9a-f]{4}-/i.exec(e);return t?t[1]:e}async function Mn(e,t){let n=e.prepare("SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?").get(Dn(t));if(!n)return Response.json({error:"Session not found"},{status:404});try{let s=await we(n.path);return Response.json({id:n.id,title:n.title,project:n.project,date:n.date,path:n.path,summary:n.summary??null,tags:n.tags?JSON.parse(n.tags):null,entities:n.entities?JSON.parse(n.entities):null,learnings:n.learnings?JSON.parse(n.learnings):null,questions:n.questions?JSON.parse(n.questions):null,turns:s.turns})}catch(s){return console.error("[server] Failed to parse session:",s),Response.json({error:String(s)},{status:500})}}async function kn(e,t){let n=e.prepare("SELECT path, summary, tags, entities FROM sessions WHERE id = ?").get(Dn(t));if(!n)return new Response("Session not found",{status:404});try{let s=await we(n.path),r=Ht(s);if(n.summary){let i=n.tags?JSON.parse(n.tags):[],a=n.entities?JSON.parse(n.entities):[];r=["## Summary","",n.summary,"",i.length>0?`**Tags:** ${i.join(", ")}`:"",a.length>0?`**Entities:** ${a.join(", ")}`:"","","---",""].filter((c,d,u)=>!(c===""&&u[d-1]==="")).join(`
`)+r}return new Response(r,{headers:{"Content-Type":"text/plain; charset=utf-8"}})}catch(s){return console.error("[server] Failed to render session markdown:",s),new Response(String(s),{status:500})}}function Pn(e,t){let n=Math.min(52,Math.max(4,parseInt(t.searchParams.get("weeks")??"15",10)||15)),s=t.searchParams.get("metric")??"sessions",r=t.searchParams.get("project")??null,i=new Date;i.setDate(i.getDate()-n*7+1),i.setHours(0,0,0,0);let a=He(i),o=r?" AND project = ?":"",c=r?[a,r]:[a],d;s==="hours"?d=e.prepare(`SELECT date, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ?${o} GROUP BY date ORDER BY date ASC`).all(...c):d=e.prepare(`SELECT date, COUNT(*) as count FROM sessions WHERE date >= ?${o} GROUP BY date ORDER BY date ASC`).all(...c);let u=new Map(d.map(l=>[l.date,l.count])),g=[],y=new Date(i),p=new Date;for(;He(y)<=He(p);){let l=He(y);g.push({date:l,count:u.get(l)??0}),y.setDate(y.getDate()+1)}let m={};if(!r){let l;s==="hours"?l=e.prepare("SELECT date, project, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(a):l=e.prepare("SELECT date, project, COUNT(*) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(a);for(let f of l)m[f.date]||(m[f.date]={}),m[f.date][f.project]=f.count}return Response.json({days:g,metric:s,total:d.reduce((l,f)=>l+f.count,0),active_days:d.filter(l=>l.count>0).length,byProject:m})}function $n(e,t){let n=parseInt(t.searchParams.get("limit")??"100",10);try{let s=wn(e,n);return Response.json({entries:s})}catch(s){return Response.json({error:String(s)},{status:500})}}function jn(e){let t=parseInt(e.searchParams.get("limit")??"100",10),n=Nt(t);return Response.json({entries:n})}function Un(e){let t=parseInt(e.searchParams.get("lines")??"100",10);try{let s=(0,ft.readFileSync)(G,"utf-8").split(`
`).filter(r=>r.length>0).slice(-t);return Response.json({lines:s})}catch{return Response.json({lines:[]})}}function Fn(){return Response.json({dbPath:et,logPath:G,modelCachePath:X,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",ollamaHost:process.env.QREC_OLLAMA_HOST??null,ollamaModel:process.env.QREC_OLLAMA_MODEL??null,openaiBaseUrl:process.env.QREC_OPENAI_BASE_URL??null,indexIntervalMs:hn,port:C(),platform:process.platform,bunVersion:process.versions.bun??null,nodeVersion:process.version})}var ft,Bn=w(()=>{"use strict";gt();_n();Tn();ot();De();ue();je();qe();k();be();ft=require("fs");$e()});var cr={};async function ir(){if(Hn!==null)return new Response(Hn,{headers:{"Content-Type":"text/html; charset=utf-8"}});if(!(0,Qn.existsSync)(Gn))return Response.json({error:"UI not found"},{status:404});let e=await Bun.file(Gn).text();return new Response(e,{headers:{"Content-Type":"text/html; charset=utf-8"}})}async function Vn(e,t,n){let s=e.slice(n.length);if(s.includes("..")||s.startsWith("/"))return new Response("Forbidden",{status:403});let r=(0,ie.join)(t,s),i=Bun.file(r);if(!await i.exists())return new Response("Not found",{status:404});let a=s.split(".").pop()?.toLowerCase()??"",o=a==="css"?"text/css; charset=utf-8":a==="js"?"text/javascript; charset=utf-8":a==="svg"?"image/svg+xml":a==="woff2"?"font/woff2":a==="woff"?"font/woff":a==="ttf"?"font/ttf":"application/octet-stream";return new Response(i,{headers:{"Content-Type":o,"Cache-Control":"no-cache, no-store, must-revalidate"}})}async function ar(){console.log("[server] Starting qrec server..."),tn();let e=se(),t={embedder:null,embedderError:null,isIndexing:!1},n=Bun.serve({port:qn,async fetch(s){let r=new URL(s.url),{method:i}=s,{pathname:a}=r;if(i==="GET"&&a==="/health")return xn(e);if(i==="GET"&&a==="/status")return vn(e);if(i==="GET"&&a==="/projects")return In(e);if(i==="GET"&&a==="/stats/heatmap")return Pn(e,r);if(i==="GET"&&a==="/sessions")return Cn(e,r);if(i==="GET"&&a.startsWith("/sessions/")&&a.endsWith("/markdown")){let o=a.slice(10,-9);return o?kn(e,o):Response.json({error:"Not found"},{status:404})}if(i==="GET"&&a.startsWith("/sessions/")){let o=a.slice(10);return!o||o.includes("/")?Response.json({error:"Not found"},{status:404}):Mn(e,o)}return i==="POST"&&a==="/search"?An(e,t,s):i==="POST"&&a==="/query_db"?Nn(e,s):i==="GET"&&a==="/settings"?Ln():i==="POST"&&a==="/settings"?On(s):i==="GET"&&a==="/audit/entries"?$n(e,r):i==="GET"&&a==="/activity/entries"?jn(r):i==="GET"&&a.startsWith("/ui/")?Vn(a,Wn,"/ui/"):i==="GET"&&a.startsWith("/public/")?Vn(a,or,"/public/"):i==="GET"&&(a==="/"||a==="/search"||a==="/audit"||a==="/debug")?ir():i==="GET"&&a==="/debug/log"?Un(r):i==="GET"&&a==="/debug/config"?Fn():Response.json({error:"Not found"},{status:404})}});console.log(`[server] Listening on http://localhost:${qn}`),A({type:"daemon_started"}),En(e,t),process.on("SIGTERM",()=>{console.log("[server] SIGTERM received, shutting down..."),e.close(),n.stop(),process.exit(0)}),process.on("SIGINT",()=>{console.log("[server] SIGINT received, shutting down..."),e.close(),n.stop(),process.exit(0)})}var Qn,ie,lr,qn,Hn,Ge,Wn,Gn,or,Jn=w(()=>{"use strict";be();je();k();ue();Qn=require("fs"),ie=require("path");gt();Bn();lr={},qn=C(),Hn=`<!DOCTYPE html>
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

    <div id="db-activity-feed"></div>

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
`,Ge=lr.dir,Wn=Ge?(0,ie.join)(Ge,"..","ui"):(0,ie.join)(__dirname,"..","..","ui"),Gn=(0,ie.join)(Wn,"index.html"),or=Ge?(0,ie.join)(Ge,"..","public"):(0,ie.join)(__dirname,"..","..","public");ar().catch(e=>{console.error("[server] Fatal error:",e),process.exit(1)})});var os=/\d/,is=["-","_","/","."];function as(e=""){if(!os.test(e))return e!==e.toLowerCase()}function Et(e,t){let n=t??is,s=[];if(!e||typeof e!="string")return s;let r="",i,a;for(let o of e){let c=n.includes(o);if(c===!0){s.push(r),r="",i=void 0;continue}let d=as(o);if(a===!1){if(i===!1&&d===!0){s.push(r),r=o,i=d;continue}if(i===!0&&d===!1&&r.length>1){let u=r.at(-1);s.push(r.slice(0,Math.max(0,r.length-1))),r=u+o,i=d;continue}}r+=o,i=d,a=c}return s.push(r),s}function cs(e){return e?e[0].toUpperCase()+e.slice(1):""}function ls(e){return e?e[0].toLowerCase()+e.slice(1):""}function us(e,t){return e?(Array.isArray(e)?e:Et(e)).map(n=>cs(t?.normalize?n.toLowerCase():n)).join(""):""}function Xe(e,t){return ls(us(e||"",t))}function Ye(e,t){return e?(Array.isArray(e)?e:Et(e)).map(n=>n.toLowerCase()).join(t??"-"):""}var yt=require("node:util");function bt(e){return Array.isArray(e)?e:e===void 0?[]:[e]}function Ke(e,t=""){let n=[];for(let s of e)for(let[r,i]of s.entries())n[r]=Math.max(n[r]||0,i.length);return e.map(s=>s.map((r,i)=>t+r[i===0?"padStart":"padEnd"](n[i])).join("  ")).join(`
`)}function j(e){return typeof e=="function"?e():e}var ne=class extends Error{code;constructor(e,t){super(e),this.name="CLIError",this.code=t}};function ds(e=[],t={}){let n=new Set(t.boolean||[]),s=new Set(t.string||[]),r=t.alias||{},i=t.default||{},a=new Map,o=new Map;for(let[l,f]of Object.entries(r)){let E=f;for(let I of E)a.set(l,I),o.has(I)||o.set(I,[]),o.get(I).push(l),a.set(I,l),o.has(l)||o.set(l,[]),o.get(l).push(I)}let c={};function d(l){if(n.has(l))return"boolean";let f=o.get(l)||[];for(let E of f)if(n.has(E))return"boolean";return"string"}let u=new Set([...n,...s,...Object.keys(r),...Object.values(r).flat(),...Object.keys(i)]);for(let l of u)c[l]||(c[l]={type:d(l),default:i[l]});for(let[l,f]of a.entries())l.length===1&&c[f]&&!c[f].short&&(c[f].short=l);let g=[],y={};for(let l=0;l<e.length;l++){let f=e[l];if(f==="--"){g.push(...e.slice(l));break}if(f.startsWith("--no-")){let E=f.slice(5);y[E]=!0;continue}g.push(f)}let p;try{p=(0,yt.parseArgs)({args:g,options:Object.keys(c).length>0?c:void 0,allowPositionals:!0,strict:!1})}catch{p={values:{},positionals:g}}let m={_:[]};m._=p.positionals;for(let[l,f]of Object.entries(p.values))m[l]=f;for(let[l]of Object.entries(y)){m[l]=!1;let f=a.get(l);f&&(m[f]=!1);let E=o.get(l);if(E)for(let I of E)m[I]=!1}for(let[l,f]of a.entries())m[l]!==void 0&&m[f]===void 0&&(m[f]=m[l]),m[f]!==void 0&&m[l]===void 0&&(m[l]=m[f]);return m}var ps=(()=>{let e=globalThis.process?.env??{};return e.NO_COLOR==="1"||e.TERM==="dumb"||e.TEST||e.CI})(),Le=(e,t=39)=>n=>ps?n:`\x1B[${e}m${n}\x1B[${t}m`,Ae=Le(1,22),q=Le(36),ms=Le(90),Ne=Le(4,24);function gs(e,t){let n={boolean:[],string:[],alias:{},default:{}},s=Rt(t);for(let o of s){if(o.type==="positional")continue;o.type==="string"||o.type==="enum"?n.string.push(o.name):o.type==="boolean"&&n.boolean.push(o.name),o.default!==void 0&&(n.default[o.name]=o.default),o.alias&&(n.alias[o.name]=o.alias);let c=Xe(o.name),d=Ye(o.name);if(c!==o.name||d!==o.name){let u=bt(n.alias[o.name]||[]);c!==o.name&&!u.includes(c)&&u.push(c),d!==o.name&&!u.includes(d)&&u.push(d),u.length>0&&(n.alias[o.name]=u)}}let r=ds(e,n),[...i]=r._,a=new Proxy(r,{get(o,c){return o[c]??o[Xe(c)]??o[Ye(c)]}});for(let[,o]of s.entries())if(o.type==="positional"){let c=i.shift();if(c!==void 0)a[o.name]=c;else{if(o.default===void 0&&o.required!==!1)throw new ne(`Missing required positional argument: ${o.name.toUpperCase()}`,"EARG");a[o.name]=o.default}}else if(o.type==="enum"){let c=a[o.name],d=o.options||[];if(c!==void 0&&d.length>0&&!d.includes(c))throw new ne(`Invalid value for argument: ${q(`--${o.name}`)} (${q(c)}). Expected one of: ${d.map(u=>q(u)).join(", ")}.`,"EARG")}else if(o.required&&a[o.name]===void 0)throw new ne(`Missing required argument: --${o.name}`,"EARG");return a}function Rt(e){let t=[];for(let[n,s]of Object.entries(e||{}))t.push({...s,name:n,alias:bt(s.alias)});return t}async function _t(e,t){let n=await j(e.args||{}),s=gs(t.rawArgs,n),r={rawArgs:t.rawArgs,args:s,data:t.data,cmd:e};typeof e.setup=="function"&&await e.setup(r);let i;try{let a=await j(e.subCommands);if(a&&Object.keys(a).length>0){let o=t.rawArgs.findIndex(d=>!d.startsWith("-")),c=t.rawArgs[o];if(c){if(!a[c])throw new ne(`Unknown command ${q(c)}`,"E_UNKNOWN_COMMAND");let d=await j(a[c]);d&&await _t(d,{rawArgs:t.rawArgs.slice(o+1)})}else if(!e.run)throw new ne("No command specified.","E_NO_COMMAND")}typeof e.run=="function"&&(i=await e.run(r))}finally{typeof e.cleanup=="function"&&await e.cleanup(r)}return{result:i}}async function ze(e,t,n){let s=await j(e.subCommands);if(s&&Object.keys(s).length>0){let r=t.findIndex(o=>!o.startsWith("-")),i=t[r],a=await j(s[i]);if(a)return ze(a,t.slice(r+1),e)}return[e,n]}async function fs(e,t){try{console.log(await Es(e,t)+`
`)}catch(n){console.error(n)}}var hs=/^no[-A-Z]/;async function Es(e,t){let n=await j(e.meta||{}),s=Rt(await j(e.args||{})),r=await j(t?.meta||{}),i=`${r.name?`${r.name} `:""}`+(n.name||process.argv[1]),a=[],o=[],c=[],d=[];for(let p of s)if(p.type==="positional"){let m=p.name.toUpperCase(),l=p.required!==!1&&p.default===void 0,f=p.default?`="${p.default}"`:"";o.push([q(m+f),p.description||"",p.valueHint?`<${p.valueHint}>`:""]),d.push(l?`<${m}>`:`[${m}]`)}else{let m=p.required===!0&&p.default===void 0,l=[...(p.alias||[]).map(f=>`-${f}`),`--${p.name}`].join(", ")+(p.type==="string"&&(p.valueHint||p.default)?`=${p.valueHint?`<${p.valueHint}>`:`"${p.default||""}"`}`:"")+(p.type==="enum"&&p.options?`=<${p.options.join("|")}>`:"");if(a.push([q(l+(m?" (required)":"")),p.description||""]),p.type==="boolean"&&(p.default===!0||p.negativeDescription)&&!hs.test(p.name)){let f=[...(p.alias||[]).map(E=>`--no-${E}`),`--no-${p.name}`].join(", ");a.push([q(f+(m?" (required)":"")),p.negativeDescription||""])}m&&d.push(l)}if(e.subCommands){let p=[],m=await j(e.subCommands);for(let[l,f]of Object.entries(m)){let E=await j((await j(f))?.meta);E?.hidden||(c.push([q(l),E?.description||""]),p.push(l))}d.push(p.join("|"))}let u=[],g=n.version||r.version;u.push(ms(`${n.description} (${i+(g?` v${g}`:"")})`),"");let y=a.length>0||o.length>0;return u.push(`${Ne(Ae("USAGE"))} ${q(`${i}${y?" [OPTIONS]":""} ${d.join(" ")}`)}`,""),o.length>0&&(u.push(Ne(Ae("ARGUMENTS")),""),u.push(Ke(o,"  ")),u.push("")),a.length>0&&(u.push(Ne(Ae("OPTIONS")),""),u.push(Ke(a,"  ")),u.push("")),c.length>0&&(u.push(Ne(Ae("COMMANDS")),""),u.push(Ke(c,"  ")),u.push("",`Use ${q(`${i} <command> --help`)} for more information about a command.`)),u.filter(p=>typeof p=="string").join(`
`)}async function St(e,t={}){let n=t.rawArgs||process.argv.slice(2),s=t.showUsage||fs;try{if(n.includes("--help")||n.includes("-h"))await s(...await ze(e,n)),process.exit(0);else if(n.length===1&&n[0]==="--version"){let r=typeof e.meta=="function"?await e.meta():await e.meta;if(!r?.version)throw new ne("No version specified","E_NO_VERSION");console.log(r.version)}else await _t(e,{rawArgs:n})}catch(r){r instanceof ne?(await s(...await ze(e,n)),console.error(r.message)):console.error(r,`
`),process.exit(1)}}be();it();st();var Xt=require("path"),N=require("fs");k();var Jt={};function Bs(){(0,N.mkdirSync)(x,{recursive:!0})}function Yt(){if(!(0,N.existsSync)(J))return!1;let e=parseInt((0,N.readFileSync)(J,"utf-8").trim(),10);if(isNaN(e))return!1;try{return process.kill(e,0),!0}catch{try{(0,N.unlinkSync)(J)}catch{}return!1}}function Pe(){if(!(0,N.existsSync)(J))return null;let e=parseInt((0,N.readFileSync)(J,"utf-8").trim(),10);return isNaN(e)?null:e}async function Kt(){if(Yt()){let o=Pe();console.log(`[daemon] qrec server already running (PID ${o})`);return}try{let o=[],c=Bun.spawnSync(["lsof","-ti",`:${C()}`],{stdio:["ignore","pipe","ignore"]});if(c.exitCode===0)o=new TextDecoder().decode(c.stdout).trim().split(`
`).filter(Boolean);else{let d=Bun.spawnSync(["ss","-tlnp",`sport = :${C()}`],{stdio:["ignore","pipe","ignore"]}),g=new TextDecoder().decode(d.stdout).match(/pid=(\d+)/g);g&&(o=g.map(y=>y.replace("pid=","")))}for(let d of o)try{process.kill(parseInt(d),"SIGKILL")}catch{}o.length>0&&await Bun.sleep(300)}catch{}Bs();let e=G;try{(0,N.writeFileSync)(e,"")}catch{}let t=typeof Jt.dir=="string"?["bun","run",(0,Xt.join)(Jt.dir,"server.ts")]:[process.argv[0],process.argv[1],"serve"],n=Bun.spawn(t,{detached:!0,stdio:["ignore",Bun.file(e),Bun.file(e)],env:process.env}),s=n.pid;(0,N.writeFileSync)(J,String(s),"utf-8"),n.unref(),console.log(`[daemon] qrec server started (PID ${s})`),console.log(`[daemon] Logs: ${e}`),console.log("[daemon] Waiting for server to be ready...");let r=parseInt(process.env.QREC_DAEMON_TIMEOUT_MS??"120000",10),i=Date.now()+r,a=!1;for(;Date.now()<i;){await Bun.sleep(500);try{if((await fetch(`http://localhost:${C()}/health`)).ok){a=!0;break}}catch{}}a?console.log(`[daemon] Server ready at http://localhost:${C()}`):(console.error(`[daemon] Server failed to start within 30 seconds. Check logs: ${e}`),process.exit(1))}async function at(){if(!Yt()){console.log("[daemon] No running qrec server found.");return}let e=Pe();try{process.kill(e,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to PID ${e}`);let t=Date.now()+5e3;for(;Date.now()<t;){await Bun.sleep(200);try{process.kill(e,0)}catch{break}}}catch(t){console.error(`[daemon] Failed to send SIGTERM: ${t}`)}try{let t=(0,N.existsSync)(H)?(0,N.readFileSync)(H,"utf8").trim():null,n=t?parseInt(t,10):null;n&&(process.kill(n,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to enrich PID ${n}`))}catch{}try{(0,N.unlinkSync)(H)}catch{}try{(0,N.unlinkSync)(J)}catch{}console.log("[daemon] qrec server stopped.")}var ae=require("fs"),Yn=require("os");k();$e();var me=process.argv.slice(2);(me[0]==="--version"||me[0]==="-v")&&(console.log("qrec 0.7.4"),process.exit(0));var ht=me.indexOf("--port");if(ht!==-1){let e=me[ht+1];(!e||isNaN(parseInt(e,10)))&&(console.error("[cli] --port requires a numeric value"),process.exit(1)),process.env.QREC_PORT=e,me.splice(ht,2)}function ur(e=20){if(!(0,ae.existsSync)(G))return[];try{return(0,ae.readFileSync)(G,"utf-8").split(`
`).filter(n=>n.length>0).slice(-e)}catch{return[]}}function Xn(){let e=process.platform==="darwin"?"open":"xdg-open";try{Bun.spawnSync([e,`http://localhost:${C()}`])}catch{}}var dr={meta:{name:"teardown",description:"Stop daemon and remove all qrec data (~/.qrec/)"},args:{yes:{type:"boolean",alias:"y",description:"Skip confirmation prompt",default:!1}},async run({args:e}){await at(),(0,ae.existsSync)(x)||(console.log("[teardown] ~/.qrec/ not found, nothing to remove."),process.exit(0)),e.yes||(process.stdout.write(`[teardown] Remove ${x} (DB, model, logs, pid, activity log)? [y/N] `),(await new Promise(n=>{process.stdin.setEncoding("utf-8"),process.stdin.once("data",s=>n(String(s).trim()))})).toLowerCase()!=="y"&&(console.log("[teardown] Aborted."),process.exit(0))),(0,ae.rmSync)(x,{recursive:!0,force:!0}),console.log("[teardown] Removed ~/.qrec/"),process.exit(0)}},pr={meta:{name:"index",description:"Index sessions into the search database"},args:{path:{type:"positional",required:!1,description:"Path to index (default: ~/.claude/projects/)"},force:{type:"boolean",description:"Force re-index all sessions",default:!1},sessions:{type:"string",description:"Number of sessions to sample (for testing)"},seed:{type:"string",description:"Random seed for session sampling"}},async run({args:e}){let t,n=e.force??!1,s=e.sessions?parseInt(e.sessions,10):void 0,r=e.seed?parseInt(e.seed,10):void 0;if(!e.path&&!process.stdin.isTTY){let a=await Bun.stdin.text();try{let o=JSON.parse(a.trim());if(!o.transcript_path)throw new Error("Missing transcript_path");t=o.transcript_path}catch(o){console.error(`[cli] index: failed to parse stdin: ${o}`),process.exit(1)}}else t=(e.path??`${(0,Yn.homedir)()}/.claude/projects/`).replace("~",process.env.HOME??"");console.log(`[cli] Indexing: ${t}${s?` (${s} sessions, seed=${r??42})`:""}`);let i=se();try{await Te(i,t,{force:n,sessions:s,seed:r})}finally{i.close(),await nt()}process.exit(0)}},mr={meta:{name:"serve",description:"Start the qrec HTTP server (default: foreground)"},args:{daemon:{type:"boolean",description:"Run as background daemon",default:!1},open:{type:"boolean",description:"Open browser on start (pass --no-open to suppress)",default:!0}},async run({args:e}){let t=!(e.open??!0);e.daemon?(await Kt(),t||Xn()):(t||setTimeout(Xn,1e3),await Promise.resolve().then(()=>(Jn(),cr)))}},gr={meta:{name:"stop",description:"Stop the qrec daemon"},async run(){await at()}},fr={meta:{name:"search",description:"Search sessions (omit query for browse mode sorted by date)"},args:{k:{type:"string",description:"Number of results",default:"10"},project:{type:"string",description:"Filter by project name"},tag:{type:"string",description:"Filter by tag"},from:{type:"string",description:"Filter from date",valueHint:"YYYY-MM-DD"},to:{type:"string",description:"Filter to date",valueHint:"YYYY-MM-DD"}},async run({args:e}){let t=e._.join(" ").trim(),n=parseInt(e.k??"10",10),s=e.project??null,r=e.tag??null,i=e.from??null,a=e.to??null;if(t){let o={query:t,k:n};s&&(o.project=s),r&&(o.tag=r),i&&(o.dateFrom=i),a&&(o.dateTo=a);let c=await fetch(`http://localhost:${C()}/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)});if(!c.ok){let d=await c.json().catch(()=>({}));console.error(`[cli] search failed (${c.status}): ${d.error??"unknown error"}`),process.exit(1)}console.log(JSON.stringify(await c.json(),null,2))}else{let o=new URLSearchParams({offset:"0",limit:String(n)});s&&o.set("project",s),r&&o.set("tag",r),i&&o.set("dateFrom",i),a&&o.set("dateTo",a);let c=await fetch(`http://localhost:${C()}/sessions?${o}`);if(!c.ok){let g=await c.json().catch(()=>({}));console.error(`[cli] browse failed (${c.status}): ${g.error??"unknown error"}`),process.exit(1)}let u=(await c.json()).sessions.map(g=>({id:g.id,date:g.date,project:g.project,title:g.title,tags:Array.isArray(g.tags)?g.tags.join(", "):null,summary:typeof g.summary=="string"?g.summary.slice(0,120)+(g.summary.length>120?"\u2026":""):null}));console.log(JSON.stringify(u,null,2))}process.exit(0)}},hr={meta:{name:"get",description:"Print full session markdown"},args:{sessionId:{type:"positional",required:!0,description:"Session ID (8-char hex or full UUID)"}},async run({args:e}){let t=e.sessionId?.trim();t||(console.error("[cli] Usage: qrec get <session-id>"),process.exit(1));let n=await fetch(`http://localhost:${C()}/sessions/${t}/markdown`);n.status===404&&(console.error(`[cli] Session not found: ${t}`),process.exit(1)),n.ok||(console.error(`[cli] get failed (${n.status})`),process.exit(1)),console.log(await n.text()),process.exit(0)}},Er={meta:{name:"status",description:"Show daemon status, session counts, and log tail"},async run(){let e=se();try{let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get(),n=e.prepare("SELECT COUNT(*) as count FROM chunks").get(),s=e.prepare("SELECT MAX(indexed_at) as last FROM sessions").get(),r=Pe(),i=r!==null,a="not checked";if(i)try{let u=await fetch(`http://localhost:${C()}/health`);a=u.ok?(await u.json()).status??"unknown":`http error ${u.status}`}catch{a="unreachable"}let o=s.last?new Date(s.last).toISOString():"never",c="0.7.4";if(console.log("=== qrec status ==="),console.log(`Version:        ${c}`),console.log(`Daemon PID:     ${r??"not running"}`),console.log(`HTTP health:    ${a}`),console.log(`Sessions:       ${t.count}`),console.log(`Chunks:         ${n.count}`),console.log(`Last indexed:   ${o}`),process.platform==="linux"){let u=oe();console.log(""),console.log("--- Compute ---");let g=u.selectedBackend==="cpu"&&u.gpuDetected?" (fallback \u2014 CUDA libs missing)":"";console.log(`Backend:        ${u.selectedBackend}${g}`),u.gpuDetected?(console.log(`GPU:            ${u.gpuName} (driver ${u.driverVersion}, CUDA ${u.cudaDriverVersion})`),console.log(`CUDA runtime:   ${u.cudaRuntimeAvailable?"available":"NOT AVAILABLE"}`),u.cudaRuntimeAvailable?console.log(`Binary:         ${u.activeBinaryName}`):(console.log(`  Missing libs: ${u.missingLibs.join(", ")}`),u.installSteps&&(console.log("  Fix:"),u.installSteps.forEach((y,p)=>console.log(`    ${p+1}. ${y}`))))):console.log("GPU:            none detected"),u.vulkanAvailable&&console.log("Vulkan:         available")}console.log(""),console.log("--- Log tail (last 20 lines) ---");let d=ur(20);if(d.length===0)console.log("(no log entries)");else for(let u of d)console.log(u)}finally{e.close()}process.exit(0)}},yr={meta:{name:"enrich",description:"Summarize unenriched sessions (tags, entities, summaries)"},args:{limit:{type:"string",description:"Maximum sessions to process"},"min-age-ms":{type:"string",description:"Minimum session age (ms) before enrichment"},force:{type:"boolean",description:"Re-enrich all sessions regardless of enriched_at",default:!1}},async run({args:e}){let t=e.limit?parseInt(e.limit,10):void 0,n=e["min-age-ms"]?parseInt(e["min-age-ms"],10):void 0,s=e.force??!1,{runEnrich:r}=await Promise.resolve().then(()=>(qe(),un));await r({limit:t,minAgeMs:n,force:s}),process.exit(0)}},br={meta:{name:"doctor",description:"Diagnose GPU/CUDA setup (Linux only)"},async run(){let e=oe();console.log("=== qrec doctor ==="),console.log(""),process.platform!=="linux"&&(console.log(`Platform: ${process.platform}`),console.log("Metal/GPU acceleration is handled automatically by node-llama-cpp on macOS."),console.log("No CUDA probe needed."),process.exit(0));let t=r=>`[check] ${r}`,n=r=>`[FAIL]  ${r}`,s=r=>`        ${r}`;e.gpuDetected?console.log(t(`NVIDIA GPU ............ ${e.gpuName} (driver ${e.driverVersion}, CUDA ${e.cudaDriverVersion})`)):console.log(n("NVIDIA GPU ............ not detected (nvidia-smi not found or no output)"));for(let[r,i]of Object.entries(e.libProbes))i.found?console.log(t(`${r.padEnd(14)} .... .so.${i.soVersion} at ${i.path}`)):console.log(n(`${r.padEnd(14)} .... NOT FOUND`));e.vulkanAvailable?console.log(t("Vulkan ................ available")):console.log(t("Vulkan ................ not found (optional)")),e.activeBinaryName&&console.log(t(`node-llama-cpp binary . ${e.activeBinaryName}`)),console.log(""),e.cudaRuntimeAvailable?console.log(`Result: CUDA backend ready (${e.activeBinaryName})`):e.gpuDetected?(console.log("Result: CUDA libs missing \u2014 running on CPU (fallback)"),console.log(""),console.log("Fix:"),e.installSteps&&e.installSteps.forEach((r,i)=>console.log(`  ${i+1}. ${r}`)),e.cudaRepoConfigured===!1&&(console.log(""),console.log(s("Note: NVIDIA apt repo not found in /etc/apt/sources.list.d/")),console.log(s("      The wget step above adds it. Run apt-get update after.")))):console.log("Result: No NVIDIA GPU detected \u2014 running on CPU"),process.exit(0)}},Rr={meta:{name:"qrec",description:"Session recall engine \u2014 semantic search over Claude Code sessions",version:"0.7.4"},subCommands:{teardown:dr,index:pr,serve:mr,stop:gr,search:fr,get:hr,status:Er,enrich:yr,doctor:br}};St(Rr,{rawArgs:me});
