(function(){
  const root={}; const ls=[]; let pushN=0;
  const split=p=>p.split("/").filter(Boolean);
  const get=(p)=>{let n=root;for(const k of split(p)){if(n==null||typeof n!=="object")return null;n=n[k];}return n===undefined?null:n;};
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  const bc=new BroadcastChannel("fbstub"); const opsBc=new BroadcastChannel("fbops"); const logOp=(op,p,v)=>{try{opsBc.postMessage({t:Date.now(),u:sessionStorage.__u||null,op,p,v:v===undefined?null:JSON.parse(JSON.stringify(v))});}catch(e){}}; const conn=[]; window.__fbNet=on=>conn.forEach(c=>c({val:()=>on})); window.__fbSet=(p,v)=>setv(p,v);
  function setv(p,v,remote){const ks=split(p);if(!ks.length)return;let n=root;for(let i=0;i<ks.length-1;i++){if(n[ks[i]]==null||typeof n[ks[i]]!=="object")n[ks[i]]={};n=n[ks[i]];}
    const last=ks[ks.length-1]; if(v==null)delete n[last]; else n[last]=clone(v); prune(); fire(p); if(!remote)bc.postMessage({t:'set',p,v:v==null?null:clone(v)});}
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
    onDisconnect:()=>({remove:()=>Promise.resolve(),set:()=>Promise.resolve()}),
    transaction:(fn,done)=>{const cur=get(path);const nv=fn(clone(cur));if(nv!==undefined){logOp("set",path,nv);setv(path,nv);}if(done)setTimeout(()=>done(null,nv!==undefined,snap(path)),0);return Promise.resolve();}
  };}
  bc.onmessage=e=>{const m=e.data;
    if(m.t==='set')setv(m.p,m.v,true);
    else if(m.t==='hello'&&Object.keys(root).length)bc.postMessage({t:'init',root:clone(root)});
    else if(m.t==='init'){(function w(o,pre){for(const k in o){const pp=pre+"/"+k;if(o[k]&&typeof o[k]==="object")w(o[k],pp);else setv(pp,o[k],true);}})(m.root,"");}};
  bc.postMessage({t:'hello'});
  window.__fbroot=root;
  window.firebase={initializeApp:()=>({}),auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid:(sessionStorage.__u||(sessionStorage.__u="u"+Math.random().toString(36).slice(2,8)))}}),onAuthStateChanged:cb=>setTimeout(()=>cb({uid:"u_test"}),0)}),
    database:Object.assign(()=>({ref}),{ServerValue:{TIMESTAMP:{".sv":"timestamp"}}})};
})();
