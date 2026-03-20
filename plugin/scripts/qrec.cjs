#!/usr/bin/env bun
"use strict";var Cn=Object.create;var je=Object.defineProperty;var kn=Object.getOwnPropertyDescriptor;var Mn=Object.getOwnPropertyNames;var Pn=Object.getPrototypeOf,$n=Object.prototype.hasOwnProperty;var _=(e,t)=>()=>(e&&(t=e(e=0)),t);var ue=(e,t)=>{for(var s in t)je(e,s,{get:t[s],enumerable:!0})},Fn=(e,t,s,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of Mn(t))!$n.call(e,r)&&r!==s&&je(e,r,{get:()=>t[r],enumerable:!(n=kn(t,r))||n.enumerable});return e};var Te=(e,t,s)=>(s=e!=null?Cn(Pn(e)):{},Fn(t||!e||!e.__esModule?je(s,"default",{value:e,enumerable:!0}):s,e));function D(){return parseInt(process.env.QREC_PORT??"25927",10)}var U,rt,T,ks,ot,W,q,pe,H,xe,we,J,me,M=_(()=>{"use strict";U=require("path"),rt=require("os"),T=process.env.QREC_DIR??(0,U.join)((0,rt.homedir)(),".qrec"),ks=parseInt(process.env.QREC_PORT??"25927",10);ot=(0,U.join)(T,"qrec.db"),W=(0,U.join)(T,"qrec.pid"),q=(0,U.join)(T,"enrich.pid"),pe=(0,U.join)(T,"enrich-progress.json"),H=(0,U.join)(T,"qrec.log"),xe=(0,U.join)(T,"activity.jsonl"),we=(0,U.join)(T,"config.json"),J=(0,U.join)(T,"models"),me=(0,U.join)(T,"archive")});function Un(){let e=process.env.BREW_PREFIX||process.env.HOMEBREW_PREFIX,t=[];e&&(t.push(`${e}/opt/sqlite/lib/libsqlite3.dylib`),t.push(`${e}/lib/libsqlite3.dylib`)),t.push("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib"),t.push("/usr/local/opt/sqlite/lib/libsqlite3.dylib");for(let s of t)try{if((0,Ie.statSync)(s).size>0)return s}catch{}return null}function ee(e=qe){let t=e.replace(/\/[^/]+$/,"");(0,Ie.mkdirSync)(t,{recursive:!0});let s=new Be.Database(e);return s.loadExtension(jn),s.exec("PRAGMA journal_mode = WAL"),s.exec("PRAGMA synchronous = NORMAL"),s.exec("PRAGMA cache_size = -32000"),s.exec("PRAGMA foreign_keys = ON"),Bn(s),s}function Bn(e){e.exec(`
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
  `)}var Be,it,Ie,qe,jn,ge=_(()=>{"use strict";Be=require("bun:sqlite"),it=require("sqlite-vec"),Ie=require("fs");M();qe=ot;if(process.platform==="darwin"){let e=Un();if(!e)throw new Error(`sqlite-vec requires a Homebrew SQLite build that supports dynamic extension loading. Install with: brew install sqlite
Then set BREW_PREFIX if Homebrew is in a non-standard location.`);Be.Database.setCustomSQLite(e)}jn=(0,it.getLoadablePath)()});function ct(e){if(e.length<=3600)return[{text:e,pos:0}];let t=qn(e),s=[],n="",r=0;for(let o of t){let i=n?n+`

`+o.text:o.text;if(i.length<=3600)n||(r=o.pos),n=i;else if(n){s.push({text:n.trim(),pos:r});let a=n.slice(-at),d=r+n.length-a.length;n=a+`

`+o.text,r=d}else{let a=Hn(o.text,o.pos);if(a.length>1){for(let u=0;u<a.length-1;u++)s.push(a[u]);let d=a[a.length-1];n=d.text,r=d.pos}else n=o.text,r=o.pos}}return n.trim()&&s.push({text:n.trim(),pos:r}),s}function qn(e){let t=/^(#{1,6} .+)$/m,s=[],n=0,r=[],o,i=/^(#{1,6} .+)$/gm;for(;(o=i.exec(e))!==null;)o.index>0&&r.push(o.index);if(r.length===0)return[{text:e,pos:0}];for(let d of r){let u=e.slice(n,d);u.trim()&&s.push({text:u.trim(),pos:n}),n=d}let a=e.slice(n);return a.trim()&&s.push({text:a.trim(),pos:n}),s.length>0?s:[{text:e,pos:0}]}function Hn(e,t){let s=[],n=0;for(;n<e.length;){let r=n+3600;if(r>=e.length){s.push({text:e.slice(n).trim(),pos:t+n});break}let o=e.lastIndexOf(`

`,r);if(o>n+3600*.5)r=o;else{let i=e.lastIndexOf(`
`,r);i>n+3600*.5&&(r=i)}s.push({text:e.slice(n,r).trim(),pos:t+n}),n=Math.max(n+1,r-at)}return s}var at,lt=_(()=>{"use strict";at=Math.floor(540)});var S,Ne=_(()=>{"use strict";S={phase:"starting",modelDownload:{percent:0,downloadedMB:0,totalMB:null},indexing:{indexed:0,total:0,current:""}}});function N(e){let t={ts:Date.now(),...e};try{(0,X.mkdirSync)(T,{recursive:!0}),(0,X.appendFileSync)(xe,JSON.stringify(t)+`
`,"utf-8")}catch(s){console.warn("[activity] Failed to write activity log:",s)}}function dt(e=100){if(!(0,X.existsSync)(xe))return[];try{return(0,X.readFileSync)(xe,"utf-8").split(`
`).filter(n=>n.trim().length>0).map(n=>{try{return JSON.parse(n)}catch{return null}}).filter(n=>n!==null).slice(-e).reverse()}catch(t){return console.warn("[activity] Failed to read activity log:",t),[]}}var X,ie=_(()=>{"use strict";X=require("fs");M()});var gt={};ue(gt,{disposeEmbedder:()=>Ge,getEmbedder:()=>Qn});async function Gn(){if(!process.env.QREC_DIR&&(0,ve.existsSync)(He))return console.log(`[embed] Found model at legacy path: ${He}`),He;console.log(`[embed] Resolving model: ${ut}`),(0,ve.mkdirSync)(J,{recursive:!0}),S.phase="model_download",S.modelDownload={percent:0,downloadedMB:0,totalMB:null};let{resolveModelFile:e}=await import("node-llama-cpp"),t=await e(ut,{directory:J,onProgress({totalSize:s,downloadedSize:n}){S.modelDownload={percent:s?Math.round(n/s*100):0,downloadedMB:+(n/1048576).toFixed(1),totalMB:s?+(s/1048576).toFixed(1):null}}});return console.log(`[embed] Model ready at ${t}`),S.modelDownload.totalMB!==null&&N({type:"embed_model_downloaded",data:{totalMB:S.modelDownload.totalMB}}),t}async function Vn(){let e=await Gn();S.phase="model_loading",console.log(`[embed] Loading model from ${e}`);let{getLlama:t}=await import("node-llama-cpp");he=await t();let n=await(await he.loadModel({modelPath:e})).createEmbeddingContext({contextSize:8192});return console.log("[embed] Model loaded, embedding dimensions: 768"),n}async function Ge(){ae&&(await ae.dispose(),ae=null),he&&(await he.dispose(),he=null,fe=null)}async function Qn(){return fe||(fe=Vn().catch(e=>{throw fe=null,e})),ae||(ae=await fe),{dimensions:768,async embed(e){let t=ae,s=24e3,n=e.length>s?e.slice(0,s):e;n!==e&&console.warn(`[embed] Truncated chunk from ${e.length} to ${s} chars`);let r=await t.getEmbeddingFor(n);return new Float32Array(r.vector)}}}var pt,mt,ve,ut,He,he,ae,fe,Ve=_(()=>{"use strict";pt=require("path"),mt=require("os"),ve=require("fs");M();Ne();ie();ut="hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",He=(0,pt.join)((0,mt.homedir)(),".cache","qmd","models","hf_ggml-org_embeddinggemma-300M-Q8_0.gguf"),he=null,ae=null,fe=null});var ft={};ue(ft,{getOllamaEmbedder:()=>Xn});function Xn(){let e=process.env.QREC_OLLAMA_HOST??Wn,t=process.env.QREC_OLLAMA_MODEL??Jn;return console.log(`[embed/ollama] Using Ollama at ${e}, model: ${t}`),{dimensions:768,async embed(s){let n=await fetch(`${e}/api/embeddings`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:t,prompt:s})});if(!n.ok){let o=await n.text().catch(()=>"");throw new Error(`Ollama embeddings request failed: HTTP ${n.status} \u2014 ${o}`)}let r=await n.json();if(!Array.isArray(r.embedding)||r.embedding.length===0)throw new Error("Ollama returned empty or invalid embedding");return new Float32Array(r.embedding)}}}var Wn,Jn,ht=_(()=>{"use strict";Wn="http://localhost:11434",Jn="nomic-embed-text"});var Et={};ue(Et,{getOpenAIEmbedder:()=>zn});function zn(){let e=process.env.QREC_OPENAI_KEY;if(!e)throw new Error("QREC_OPENAI_KEY environment variable is required for OpenAI embedding backend");let t=(process.env.QREC_OPENAI_BASE_URL??Yn).replace(/\/$/,""),s=process.env.QREC_OPENAI_MODEL??Kn,n=parseInt(process.env.QREC_OPENAI_DIMENSIONS??String(768),10);return console.log(`[embed/openai] Using OpenAI-compatible API at ${t}, model: ${s}, dimensions: ${n}`),{dimensions:n,async embed(r){let o={model:s,input:r};s.startsWith("text-embedding-3")&&(o.dimensions=n);let i=await fetch(`${t}/embeddings`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e}`},body:JSON.stringify(o)});if(!i.ok){let d=await i.text().catch(()=>"");throw new Error(`OpenAI embeddings request failed: HTTP ${i.status} \u2014 ${d}`)}let a=await i.json();if(!a.data?.[0]?.embedding||a.data[0].embedding.length===0)throw new Error("OpenAI returned empty or invalid embedding");return new Float32Array(a.data[0].embedding)}}}var Yn,Kn,bt=_(()=>{"use strict";Yn="https://api.openai.com/v1",Kn="text-embedding-3-small"});var yt={};ue(yt,{getStubEmbedder:()=>Zn});function Zn(){return{dimensions:768,async embed(e){return Rt}}}var Rt,_t=_(()=>{"use strict";Rt=new Float32Array(768);Rt[0]=1});async function Ae(){let e=(process.env.QREC_EMBED_PROVIDER??"local").toLowerCase().trim();switch(e){case"local":case"":{let{getEmbedder:t}=await Promise.resolve().then(()=>(Ve(),gt));return t()}case"ollama":{let{getOllamaEmbedder:t}=await Promise.resolve().then(()=>(ht(),ft));return t()}case"openai":{let{getOpenAIEmbedder:t}=await Promise.resolve().then(()=>(bt(),Et));return t()}case"stub":{let{getStubEmbedder:t}=await Promise.resolve().then(()=>(_t(),yt));return t()}default:throw new Error(`Unknown QREC_EMBED_PROVIDER: "${e}". Valid values: local, ollama, openai, stub`)}}var Qe=_(()=>{"use strict"});function es(e){let t=e;for(;;){try{if((0,Ee.statSync)((0,j.join)(t,".claude")).isDirectory())return(0,j.basename)(t)}catch{}let s=(0,j.dirname)(t);if(s===t)break;t=s}for(t=e;;){try{if((0,Ee.statSync)((0,j.join)(t,".git")).isDirectory())return(0,j.basename)(t)}catch{}let s=(0,j.dirname)(t);if(s===t)break;t=s}return(0,j.basename)(e)}function St(e){return e.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g,"").replace(/<[^>]+\/>/g,"").trim()}function ts(e,t){let n={Bash:"command",Read:"file_path",Write:"file_path",Edit:"file_path",Glob:"pattern",Grep:"pattern",WebFetch:"url",WebSearch:"query",Agent:"description"}[e],r=n&&typeof t[n]=="string"?t[n]:JSON.stringify(t),o=r.length>80?r.slice(0,80)+"\u2026":r;return`${e}: \`${o}\``}function ns(e){if(typeof e=="string")return{text:St(e).trim(),isToolResult:!1};if(!Array.isArray(e))return{text:"",isToolResult:!1};if(e.every(n=>n?.type==="tool_result"))return{text:"",isToolResult:!0};let s=[];for(let n of e)if(n?.type==="text"&&typeof n.text=="string"){let r=St(n.text).trim();r&&s.push(r)}return{text:s.join(`
`).trim(),isToolResult:!1}}function ss(e){if(!Array.isArray(e))return{text:"",tools:[],thinking:[]};let t=[],s=[],n=[];for(let r of e)if(r?.type==="text"&&typeof r.text=="string"){let o=r.text.trim();o&&t.push(o)}else if(r?.type==="tool_use"&&r.name)s.push(ts(r.name,r.input??{}));else if(r?.type==="thinking"&&typeof r.thinking=="string"){let o=r.thinking.trim();o&&n.push(o)}return{text:t.join(`
`).trim(),tools:s,thinking:n}}async function be(e){let t=(0,Ee.readFileSync)(e,"utf-8"),s=(0,Tt.createHash)("sha256").update(t).digest("hex"),r=(0,j.basename)(e,".jsonl").replace(/-/g,"").slice(0,8),o=t.split(`
`).filter(c=>c.trim()).map(c=>{try{return JSON.parse(c)}catch{return null}}).filter(c=>c!==null),i="",a="",d=null,u=[],l=[];for(let c of o){if(c.timestamp&&l.push(Date.parse(c.timestamp)),c.type==="file-history-snapshot"||c.type==="system"||c.type==="progress"||c.isMeta||c.isSidechain)continue;let b=c.message;if(b){if(!i&&c.cwd&&(i=es(c.cwd)),!a&&c.timestamp&&(a=c.timestamp.slice(0,10)),b.role==="user"&&c.type==="user"){let{text:w,isToolResult:P}=ns(b.content);if(P||!w)continue;d||(d=w.slice(0,120)),u.push({role:"user",text:w,tools:[],thinking:[],timestamp:c.timestamp??null})}if(b.role==="assistant"&&c.type==="assistant"){let{text:w,tools:P,thinking:Q}=ss(b.content);if(!w&&P.length===0&&Q.length===0)continue;u.push({role:"assistant",text:w,tools:P,thinking:Q,timestamp:c.timestamp??null})}}}let m=900*1e3;l.sort((c,b)=>c-b);let g=0;for(let c=1;c<l.length;c++)g+=Math.min(l[c]-l[c-1],m);let f=Math.round(g/1e3),A=l.length>0?l[l.length-1]:Date.now();return{session_id:r,path:e,project:i,date:a,title:d,hash:s,duration_seconds:f,last_message_at:A,turns:u}}function xt(e){let t=[`# Session: ${e.project} \u2014 ${e.date}`,""];e.title&&t.push(`_${e.title}_`,"");for(let s of e.turns)if(s.role==="user")t.push("## User","",s.text,"");else{t.push("## Assistant",""),s.text&&t.push(s.text,"");for(let n of s.tools)t.push(`> **Tool:** ${n}`);s.tools.length>0&&t.push("")}return t.join(`
`)}function wt(e){let t=[];for(let s of e.turns){s.text&&t.push(`[${s.role==="user"?"User":"Assistant"}] ${s.text}`);for(let n of s.tools)t.push(`[Tool] ${n}`)}return t.join(`
`)}var Tt,Ee,j,We=_(()=>{"use strict";Tt=require("crypto"),Ee=require("fs"),j=require("path")});function rs(e){let t=[];for(let s of(0,C.readdirSync)(e)){let n=(0,te.join)(e,s);if((0,C.statSync)(n).isDirectory())for(let r of(0,C.readdirSync)(n))r.endsWith(".jsonl")&&t.push((0,te.join)(n,r));else s.endsWith(".jsonl")&&t.push(n)}return t}function os(e){return function(){e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function is(e,t,s){let n=os(s),r=[...e];for(let o=r.length-1;o>0;o--){let i=Math.floor(n()*(o+1));[r[o],r[i]]=[r[i],r[o]]}return r.slice(0,t)}async function It(e,t=2){try{let s=await be(e);if(s.turns.filter(o=>o.role==="user").length<t)return null;let r=wt(s);return r.trim()?{id:s.session_id,path:e,project:s.project,date:s.date,title:s.title,hash:s.hash,duration_seconds:s.duration_seconds,last_message_at:s.last_message_at,chunkText:r}:null}catch(s){return console.warn("[indexer] Failed to parse JSONL:",e,s),null}}function as(e,t,s){if(!e.startsWith(s))try{let n=(0,te.join)(s,t);(0,C.mkdirSync)(n,{recursive:!0}),(0,C.copyFileSync)(e,(0,te.join)(n,(0,te.basename)(e)))}catch(n){console.warn(`[indexer] Archive failed for ${e}: ${n}`)}}async function Re(e,t,s={},n,r){let o=r??await Ae(),i=t.endsWith(".jsonl")&&(0,C.existsSync)(t),a=!i&&(0,C.existsSync)(t)&&(0,C.statSync)(t).isDirectory(),d=new Map,u=e.prepare("SELECT path, indexed_at FROM sessions").all();for(let h of u)d.set(h.path,h.indexed_at);let l=[];if(i){let h=await It(t,Nt);if(!h){console.log("[indexer] Session skipped (too few user turns or empty)");return}l=[h]}else if(a){let h=rs(t),L=h.filter($=>{let oe=d.get($);return oe?(0,C.statSync)($).mtimeMs>=oe:!0}),z=h.length-L.length;console.log(`[indexer] Found ${h.length} JSONL files (${z} skipped by mtime, ${L.length} to check)`),l=(await Promise.all(L.map($=>It($,Nt)))).filter($=>$!==null)}else{console.error(`[indexer] Path not found or not a JSONL/directory: ${t}`);return}let m=new Map,g=e.prepare("SELECT id, hash FROM sessions").all();for(let h of g)m.set(h.id,h.hash);if(s.sessions&&s.sessions<l.length){let h=s.seed??42;l=is(l,s.sessions,h),console.log(`[indexer] Sampled ${l.length} sessions (seed=${h})`)}let f=l.filter(({id:h,hash:L})=>s.force?!0:m.get(h)!==L),A=l.length-f.length,c=i?1:l.length;console.log(`[indexer] ${f.length} sessions to index (${c} total, ${A} up-to-date)`);let b=e.prepare(`
    INSERT INTO sessions (id, path, project, date, title, hash, indexed_at, duration_seconds, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path=excluded.path, project=excluded.project, date=excluded.date,
      title=excluded.title, hash=excluded.hash, indexed_at=excluded.indexed_at,
      duration_seconds=excluded.duration_seconds, last_message_at=excluded.last_message_at,
      summary=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.summary END,
      tags=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.tags END,
      entities=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.entities END,
      enriched_at=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.enriched_at END,
      enrichment_version=CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.enrichment_version END
  `),w=e.prepare(`
    INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),P=e.prepare(`
    INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding)
    VALUES (?, ?)
  `),Q=e.prepare("DELETE FROM chunks WHERE session_id = ?"),K=e.prepare("DELETE FROM chunks_vec WHERE chunk_id LIKE ?");for(let h=0;h<f.length;h++){let{id:L,path:z,project:re,date:$,title:oe,hash:_e,duration_seconds:$e,last_message_at:Fe,chunkText:Ue}=f[h],de=s.archiveDir===void 0?me:s.archiveDir;de!==null&&as(z,re,de);let Se=ct(Ue),p=Date.now(),R=e.transaction(()=>(Q.run(L),K.run(`${L}_%`),b.run(L,z,re,$,oe,_e,p,$e,Fe),Se))();process.stdout.write(`[${h+1}/${f.length}] ${L} (${re}/${$}) \u2014 ${R.length} chunks
`),n?.(h,f.length,L);let I=e.transaction(O=>{for(let{chunkId:B,seq:F,pos:Z,text:On,embedding:Dn}of O)w.run(B,L,F,Z,On,p),P.run(B,Buffer.from(Dn.buffer))}),y=[];for(let O=0;O<R.length;O++){let B=R[O],F=`${L}_${O}`,Z=await o.embed(B.text);y.push({chunkId:F,seq:O,pos:B.pos,text:B.text,embedding:Z})}I(y)}n?.(f.length,f.length,""),console.log(`[indexer] Done. Total sessions indexed: ${f.length}`)}async function vt(e,t){let s=e.prepare(`
    SELECT c.id, c.text FROM chunks c
    LEFT JOIN chunks_vec v ON v.chunk_id = c.id
    WHERE c.seq = -1 AND v.chunk_id IS NULL
  `).all();if(s.length===0)return;console.log(`[indexer] Embedding ${s.length} summary chunk(s) into chunks_vec`);let n=e.prepare("INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)");for(let{id:r,text:o}of s){let i=await t.embed(o);n.run(r,Buffer.from(i.buffer))}console.log("[indexer] Summary chunks embedded.")}var C,te,Nt,Je=_(()=>{"use strict";C=require("fs"),te=require("path");M();lt();Qe();We();Nt=2});function kt(e,t){for(let s of t)for(let n of e){let r=`${s}/${n}`;if((0,G.existsSync)(r)){let o=n.match(/\.so\.(\d+)/);return{path:r,soVersion:o?.[1]??null}}}return null}function ds(){try{let e=Bun.spawnSync(["nvidia-smi","--query-gpu=name,driver_version","--format=csv,noheader,nounits"]);if(e.exitCode!==0||!e.stdout)return null;let t=e.stdout.toString("utf-8").trim().split(", ");if(t.length<2)return null;let s=t[0].trim(),n=t[1].trim(),o=Bun.spawnSync(["nvidia-smi"]).stdout?.toString("utf-8").match(/CUDA Version:\s*([\d.]+)/);return{name:s,driver:n,cudaVersion:o?.[1]??"unknown"}}catch{return null}}function us(){try{let e=(0,G.readFileSync)("/etc/os-release","utf-8"),t={};for(let s of e.split(`
`)){let n=s.match(/^(\w+)="?([^"]*)"?$/);n&&(t[n[1]]=n[2])}return t}catch{return{}}}function ps(){return(0,G.existsSync)("/usr/bin/apt-get")?"apt":(0,G.existsSync)("/usr/bin/dnf")?"dnf":(0,G.existsSync)("/usr/bin/yum")?"yum":(0,G.existsSync)("/usr/bin/pacman")?"pacman":"unknown"}function ms(){try{return(0,G.readdirSync)("/etc/apt/sources.list.d").some(e=>e.startsWith("cuda")||e.includes("nvidia"))}catch{return!1}}function gs(e){let t=e.libcudart,s=e.libcublas;return!t?.found||!s?.found?"linux-x64":t.soVersion==="13"&&s.soVersion==="13"?"linux-x64-cuda":"linux-x64-cuda-ext"}function fs(e,t,s){let n=e.cudaVersion!=="unknown"?e.cudaVersion.split(".").slice(0,2).join("-"):"12-8",r=n.split("-")[0],o=[];if(t==="apt"){if(!s){let i=us(),a=i.ID?.toLowerCase()??"ubuntu",d=i.VERSION_ID?.replace(".","")??"2204";o.push(`wget https://developer.download.nvidia.com/compute/cuda/repos/${a}${d}/x86_64/cuda-keyring_1.1-1_all.deb`),o.push("sudo dpkg -i cuda-keyring_1.1-1_all.deb && sudo apt-get update")}o.push(`sudo apt install -y cuda-cudart-${n} libcublas-${n}`)}else t==="dnf"||t==="yum"?o.push(`sudo ${t} install -y cuda-cudart-${n} libcublas-${n}`):t==="pacman"?o.push("sudo pacman -S cuda"):(o.push("# Install CUDA runtime libs from your package manager or the NVIDIA CUDA toolkit"),o.push(`# Required: libcudart.so.${r}, libcublas.so.${r}, libcublasLt.so.${r}`));return o.push("qrec teardown && qrec serve --daemon"),o}function ne(){if(ce)return ce;if(process.platform!=="linux")return ce={gpuDetected:!1,gpuName:null,driverVersion:null,cudaDriverVersion:null,cudaRuntimeAvailable:!1,vulkanAvailable:!1,missingLibs:[],libProbes:{},selectedBackend:"cpu",activeBinaryName:null,pkgManager:"unknown",cudaRepoConfigured:null,advice:null,installSteps:null},ce;let e=ds(),t={},s=[];for(let g of ls){let f=kt(g.variants,Ct);t[g.name]={found:f!==null,path:f?.path??null,soVersion:f?.soVersion??null},f||s.push(g.name)}let n=kt(["libvulkan.so","libvulkan.so.1"],Ct),r=e!==null&&s.length===0,o=n!==null,i=r?"cuda":o?"vulkan":"cpu",a=r?gs(t):"linux-x64",d=ps(),u=d==="apt"?ms():null,l=null,m=null;return e&&!r&&(l=`GPU detected (${e.name}) but CUDA runtime libs missing: ${s.join(", ")}.`,m=fs(e,d,u)),ce={gpuDetected:e!==null,gpuName:e?.name??null,driverVersion:e?.driver??null,cudaDriverVersion:e?.cudaVersion??null,cudaRuntimeAvailable:r,vulkanAvailable:o,missingLibs:s,libProbes:t,selectedBackend:i,activeBinaryName:a,pkgManager:d,cudaRepoConfigured:u,advice:l,installSteps:m},ce}var G,Ct,ls,ce,Oe=_(()=>{"use strict";G=require("node:fs"),Ct=["/usr/lib","/usr/lib64","/usr/lib/x86_64-linux-gnu","/usr/lib/aarch64-linux-gnu","/usr/local/cuda/lib64","/usr/local/cuda/targets/x86_64-linux/lib","/usr/local/cuda/targets/aarch64-linux/lib",...process.env.LD_LIBRARY_PATH?.split(":").filter(Boolean)??[],...process.env.CUDA_PATH?[`${process.env.CUDA_PATH}/lib64`]:[]],ls=[{name:"libcudart",variants:["libcudart.so","libcudart.so.11","libcudart.so.12","libcudart.so.13"]},{name:"libcublas",variants:["libcublas.so","libcublas.so.11","libcublas.so.12","libcublas.so.13"]},{name:"libcublasLt",variants:["libcublasLt.so","libcublasLt.so.11","libcublasLt.so.12","libcublasLt.so.13"]}];ce=null});var Mt,Pt=_(()=>{"use strict";Mt=`You are a concise technical summarizer for AI coding sessions.
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
- No explanation outside the JSON block`});function hs(e,t=6e3){let s=e.split(`
`),n=[],r=0;for(let o of s)if(!o.startsWith("[Tool]")){if(r+o.length>t){n.push("... (truncated)");break}n.push(o),r+=o.length+1}return n.join(`
`)}function De(e){return Array.isArray(e)?e.filter(t=>typeof t=="string"):[]}function Es(e){let t=e.replace(/<think>[\s\S]*?<\/think>/g,"").trim(),s=t.match(/\{[\s\S]*\}/);if(!s)return{title:"",summary:t.slice(0,500)||"",tags:[],entities:[],learnings:[],questions:[]};try{let n=JSON.parse(s[0]);return{title:typeof n.title=="string"?n.title:"",summary:typeof n.summary=="string"?n.summary:"",tags:De(n.tags),entities:De(n.entities),learnings:De(n.learnings),questions:De(n.questions)}}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}}async function $t(e,t){let{LlamaChatSession:s}=await import("node-llama-cpp"),n=e.ctx.getSequence(),r=new s({contextSequence:n,systemPrompt:Mt}),i=`/no_think

Transcript:

${hs(t)}

JSON summary:`;try{let a=await r.prompt(i,{maxTokens:600,temperature:.1});return Es(a)}catch{return{title:"",summary:"",tags:[],entities:[],learnings:[],questions:[]}}finally{n.dispose()}}var Ft=_(()=>{"use strict";Pt()});var Bt={};ue(Bt,{ENRICHMENT_VERSION:()=>V,ENRICH_PID_FILE:()=>q,disposeSummarizer:()=>Ke,isEnrichAlive:()=>ze,isProcessAlive:()=>ke,loadSummarizer:()=>Ut,readEnrichPid:()=>Ce,runEnrich:()=>Ss});function Ce(){if(!(0,k.existsSync)(q))return null;let e=parseInt((0,k.readFileSync)(q,"utf-8").trim(),10);return isNaN(e)?null:e}function ke(e){try{return process.kill(e,0),!0}catch{return!1}}function ze(){let e=Ce();return e!==null&&ke(e)}function Rs(e){(0,k.mkdirSync)(T,{recursive:!0}),(0,k.writeFileSync)(q,String(e),"utf-8")}function Ye(){try{(0,k.unlinkSync)(q)}catch{}}async function Ut(){let{resolveModelFile:e,getLlama:t}=await import("node-llama-cpp");(0,k.mkdirSync)(J,{recursive:!0}),process.stdout.write(`[enrich] Resolving model...
`);let s=-1,n=!1,r=null,o=await e(bs,{directory:J,onProgress({totalSize:u,downloadedSize:l}){n=!0;let m=u?Math.round(l/u*100):0;if(process.stdout.write(`\r[enrich] Downloading model... ${m}%`),Math.abs(m-s)>=5){s=m;let g=u?Math.round(u/1024/1024):null;r=g;let f=Math.round(l/1024/1024);try{(0,k.writeFileSync)(pe,JSON.stringify({percent:m,downloadedMB:f,totalMB:g}),"utf-8")}catch{}}}});n&&process.stdout.write(`
`),process.stdout.write(`[enrich] Model ready at ${o}
`);let i=await t(),a=await i.loadModel({modelPath:o}),d=await a.createContext({contextSize:8192,sequences:1,flashAttention:!0});console.log("[enrich] Model loaded.");try{(0,k.unlinkSync)(pe)}catch{}return n&&N({type:"enrich_model_downloaded",data:{totalMB:r}}),N({type:"enrich_model_loaded"}),{llama:i,model:a,ctx:d}}async function Ke(e){await e.ctx.dispose(),await e.model.dispose(),await e.llama.dispose()}function ys(e,t){return e.prepare("SELECT text FROM chunks WHERE session_id = ? ORDER BY seq").all(t).map(n=>n.text).join(`

`)}function jt(e,t,s,n=[],r=[]){return[e,t.length>0?"Tags: "+t.join(", "):"",s.length>0?"Entities: "+s.join(", "):"",n.length>0?"Learnings: "+n.join(" "):"",r.length>0?"Questions: "+r.join(" "):""].filter(Boolean).join(`
`)}function _s(e){let t=e.prepare(`SELECT id, summary, tags, entities, learnings, questions FROM sessions
     WHERE enriched_at IS NOT NULL
       AND id NOT IN (SELECT session_id FROM chunks WHERE id = session_id || '_summary')`).all();if(t.length===0)return;console.log(`[enrich] Backfilling summary chunks for ${t.length} already-enriched session(s)`);let s=e.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let n of t){if(!n.summary)continue;let r=n.tags?JSON.parse(n.tags):[],o=n.entities?JSON.parse(n.entities):[],i=n.learnings?JSON.parse(n.learnings):[],a=n.questions?JSON.parse(n.questions):[],d=jt(n.summary,r,o,i,a);s.run(`${n.id}_summary`,n.id,-1,-1,d,Date.now())}console.log("[enrich] Backfill done.")}async function Ss(e={}){Rs(process.pid);let t=ee();try{_s(t);let s=e.minAgeMs!==void 0?Date.now()-e.minAgeMs:null,n=s!==null?t.prepare("SELECT id FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").all(V,s):t.prepare("SELECT id FROM sessions WHERE enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?").all(V);if(e.limit!==void 0&&(n=n.slice(0,e.limit)),n.length===0){console.log("[enrich] No pending sessions. Exiting without loading model.");return}console.log(`[enrich] ${n.length} session(s) to enrich`);let r=Date.now();N({type:"enrich_started",data:{pending:n.length}});let o=0,i=!1,a=null;try{a=await Ut();let d=t.prepare("UPDATE sessions SET summary=?, tags=?, entities=?, learnings=?, questions=?, title = CASE WHEN ? != '' THEN ? ELSE title END, enriched_at=?, enrichment_version=? WHERE id=?"),u=t.prepare("DELETE FROM chunks WHERE id = ?"),l=t.prepare("INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");for(let m=0;m<n.length;m++){let{id:g}=n[m],f=ys(t,g);if(!f.trim()){t.prepare("UPDATE sessions SET enriched_at=?, enrichment_version=? WHERE id=?").run(Date.now(),V,g),console.log(`[${m+1}/${n.length}] ${g} \u2014 skip (no chunks)`);continue}let A=Date.now(),c=await $t(a,f),b=Date.now()-A,w=Date.now();if(d.run(c.summary,JSON.stringify(c.tags),JSON.stringify(c.entities),JSON.stringify(c.learnings),JSON.stringify(c.questions),c.title,c.title,w,V,g),c.summary||c.tags.length>0||c.entities.length>0||c.learnings.length>0||c.questions.length>0){let P=jt(c.summary,c.tags,c.entities,c.learnings,c.questions);u.run(`${g}_summary`),l.run(`${g}_summary`,g,-1,-1,P,w)}N({type:"session_enriched",data:{sessionId:g,latencyMs:b}}),o++,console.log(`[${m+1}/${n.length}] ${g} \u2014 ${b}ms`),c.summary&&console.log(`  Summary: ${c.summary.slice(0,100)}`),c.tags.length>0&&console.log(`  Tags: ${c.tags.join(", ")}`),c.learnings.length>0&&console.log(`  Learnings: ${c.learnings.length}`),c.questions.length>0&&console.log(`  Questions: ${c.questions.length}`)}N({type:"enrich_complete",data:{enriched:o,durationMs:Date.now()-r}}),console.log("[enrich] Done."),t.close(),Ye(),i=!0,await Ke(a)}finally{if(!i){N({type:"enrich_complete",data:{enriched:o,durationMs:Date.now()-r}});try{t.close()}catch{}if(Ye(),a)try{await Ke(a)}catch{}}}}finally{try{t.close()}catch{}Ye()}}var k,V,bs,Me=_(()=>{"use strict";k=require("fs");M();ge();Ft();ie();V=3,bs="hf:bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen_Qwen3-1.7B-Q4_K_M.gguf"});function Y(e=we){try{let t=JSON.parse((0,le.readFileSync)(e,"utf-8"));return{...qt,...t}}catch(t){return t.code!=="ENOENT"&&console.warn("[config] Failed to parse config.json, using defaults:",t),{...qt}}}function Ht(e,t=we){let n={...Y(t),...e},r=t===we?T:t.replace(/\/[^/]+$/,"");return(0,le.mkdirSync)(r,{recursive:!0}),(0,le.writeFileSync)(t,JSON.stringify(n,null,2),"utf-8"),n}var le,qt,Ze=_(()=>{"use strict";le=require("fs");M();qt={enrichEnabled:!0,enrichIdleMs:300*1e3,indexIntervalMs:6e4}});function Vt(e){if(!Y().enrichEnabled)return;let t=Ce();if(t!==null&&ke(t)){console.log("[server] Enrich child already running, skipping spawn.");return}let s=Y().enrichIdleMs,n=Date.now()-s;if(e.prepare("SELECT COUNT(*) as n FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?").get(V,n).n===0)return;let o=H,i=typeof Wt.dir=="string"?["bun","run",(0,tt.join)(Wt.dir,"cli.ts"),"enrich"]:[process.argv[0],process.argv[1],"enrich"],a=Bun.spawn([...i,"--min-age-ms",String(s)],{detached:!0,stdio:["ignore",Bun.file(o),Bun.file(o)]});a.unref(),console.log(`[server] Spawned enrich child (PID ${a.pid})`)}async function Qt(e,t,s=!1){if(t.isIndexing||!(0,et.existsSync)(Gt))return;t.isIndexing=!0;let n=Date.now();s&&N({type:"index_started"}),s&&(S.phase="indexing"),S.indexing={indexed:0,total:0,current:""};let r=0,o=-1,i=[];try{if(await Re(e,Gt,{},(a,d,u)=>{S.indexing={indexed:a,total:d,current:u},u&&a>o&&(s?N({type:"session_indexed",data:{sessionId:u}}):i.push(u),r++,o=a)}),s&&(0,et.existsSync)(me)&&(o=-1,await Re(e,me,{},(a,d,u)=>{S.indexing={indexed:a,total:d,current:u},u&&a>o&&(N({type:"session_indexed",data:{sessionId:u}}),r++,o=a)})),!s&&r>0){N({type:"index_started"});for(let a of i)N({type:"session_indexed",data:{sessionId:a}})}(s||r>0)&&N({type:"index_complete",data:{newSessions:r,durationMs:Date.now()-n}}),t.embedder&&await vt(e,t.embedder)}catch(a){console.error("[server] Index error:",a)}finally{t.isIndexing=!1,s&&(S.phase="ready")}}async function Yt(e,t,s=10,n=3e4){let r=ne();process.platform==="linux"&&(console.log(`[server] GPU: ${r.gpuDetected?`${r.gpuName} (driver ${r.driverVersion}, CUDA ${r.cudaDriverVersion})`:"none detected"}`),console.log(`[server] Compute backend: ${r.selectedBackend}`),r.advice&&console.warn(`[server] WARNING: ${r.advice}`));for(let o=1;o<=s;o++)try{S.phase="model_loading",t.embedder=await Ae(),t.embedderError=null,console.log("[server] Model ready");let i=Y().indexIntervalMs;Vt(e),setInterval(()=>Vt(e),i),await Qt(e,t,!0),S.phase="ready",setInterval(()=>Qt(e,t),i);return}catch(i){t.embedderError=String(i),console.error(`[server] Model load failed (attempt ${o}/${s}):`,i),o<s&&(console.log(`[server] Retrying in ${n/1e3}s...`),await Bun.sleep(n))}console.error("[server] Model load gave up after all retries."),S.phase="ready"}var et,Jt,tt,Wt,Gt,Xt,br,nt=_(()=>{"use strict";Qe();Je();Ne();ie();et=require("fs"),Jt=require("os"),tt=require("path");M();Me();Ze();Oe();Wt={},Gt=process.env.QREC_PROJECTS_DIR??(0,tt.join)((0,Jt.homedir)(),".claude","projects"),Xt=parseInt(process.env.QREC_INDEX_INTERVAL_MS??"60000",10),br=parseInt(process.env.QREC_ENRICH_IDLE_MS??String(300*1e3),10)});function Ts(e,t=150){let s=[],n=/<mark>/g,r;for(;(r=n.exec(e))!==null;){let i=Math.max(0,r.index-t),a=e.indexOf("</mark>",r.index),d=Math.min(e.length,(a===-1?r.index:a+7)+t);s.push([i,d])}if(s.length===0)return e.slice(0,t*2);s.sort((i,a)=>i[0]-a[0]);let o=[s[0]];for(let i=1;i<s.length;i++){let a=o[o.length-1];s[i][0]<=a[1]?a[1]=Math.max(a[1],s[i][1]):o.push(s[i])}return o.map(([i,a])=>{let d=i>0?"\u2026":"",u=a<e.length?"\u2026":"",l=e.slice(i,a);return i>0&&(l=l.replace(/^[^<>]*>/,"")),l=l.replace(/<[^>]*$/,""),`${d}${l}${u}`}).join(" <span class='snippet-gap'>\u2026</span> ")}function xs(e){return(0,zt.createHash)("sha256").update(e).digest("hex")}async function ws(e,t,s){let n=xs(t),r=e.prepare("SELECT embedding FROM query_cache WHERE query_hash = ?").get(n);if(r){let d=r.embedding;return{embedding:new Float32Array(d.buffer,d.byteOffset,d.byteLength/4),cached:!0,embedMs:0}}let o=performance.now(),i=await s.embed(t),a=performance.now()-o;return e.prepare("INSERT OR REPLACE INTO query_cache (query_hash, embedding, created_at) VALUES (?, ?, ?)").run(n,Buffer.from(i.buffer),Date.now()),{embedding:i,cached:!1,embedMs:a}}async function Zt(e,t,s,n=10,r){let o=performance.now(),i=performance.now(),a=[],d=s.replace(/[^a-zA-Z0-9\s'-]/g," ").replace(/\s+/g," ").trim();try{d.length>0&&(a=e.prepare("SELECT rowid, session_id, rank FROM chunks_fts WHERE text MATCH ? ORDER BY rank LIMIT ?").all(d,n*5))}catch(p){console.warn("[search] FTS5 query failed, falling back to KNN only:",p),a=[],d=""}let u=performance.now()-i,{embedding:l,embedMs:m}=await ws(e,s,t),g=performance.now(),f=Buffer.from(l.buffer),A=e.prepare("SELECT chunk_id, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ?").all(f,n*5),c=performance.now()-g,b=performance.now(),w=new Map;if(a.length>0){let p=a.map(y=>y.rowid),E=p.map(()=>"?").join(","),R=e.prepare(`SELECT rowid, id FROM chunks WHERE rowid IN (${E})`).all(...p),I=new Map(R.map(y=>[y.rowid,y.id]));for(let y=0;y<a.length;y++){let O=I.get(a[y].rowid);O&&w.set(O,{bm25Rank:y+1,rowid:a[y].rowid})}}for(let p=0;p<A.length;p++){let E=A[p].chunk_id,R=w.get(E);R?R.vecRank=p+1:w.set(E,{vecRank:p+1})}if(r&&(r.dateFrom||r.dateTo||r.project||r.tag)){let p=new Set;for(let E of w.keys())p.add(E.split("_").slice(0,-1).join("_"));if(p.size>0){let E=[...p],I=[`id IN (${E.map(()=>"?").join(",")})`],y=[...E];r.dateFrom&&(I.push("date >= ?"),y.push(r.dateFrom)),r.dateTo&&(I.push("date <= ?"),y.push(r.dateTo)),r.project&&(I.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),y.push(r.project)),r.tag&&(I.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),y.push(r.tag));let O=e.prepare(`SELECT id FROM sessions WHERE ${I.join(" AND ")}`).all(...y),B=new Set(O.map(F=>F.id));for(let[F]of w){let Z=F.split("_").slice(0,-1).join("_");B.has(Z)||w.delete(F)}}}let P=new Map;for(let[p,E]of w){let R=(E.bm25Rank!==void 0?1/(Kt+E.bm25Rank):0)+(E.vecRank!==void 0?1/(Kt+E.vecRank):0);P.set(p,R)}let Q=new Map;for(let[p,E]of P){let R=p.split("_").slice(0,-1).join("_"),I=Q.get(R);(!I||E>I.score)&&Q.set(R,{score:E,bestChunkId:p})}let K=[...Q.entries()].sort((p,E)=>E[1].score-p[1].score).slice(0,n),h=performance.now()-b,L=performance.now()-o;if(K.length===0)return[];let z=K.map(([p])=>p),re=z.map(()=>"?").join(","),$=e.prepare(`SELECT id, project, date, indexed_at, last_message_at, title, summary FROM sessions WHERE id IN (${re})`).all(...z),oe=new Map($.map(p=>[p.id,p])),_e=K.map(([,p])=>p.bestChunkId),$e=_e.map(()=>"?").join(","),Fe=e.prepare(`SELECT id, session_id, text FROM chunks WHERE id IN (${$e})`).all(..._e),Ue=new Map(Fe.map(p=>[p.id,p])),de=new Map;if(d.length>0)for(let[,{bestChunkId:p}]of K){let E=w.get(p)?.rowid;if(E!==void 0)try{let R=e.prepare("SELECT highlight(chunks_fts, 1, '<mark>', '</mark>') as hl FROM chunks_fts WHERE chunks_fts MATCH ? AND rowid = ?").get(d,E);R?.hl&&de.set(p,R.hl)}catch(R){console.warn("[search] Highlight extraction failed:",R)}}let Se=[];for(let[p,{score:E,bestChunkId:R}]of K){let I=oe.get(p);if(!I)continue;let y=Ue.get(R),O=y?y.text:"",B=O.slice(0,300)+(O.length>300?"\u2026":""),F=de.get(R),Z=F?Ts(F):void 0;Se.push({session_id:p,score:E,preview:B,highlightedPreview:Z,project:I.project,date:I.date,indexed_at:I.indexed_at,last_message_at:I.last_message_at??null,title:I.title,summary:I.summary??null,latency:{bm25Ms:u,embedMs:m,knnMs:c,fusionMs:h,totalMs:L}})}return Se}var zt,Kt,en=_(()=>{"use strict";zt=require("crypto");Kt=60});function tn(e,t,s,n,r){let o=n[0]??null;e.prepare(`
    INSERT INTO query_audit (query, k, result_count, top_session_id, top_score, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(t,s,n.length,o?.session_id??null,o?.score??null,r,Date.now())}function nn(e,t=100){return e.prepare("SELECT * FROM query_audit ORDER BY created_at DESC LIMIT ?").all(t)}var sn=_(()=>{"use strict"});function Pe(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function rn(e){let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get();return Response.json({status:"ok",phase:S.phase,indexedSessions:t.count})}function on(e){let t=e.prepare("SELECT COUNT(*) as n FROM sessions").get().n,s=e.prepare("SELECT COUNT(*) as n FROM chunks").get().n,n=e.prepare("SELECT MAX(indexed_at) as ts FROM sessions").get(),r=e.prepare("SELECT COUNT(*) as n FROM query_audit").get().n,o=e.prepare("SELECT COUNT(*) as n FROM sessions WHERE enriched_at IS NOT NULL AND enrichment_version >= ?").get(V).n,i=t-o;return Response.json({status:"ok",version:"0.7.0",phase:S.phase,sessions:t,chunks:s,lastIndexedAt:n.ts,searches:r,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",embedModel:process.env.QREC_EMBED_PROVIDER==="ollama"?process.env.QREC_OLLAMA_MODEL??"nomic-embed-text":process.env.QREC_EMBED_PROVIDER==="openai"?process.env.QREC_OPENAI_MODEL??"text-embedding-3-small":"gemma-300M",enrichModel:"Qwen3-1.7B",modelDownload:S.modelDownload,indexing:S.indexing,memoryMB:Math.round(process.memoryUsage().rss/1024/1024),enriching:ze(),enrichedCount:o,pendingCount:i,enrichEnabled:Y().enrichEnabled,enrichProgress:(()=>{try{return JSON.parse((0,st.readFileSync)(pe,"utf-8"))}catch(a){return a.code!=="ENOENT"&&console.warn("[server] Failed to read enrich progress:",a),null}})(),compute:(()=>{let a=ne();return{selectedBackend:a.selectedBackend,gpuDetected:a.gpuDetected,gpuName:a.gpuName,driverVersion:a.driverVersion,cudaDriverVersion:a.cudaDriverVersion,cudaRuntimeAvailable:a.cudaRuntimeAvailable,vulkanAvailable:a.vulkanAvailable,missingLibs:a.missingLibs,libProbes:a.libProbes,activeBinaryName:a.activeBinaryName,installSteps:a.installSteps,advice:a.advice}})()})}function an(e){let t=e.prepare("SELECT project, MAX(date) as last_active FROM sessions WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY last_active DESC").all();return Response.json({projects:t.map(s=>s.project)})}async function cn(e,t,s){if(!t.embedder)return Response.json({error:t.embedderError??`Model not ready yet (phase: ${S.phase})`},{status:503});let n;try{n=await s.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let r=n.query?.trim();if(!r)return Response.json({error:"Missing required field: query"},{status:400});let o=n.k??10,i={};n.dateFrom&&(i.dateFrom=n.dateFrom),n.dateTo&&(i.dateTo=n.dateTo),n.project&&(i.project=n.project),n.tag&&(i.tag=n.tag);let a=performance.now();try{let d=await Zt(e,t.embedder,r,o,i),u=performance.now()-a;try{tn(e,r,o,d,u)}catch(m){console.warn("[server] Failed to write audit query:",m)}let l=d[0]?.latency.totalMs??0;return Response.json({results:d,latencyMs:l})}catch(d){return console.error("[server] Search error:",d),Response.json({error:String(d)},{status:500})}}async function ln(e,t){let s;try{s=await t.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let n=s.sql?.trim()??"";if(!n)return Response.json({error:"Missing required field: sql"},{status:400});if(!n.toUpperCase().startsWith("SELECT"))return Response.json({error:"Only SELECT queries are allowed"},{status:400});if(n.includes(";"))return Response.json({error:"Semicolons are not allowed (no statement stacking)"},{status:400});try{let r=e.prepare(n).all();return Response.json({rows:r,count:r.length})}catch(r){return Response.json({error:String(r)},{status:500})}}function dn(){return Response.json(Y())}async function un(e){let t;try{t=await e.json()}catch{return Response.json({error:"Invalid JSON body"},{status:400})}let s={};if(t.enrichEnabled!==void 0&&(s.enrichEnabled=!!t.enrichEnabled),t.enrichIdleMs!==void 0){let r=t.enrichIdleMs;if(!Number.isInteger(r)||r<6e4||r>36e5)return Response.json({error:"enrichIdleMs must be an integer between 60000 and 3600000"},{status:400});s.enrichIdleMs=r}if(t.indexIntervalMs!==void 0){let r=t.indexIntervalMs;if(!Number.isInteger(r)||r<1e4||r>36e5)return Response.json({error:"indexIntervalMs must be an integer between 10000 and 3600000"},{status:400});s.indexIntervalMs=r}let n=Ht(s);return Response.json(n)}function pn(e,t){let n=Math.max(0,parseInt(t.searchParams.get("offset")??"0",10)||0),r=t.searchParams.get("date")??null,o=r??t.searchParams.get("dateFrom")??null,i=r??t.searchParams.get("dateTo")??null,a=t.searchParams.get("project")??null,d=t.searchParams.get("tag")??null,u=[],l=[];o&&(u.push("date >= ?"),l.push(o)),i&&(u.push("date <= ?"),l.push(i)),a&&(u.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"),l.push(a)),d&&(u.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')"),l.push(d));let m=u.length>0?`WHERE ${u.join(" AND ")}`:"",g=e.prepare(`SELECT id, title, project, date, indexed_at, last_message_at, summary, tags, entities, learnings, questions FROM sessions ${m} ORDER BY COALESCE(last_message_at, indexed_at) DESC LIMIT ? OFFSET ?`).all(...l,100,n),f=e.prepare(`SELECT COUNT(*) as count FROM sessions ${m}`).get(...l).count,A=g.map(c=>({...c,tags:c.tags?JSON.parse(c.tags):null,entities:c.entities?JSON.parse(c.entities):null,learnings:c.learnings?JSON.parse(c.learnings):null,questions:c.questions?JSON.parse(c.questions):null}));return Response.json({sessions:A,total:f,offset:n,limit:100})}async function mn(e,t){let s=e.prepare("SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?").get(t);if(!s)return Response.json({error:"Session not found"},{status:404});try{let n=await be(s.path);return Response.json({id:s.id,title:s.title,project:s.project,date:s.date,path:s.path,summary:s.summary??null,tags:s.tags?JSON.parse(s.tags):null,entities:s.entities?JSON.parse(s.entities):null,learnings:s.learnings?JSON.parse(s.learnings):null,questions:s.questions?JSON.parse(s.questions):null,turns:n.turns})}catch(n){return console.error("[server] Failed to parse session:",n),Response.json({error:String(n)},{status:500})}}async function gn(e,t){let s=e.prepare("SELECT path, summary, tags, entities FROM sessions WHERE id = ?").get(t);if(!s)return new Response("Session not found",{status:404});try{let n=await be(s.path),r=xt(n);if(s.summary){let o=s.tags?JSON.parse(s.tags):[],i=s.entities?JSON.parse(s.entities):[];r=["## Summary","",s.summary,"",o.length>0?`**Tags:** ${o.join(", ")}`:"",i.length>0?`**Entities:** ${i.join(", ")}`:"","","---",""].filter((d,u,l)=>!(d===""&&l[u-1]==="")).join(`
`)+r}return new Response(r,{headers:{"Content-Type":"text/plain; charset=utf-8"}})}catch(n){return console.error("[server] Failed to render session markdown:",n),new Response(String(n),{status:500})}}function fn(e,t){let s=Math.min(52,Math.max(4,parseInt(t.searchParams.get("weeks")??"15",10)||15)),n=t.searchParams.get("metric")??"sessions",r=t.searchParams.get("project")??null,o=new Date;o.setDate(o.getDate()-s*7+1),o.setHours(0,0,0,0);let i=Pe(o),a=r?" AND project = ?":"",d=r?[i,r]:[i],u;n==="hours"?u=e.prepare(`SELECT date, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ?${a} GROUP BY date ORDER BY date ASC`).all(...d):u=e.prepare(`SELECT date, COUNT(*) as count FROM sessions WHERE date >= ?${a} GROUP BY date ORDER BY date ASC`).all(...d);let l=new Map(u.map(c=>[c.date,c.count])),m=[],g=new Date(o),f=new Date;for(;Pe(g)<=Pe(f);){let c=Pe(g);m.push({date:c,count:l.get(c)??0}),g.setDate(g.getDate()+1)}let A={};if(!r){let c;n==="hours"?c=e.prepare("SELECT date, project, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(i):c=e.prepare("SELECT date, project, COUNT(*) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC").all(i);for(let b of c)A[b.date]||(A[b.date]={}),A[b.date][b.project]=b.count}return Response.json({days:m,metric:n,total:u.reduce((c,b)=>c+b.count,0),active_days:u.filter(c=>c.count>0).length,byProject:A})}function hn(e,t){let s=parseInt(t.searchParams.get("limit")??"100",10);try{let n=nn(e,s);return Response.json({entries:n})}catch(n){return Response.json({error:String(n)},{status:500})}}function En(e){let t=parseInt(e.searchParams.get("limit")??"100",10),s=dt(t);return Response.json({entries:s})}function bn(e){let t=parseInt(e.searchParams.get("lines")??"100",10);try{let n=(0,st.readFileSync)(H,"utf-8").split(`
`).filter(r=>r.length>0).slice(-t);return Response.json({lines:n})}catch{return Response.json({lines:[]})}}function Rn(){return Response.json({dbPath:qe,logPath:H,modelCachePath:J,embedProvider:process.env.QREC_EMBED_PROVIDER??"local",ollamaHost:process.env.QREC_OLLAMA_HOST??null,ollamaModel:process.env.QREC_OLLAMA_MODEL??null,openaiBaseUrl:process.env.QREC_OPENAI_BASE_URL??null,indexIntervalMs:Xt,port:D(),platform:process.platform,bunVersion:process.versions.bun??null,nodeVersion:process.version})}var st,yn=_(()=>{"use strict";nt();en();sn();We();Ne();ie();Ze();Me();M();ge();st=require("fs");Oe()});var As={};async function Is(){if(Sn!==null)return new Response(Sn,{headers:{"Content-Type":"text/html; charset=utf-8"}});if(!(0,wn.existsSync)(xn))return Response.json({error:"UI not found"},{status:404});let e=await Bun.file(xn).text();return new Response(e,{headers:{"Content-Type":"text/html; charset=utf-8"}})}async function Ns(e){let t=e.slice(4);if(t.includes("..")||t.startsWith("/"))return new Response("Forbidden",{status:403});let s=(0,ye.join)(In,t),n=Bun.file(s);if(!await n.exists())return new Response("Not found",{status:404});let r=t.split(".").pop()?.toLowerCase()??"",o=r==="css"?"text/css; charset=utf-8":r==="js"?"text/javascript; charset=utf-8":r==="woff2"?"font/woff2":r==="woff"?"font/woff":r==="ttf"?"font/ttf":"application/octet-stream";return new Response(n,{headers:{"Content-Type":o,"Cache-Control":"no-cache, no-store, must-revalidate"}})}async function vs(){console.log("[server] Starting qrec server...");let e=ee(),t={embedder:null,embedderError:null,isIndexing:!1},s=Bun.serve({port:_n,async fetch(n){let r=new URL(n.url),{method:o}=n,{pathname:i}=r;if(o==="GET"&&i==="/health")return rn(e);if(o==="GET"&&i==="/status")return on(e);if(o==="GET"&&i==="/projects")return an(e);if(o==="GET"&&i==="/stats/heatmap")return fn(e,r);if(o==="GET"&&i==="/sessions")return pn(e,r);if(o==="GET"&&i.startsWith("/sessions/")&&i.endsWith("/markdown")){let a=i.slice(10,-9);return a?gn(e,a):Response.json({error:"Not found"},{status:404})}if(o==="GET"&&i.startsWith("/sessions/")){let a=i.slice(10);return!a||a.includes("/")?Response.json({error:"Not found"},{status:404}):mn(e,a)}return o==="POST"&&i==="/search"?cn(e,t,n):o==="POST"&&i==="/query_db"?ln(e,n):o==="GET"&&i==="/settings"?dn():o==="POST"&&i==="/settings"?un(n):o==="GET"&&i==="/audit/entries"?hn(e,r):o==="GET"&&i==="/activity/entries"?En(r):o==="GET"&&i.startsWith("/ui/")?Ns(i):o==="GET"&&(i==="/"||i==="/search"||i==="/audit"||i==="/debug")?Is():o==="GET"&&i==="/debug/log"?bn(r):o==="GET"&&i==="/debug/config"?Rn():Response.json({error:"Not found"},{status:404})}});console.log(`[server] Listening on http://localhost:${_n}`),N({type:"daemon_started"}),Yt(e,t),process.on("SIGTERM",()=>{console.log("[server] SIGTERM received, shutting down..."),e.close(),s.stop(),process.exit(0)}),process.on("SIGINT",()=>{console.log("[server] SIGINT received, shutting down..."),e.close(),s.stop(),process.exit(0)})}var wn,ye,Ls,_n,Sn,Tn,In,xn,Nn=_(()=>{"use strict";ge();M();ie();wn=require("fs"),ye=require("path");nt();yn();Ls={},_n=D(),Sn=`<!DOCTYPE html>
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
`,Tn=Ls.dir,In=Tn?(0,ye.join)(Tn,"..","ui"):(0,ye.join)(__dirname,"..","..","ui"),xn=(0,ye.join)(In,"index.html");vs().catch(e=>{console.error("[server] Fatal error:",e),process.exit(1)})});ge();Je();Ve();var Lt=require("path"),v=require("fs");M();var At={};function cs(){(0,v.mkdirSync)(T,{recursive:!0})}function Ot(){if(!(0,v.existsSync)(W))return!1;let e=parseInt((0,v.readFileSync)(W,"utf-8").trim(),10);if(isNaN(e))return!1;try{return process.kill(e,0),!0}catch{try{(0,v.unlinkSync)(W)}catch{}return!1}}function Le(){if(!(0,v.existsSync)(W))return null;let e=parseInt((0,v.readFileSync)(W,"utf-8").trim(),10);return isNaN(e)?null:e}async function Dt(){if(Ot()){let a=Le();console.log(`[daemon] qrec server already running (PID ${a})`);return}try{let a=[],d=Bun.spawnSync(["lsof","-ti",`:${D()}`],{stdio:["ignore","pipe","ignore"]});if(d.exitCode===0)a=new TextDecoder().decode(d.stdout).trim().split(`
`).filter(Boolean);else{let u=Bun.spawnSync(["ss","-tlnp",`sport = :${D()}`],{stdio:["ignore","pipe","ignore"]}),m=new TextDecoder().decode(u.stdout).match(/pid=(\d+)/g);m&&(a=m.map(g=>g.replace("pid=","")))}for(let u of a)try{process.kill(parseInt(u),"SIGKILL")}catch{}a.length>0&&await Bun.sleep(300)}catch{}cs();let e=H,t=typeof At.dir=="string"?["bun","run",(0,Lt.join)(At.dir,"server.ts")]:[process.argv[0],process.argv[1],"serve"],s=Bun.spawn(t,{detached:!0,stdio:["ignore",Bun.file(e),Bun.file(e)],env:process.env}),n=s.pid;(0,v.writeFileSync)(W,String(n),"utf-8"),s.unref(),console.log(`[daemon] qrec server started (PID ${n})`),console.log(`[daemon] Logs: ${e}`),console.log("[daemon] Waiting for server to be ready...");let r=parseInt(process.env.QREC_DAEMON_TIMEOUT_MS??"120000",10),o=Date.now()+r,i=!1;for(;Date.now()<o;){await Bun.sleep(500);try{if((await fetch(`http://localhost:${D()}/health`)).ok){i=!0;break}}catch{}}i?console.log(`[daemon] Server ready at http://localhost:${D()}`):(console.error(`[daemon] Server failed to start within 30 seconds. Check logs: ${e}`),process.exit(1))}async function Xe(){if(!Ot()){console.log("[daemon] No running qrec server found.");return}let e=Le();try{process.kill(e,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to PID ${e}`);let t=Date.now()+5e3;for(;Date.now()<t;){await Bun.sleep(200);try{process.kill(e,0)}catch{break}}}catch(t){console.error(`[daemon] Failed to send SIGTERM: ${t}`)}try{let t=(0,v.existsSync)(q)?(0,v.readFileSync)(q,"utf8").trim():null,s=t?parseInt(t,10):null;s&&(process.kill(s,"SIGTERM"),console.log(`[daemon] Sent SIGTERM to enrich PID ${s}`))}catch{}try{(0,v.unlinkSync)(q)}catch{}try{(0,v.unlinkSync)(W)}catch{}console.log("[daemon] qrec server stopped.")}var se=require("fs"),Ln=require("os");M();Oe();var[,,vn,...x]=process.argv;{let e=x.indexOf("--port");if(e!==-1){let t=x[e+1];(!t||isNaN(parseInt(t,10)))&&(console.error("[cli] --port requires a numeric value"),process.exit(1)),process.env.QREC_PORT=t,x.splice(e,2)}}function Os(e=20){if(!(0,se.existsSync)(H))return[];try{return(0,se.readFileSync)(H,"utf-8").split(`
`).filter(n=>n.length>0).slice(-e)}catch{return[]}}function An(){let e=process.platform==="darwin"?"open":"xdg-open";try{Bun.spawnSync([e,`http://localhost:${D()}`])}catch{}}async function Ds(){switch(vn){case"--version":case"-v":console.log("qrec 0.7.0"),process.exit(0);case"teardown":{let e=x.includes("--yes");await Xe(),(0,se.existsSync)(T)||(console.log("[teardown] ~/.qrec/ not found, nothing to remove."),process.exit(0)),e||(process.stdout.write(`[teardown] Remove ${T} (DB, model, logs, pid, activity log)? [y/N] `),(await new Promise(s=>{process.stdin.setEncoding("utf-8"),process.stdin.once("data",n=>s(String(n).trim()))})).toLowerCase()!=="y"&&(console.log("[teardown] Aborted."),process.exit(0))),(0,se.rmSync)(T,{recursive:!0,force:!0}),console.log("[teardown] Removed ~/.qrec/"),process.exit(0)}case"index":{let e,t=!1,s,n;if(!x[0]&&!process.stdin.isTTY){let o=await Bun.stdin.text();try{let i=JSON.parse(o.trim());if(!i.transcript_path)throw new Error("Missing transcript_path");e=i.transcript_path}catch(i){console.error(`[cli] index: failed to parse stdin: ${i}`),process.exit(1)}}else{let o=x[0]??`${(0,Ln.homedir)()}/.claude/projects/`;t=x.includes("--force");let i=x.indexOf("--sessions");s=i!==-1?parseInt(x[i+1],10):void 0;let a=x.indexOf("--seed");n=a!==-1?parseInt(x[a+1],10):void 0,e=o.replace("~",process.env.HOME??"")}console.log(`[cli] Indexing: ${e}${s?` (${s} sessions, seed=${n??42})`:""}`);let r=ee();try{await Re(r,e,{force:t,sessions:s,seed:n})}finally{r.close(),await Ge()}process.exit(0)}case"serve":{let e=x.includes("--daemon"),t=x.includes("--no-open");e?(await Dt(),t||An()):(t||setTimeout(An,1e3),await Promise.resolve().then(()=>(Nn(),As)));break}case"stop":{await Xe();break}case"search":{let e=x.filter(r=>!r.startsWith("--")).join(" ").trim();e||(console.error('[cli] Usage: qrec search "<query>" [--k N]'),process.exit(1));let t=x.indexOf("--k"),s=t!==-1?parseInt(x[t+1],10):10,n=await fetch(`http://localhost:${D()}/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,k:s})});if(!n.ok){let r=await n.json().catch(()=>({}));console.error(`[cli] search failed (${n.status}): ${r.error??"unknown error"}`),process.exit(1)}console.log(JSON.stringify(await n.json(),null,2)),process.exit(0)}case"get":{let e=x[0]?.trim();e||(console.error("[cli] Usage: qrec get <session-id>"),process.exit(1));let t=await fetch(`http://localhost:${D()}/sessions/${e}/markdown`);t.status===404&&(console.error(`[cli] Session not found: ${e}`),process.exit(1)),t.ok||(console.error(`[cli] get failed (${t.status})`),process.exit(1)),console.log(await t.text()),process.exit(0)}case"status":{let e=ee();try{let t=e.prepare("SELECT COUNT(*) as count FROM sessions").get(),s=e.prepare("SELECT COUNT(*) as count FROM chunks").get(),n=e.prepare("SELECT MAX(indexed_at) as last FROM sessions").get(),r=Le(),o=r!==null,i="not checked";if(o)try{let l=await fetch(`http://localhost:${D()}/health`);l.ok?i=(await l.json()).status??"unknown":i=`http error ${l.status}`}catch{i="unreachable"}let a=n.last?new Date(n.last).toISOString():"never",d="0.7.0";if(console.log("=== qrec status ==="),console.log(`Version:        ${d}`),console.log(`Daemon PID:     ${r??"not running"}`),console.log(`HTTP health:    ${i}`),console.log(`Sessions:       ${t.count}`),console.log(`Chunks:         ${s.count}`),console.log(`Last indexed:   ${a}`),process.platform==="linux"){let l=ne();console.log(""),console.log("--- Compute ---");let m=l.selectedBackend==="cpu"&&l.gpuDetected?" (fallback \u2014 CUDA libs missing)":"";console.log(`Backend:        ${l.selectedBackend}${m}`),l.gpuDetected?(console.log(`GPU:            ${l.gpuName} (driver ${l.driverVersion}, CUDA ${l.cudaDriverVersion})`),console.log(`CUDA runtime:   ${l.cudaRuntimeAvailable?"available":"NOT AVAILABLE"}`),l.cudaRuntimeAvailable?console.log(`Binary:         ${l.activeBinaryName}`):(console.log(`  Missing libs: ${l.missingLibs.join(", ")}`),l.installSteps&&(console.log("  Fix:"),l.installSteps.forEach((g,f)=>console.log(`    ${f+1}. ${g}`))))):console.log("GPU:            none detected"),l.vulkanAvailable&&console.log("Vulkan:         available")}console.log(""),console.log("--- Log tail (last 20 lines) ---");let u=Os(20);if(u.length===0)console.log("(no log entries)");else for(let l of u)console.log(l)}finally{e.close()}process.exit(0)}case"enrich":{let e=x.indexOf("--limit"),t=e!==-1?parseInt(x[e+1],10):void 0,s=x.indexOf("--min-age-ms"),n=s!==-1?parseInt(x[s+1],10):void 0,{runEnrich:r}=await Promise.resolve().then(()=>(Me(),Bt));await r({limit:t,minAgeMs:n}),process.exit(0)}case"doctor":{let e=ne();console.log("=== qrec doctor ==="),console.log(""),process.platform!=="linux"&&(console.log(`Platform: ${process.platform}`),console.log("Metal/GPU acceleration is handled automatically by node-llama-cpp on macOS."),console.log("No CUDA probe needed."),process.exit(0));let t=r=>`[check] ${r}`,s=r=>`[FAIL]  ${r}`,n=r=>`        ${r}`;e.gpuDetected?console.log(t(`NVIDIA GPU ............ ${e.gpuName} (driver ${e.driverVersion}, CUDA ${e.cudaDriverVersion})`)):console.log(s("NVIDIA GPU ............ not detected (nvidia-smi not found or no output)"));for(let[r,o]of Object.entries(e.libProbes))o.found?console.log(t(`${r.padEnd(14)} .... .so.${o.soVersion} at ${o.path}`)):console.log(s(`${r.padEnd(14)} .... NOT FOUND`));e.vulkanAvailable?console.log(t("Vulkan ................ available")):console.log(t("Vulkan ................ not found (optional)")),e.activeBinaryName&&console.log(t(`node-llama-cpp binary . ${e.activeBinaryName}`)),console.log(""),e.cudaRuntimeAvailable?console.log(`Result: CUDA backend ready (${e.activeBinaryName})`):e.gpuDetected?(console.log("Result: CUDA libs missing \u2014 running on CPU (fallback)"),console.log(""),console.log("Fix:"),e.installSteps&&e.installSteps.forEach((r,o)=>console.log(`  ${o+1}. ${r}`)),e.cudaRepoConfigured===!1&&(console.log(""),console.log(n("Note: NVIDIA apt repo not found in /etc/apt/sources.list.d/")),console.log(n("      The wget step above adds it. Run apt-get update after.")))):console.log("Result: No NVIDIA GPU detected \u2014 running on CPU"),process.exit(0)}default:console.error(`Unknown command: ${vn}`),console.error("Usage:"),console.error("  qrec teardown [--yes]             # remove all qrec data"),console.error("  qrec index [path] [--force]       # default: ~/.claude/projects/"),console.error("  qrec index                        # stdin JSON {transcript_path} (hook mode)"),console.error("  qrec serve [--daemon] [--no-open] [--port N]"),console.error("  qrec stop"),console.error('  qrec search "<query>" [--k N]   # search indexed sessions'),console.error("  qrec get <session-id>            # print full session markdown"),console.error("  qrec status"),console.error("  qrec enrich [--limit N]           # summarize unenriched sessions"),console.error("  qrec doctor                       # diagnose GPU/CUDA setup"),process.exit(1)}}Ds().catch(e=>{console.error("Fatal error:",e),process.exit(1)});
