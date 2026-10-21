(function(){
  const root={}; const ls=[]; let pushN=0;
  const split=p=>p.split("/").filter(Boolean);
  const get=(p)=>{let n=root;for(const k of split(p)){if(n==null||typeof n!=="object")return null;n=n[k];}return n===undefined?null:n;};
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  const AUK="__au"; const loadAu=()=>{try{return JSON.parse(sessionStorage[AUK]||"null");}catch(e){return null;}}; let cur=loadAu();
  const bc=new BroadcastChannel("fbstub"); const opsBc=new BroadcastChannel("fbops"); const logOp=(op,p,v)=>{try{opsBc.postMessage({t:Date.now(),u:cur&&cur.uid||null,pv:cur?(cur.anon?"anonymous":cur.provider):null,ev:!!(cur&&cur.verified),op,p,v:v===undefined?null:JSON.parse(JSON.stringify(v))});}catch(e){}};
  const sv=v=>{ if(v&&typeof v==="object"){ if(v[".sv"]==="timestamp")return Date.now(); const o=Array.isArray(v)?[]:{}; for(const k in v)o[k]=sv(v[k]); return o;} return v; }; const conn=[]; window.__fbNet=on=>conn.forEach(c=>c({val:()=>on})); window.__fbSet=(p,v)=>setv(p,v);
  function setv(p,v,remote){const ks=split(p);if(!ks.length)return;let n=root;for(let i=0;i<ks.length-1;i++){if(n[ks[i]]==null||typeof n[ks[i]]!=="object")n[ks[i]]={};n=n[ks[i]];}
    const last=ks[ks.length-1]; if(v==null)delete n[last]; else n[last]=clone(sv(v)); prune(); fire(p); if(!remote)bc.postMessage({t:'set',p,v:v==null?null:clone(sv(v))});}
  function prune(){(function r(o){for(const k in o){if(o[k]&&typeof o[k]==="object"){r(o[k]);if(!Object.keys(o[k]).length)delete o[k];}}})(root);}
  const snap=(p)=>{const v=get(p);return {val:()=>clone(v),key:split(p).pop(),exists:()=>v!=null,get ref(){return ref(p);}};};
  function fire(p){ls.forEach(l=>{
    if(l.ev==="value"){ if(p.startsWith(l.p)||l.p.startsWith(p)) setTimeout(()=>l.cb(snap(l.p)),0); }
    else if(l.ev==="child_added"){ if(p.startsWith(l.p+"/")){const ck=split(p)[split(l.p).length]; const cp=l.p+"/"+ck; if(!l.seen.has(ck)&&get(cp)!=null){l.seen.add(ck);setTimeout(()=>l.cb(snap(cp)),0);}}}
  });}
  function ref(path){path=path||"";return{
    child:c=>ref(path+"/"+c), key:split(path).pop(),
    set:v=>{logOp("set",path,v);setv(path,v);return Promise.resolve();},
    update:o=>{logOp("update",path,o);for(const k in o){setv(path+"/"+k,o[k]);}return Promise.resolve();},
    remove:()=>{logOp("set",path,null);setv(path,null);return Promise.resolve();},
    push:v=>{const k="k"+(++pushN).toString().padStart(6,"0");const r=ref(path+"/"+k);if(v!==undefined){logOp("set",path+"/"+k,v);setv(path+"/"+k,v);}r.key=k;return r;},
    on:(ev,cb)=>{const l={p:path,ev,cb,seen:new Set()};ls.push(l);
      if(ev==="value"){ if(path===".info/serverTimeOffset")setTimeout(()=>cb({val:()=>0}),0); else if(path===".info/connected"){conn.push(cb);setTimeout(()=>cb({val:()=>true}),0);} else setTimeout(()=>cb(snap(path)),0);}
      else if(ev==="child_added"){const v=get(path);if(v)for(const k in v){l.seen.add(k);setTimeout(()=>cb(snap(path+"/"+k)),0);}}
      return cb;},
    off:()=>{}, limitToLast:()=>ref(path), once:()=>Promise.resolve(snap(path)),
    onDisconnect:()=>({remove:()=>Promise.resolve(),set:()=>Promise.resolve(),cancel:()=>Promise.resolve()}),
    transaction:(fn,done)=>{const cur=get(path);const nv=fn(clone(cur));if(nv!==undefined){logOp("set",path,nv);setv(path,nv);}if(done)setTimeout(()=>done(null,nv!==undefined,snap(path)),0);return Promise.resolve();}
  };}
  bc.onmessage=e=>{const m=e.data;
    if(m.t==='set')setv(m.p,m.v,true);
    else if(m.t==='hello'&&Object.keys(root).length)bc.postMessage({t:'init',root:clone(root)});
    else if(m.t==='init'){(function w(o,pre){for(const k in o){const pp=pre+"/"+k;if(o[k]&&typeof o[k]==="object")w(o[k],pp);else setv(pp,o[k],true);}})(m.root,"");}};
  bc.postMessage({t:'hello'});
  window.__fbroot=root;
  /* ---- Autenticação falsa: contas ficam em localStorage (compartilhadas entre as abas do teste), a sessão em sessionStorage ---- */
  const accts=()=>{try{return JSON.parse(localStorage.__accts||"{}");}catch(e){return {};}}; const saveAccts=o=>{localStorage.__accts=JSON.stringify(o);};
  const aul=[]; const rid=()=> "u"+Math.random().toString(36).slice(2,8)+Math.random().toString(36).slice(2,6);
  const mkUser=o=>{ const u={uid:o.uid,isAnonymous:!!o.anon,email:o.email||null,emailVerified:!!o.verified,displayName:o.name||null,providerData:o.anon?[]:[{providerId:o.provider}],
    sendEmailVerification:()=>{window.__mailSent=(window.__mailSent||0)+1;return Promise.resolve();},
    reload:()=>{ if(cur&&cur.email){const a=accts()[cur.email]; if(a)cur.verified=!!a.verified; u.emailVerified=!!cur.verified; sessionStorage[AUK]=JSON.stringify(cur); } return Promise.resolve(); },
    getIdToken:()=>Promise.resolve("tok")}; return u; };
  const setCur=o=>{cur=o; sessionStorage[AUK]=JSON.stringify(o); if(o)sessionStorage.__u=o.uid; const u=o?mkUser(o):null; aul.forEach(f=>setTimeout(()=>f(u),0)); return u;};
  const err=(code)=>Promise.reject(Object.assign(new Error("Firebase: "+code),{code}));
  window.__fbVerify=()=>{ if(!cur||!cur.email)return; const a=accts(); a[cur.email].verified=true; saveAccts(a); };       // o "clique no link do e-mail"
  const authObj={
    get currentUser(){return cur?mkUser(cur):null;},
    onAuthStateChanged:f=>{aul.push(f); setTimeout(()=>f(cur?mkUser(cur):null),0); return ()=>{};},
    signInAnonymously:()=>{ if(cur)return Promise.resolve({user:mkUser(cur)}); return Promise.resolve({user:setCur({uid:sessionStorage.__u||rid(),anon:true})}); },
    createUserWithEmailAndPassword:(m,pw)=>{ const a=accts(); if(a[m])return err("auth/email-already-in-use"); if(pw.length<6)return err("auth/weak-password"); a[m]={uid:rid(),pass:pw,verified:false}; saveAccts(a); return Promise.resolve({user:setCur({uid:a[m].uid,email:m,provider:"password",verified:false})}); },
    signInWithEmailAndPassword:(m,pw)=>{ const a=accts()[m]; if(!a||a.pass!==pw)return err("auth/invalid-credential"); return Promise.resolve({user:setCur({uid:a.uid,email:m,provider:"password",verified:!!a.verified})}); },
    signInWithPopup:()=>{ const m=window.__googleMail||"google@teste.com", a=accts(); if(!a[m]){a[m]={uid:rid(),verified:true,google:true};saveAccts(a);} return Promise.resolve({user:setCur({uid:a[m].uid,email:m,name:"Gabi Google",provider:"google.com",verified:true})}); },
    signInWithRedirect:()=>Promise.resolve(), sendPasswordResetEmail:()=>Promise.resolve(),
    signOut:()=>{ setCur(null); sessionStorage.removeItem("__u"); return Promise.resolve(); }
  };
  const authFn=()=>authObj; authFn.GoogleAuthProvider=function(){};
  window.firebase={initializeApp:()=>({}),auth:authFn,
    database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:{".sv":"timestamp"}}})};
})();
