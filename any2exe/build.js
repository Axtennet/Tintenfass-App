'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const C=JSON.parse(fs.readFileSync('any2exe.json','utf8')),P='project',OUT=path.resolve('out');
const N=(C.name||'App').replace(/[^\w.\- ]+/g,'').trim()||'App';
fs.mkdirSync(OUT,{recursive:true});
const L=m=>console.log('\n[Any2EXE] '+m);
const q=a=>/[\s"&|<>^;]/.test(a)?'"'+a.replace(/"/g,'\\"')+'"':a;
function run(c,a,o){L('> '+c+' '+a.join(' '));const r=cp.spawnSync([c].concat(a.map(q)).join(' '),Object.assign({stdio:'inherit',shell:true},o));if(r.status!==0)throw new Error(c+' fehlgeschlagen (Code '+r.status+')')}
function cap(c,a){const r=cp.spawnSync([c].concat(a.map(q)).join(' '),{encoding:'utf8',shell:true});return r.status===0?(r.stdout||'').split(/\r?\n/)[0].trim():null}
const SK=/^(\.git|node_modules|__MACOSX)$/;
function walk(d,r,o){r=r||'';o=o||[];for(const e of fs.readdirSync(path.join(d,r),{withFileTypes:true})){const x=r?r+'/'+e.name:e.name;if(e.isDirectory()){if(!SK.test(e.name))walk(d,x,o)}else o.push(x)}return o}
function root(re){const qu=[P];while(qu.length){const d=qu.shift(),it=fs.readdirSync(d,{withFileTypes:true});if(it.some(i=>i.isFile()&&re.test(i.name)))return d;it.forEach(i=>{if(i.isDirectory()&&!SK.test(i.name)&&!i.name.startsWith('.'))qu.push(path.join(d,i.name))})}throw new Error('Keine passenden Projektdateien gefunden.')}
const rd=(R,f)=>fs.readFileSync(path.join(R,f),'utf8');
function place(dir){const e=fs.readdirSync(dir).filter(f=>/\.exe$/i.test(f)).map(f=>[f,fs.statSync(path.join(dir,f)).size]).sort((a,b)=>b[1]-a[1])[0];if(!e)throw new Error('Keine .exe im Build-Ergebnis.');fs.copyFileSync(path.join(dir,e[0]),path.join(OUT,N+'.exe'))}

const LIBS=[[/winhttp\.h/i,['winhttp']],[/winsock2?\.h|ws2tcpip\.h/i,['ws2_32']],[/wininet\.h/i,['wininet']],[/iphlpapi\.h/i,['iphlpapi','ws2_32']],[/mmsystem\.h|mmeapi\.h|playsoundapi\.h/i,['winmm']],[/shlwapi\.h/i,['shlwapi']],[/shlobj\.h|shellapi\.h/i,['shell32','ole32','uuid']],[/commdlg\.h/i,['comdlg32']],[/commctrl\.h/i,['comctl32']],[/gdiplus/i,['gdiplus']],[/gl\/gl\.h/i,['opengl32','glu32']],[/dwmapi\.h/i,['dwmapi']],[/bcrypt\.h/i,['bcrypt']],[/wincrypt\.h/i,['crypt32','advapi32']],[/psapi\.h/i,['psapi']],[/uxtheme\.h/i,['uxtheme']],[/objbase\.h|ole2\.h|combaseapi\.h/i,['ole32','oleaut32','uuid']],[/d3d11\.h|dxgi\.h/i,['d3d11','dxgi']]];
function cpp(){
  const SRC=/\.(c|cpp|cc|cxx)$/i,R=root(SRC),F=walk(R),S=F.filter(f=>SRC.test(f)&&!/(^|\/)(tests?|build|out)\//i.test(f));
  const isCpp=S.some(f=>/\.(cpp|cc|cxx)$/i.test(f));let txt='';
  F.filter(f=>/\.(c|cpp|cc|cxx|h|hpp)$/i.test(f)).forEach(f=>{if(txt.length<5e6)txt+=rd(R,f)+'\n'});
  let args=[],comp=isCpp?'g++':'gcc',found=false;
  if(F.some(f=>/^build\.bat$/i.test(f))){
    const t=rd(R,F.find(f=>/^build\.bat$/i.test(f))),v={},ls=t.split(/\r?\n/);
    ls.forEach(l=>{const s=l.match(/^\s*set\s+"?(\w+)=([^"\r\n]*)"?\s*$/i);if(s)v[s[1].toUpperCase()]=s[2]});
    for(const l of ls){const m=l.match(/^\s*(g\+\+|gcc|clang\+\+|clang|c\+\+|cc)(?:\.exe)?\s+(.+)$/i);if(!m)continue;
      const ex=m[2].replace(/%~dp0/gi,'./').replace(/%(\w+)%/g,(_,k)=>v[k.toUpperCase()]||''),tk=[];
      ex.replace(/"([^"]*)"|(\S+)/g,(_,a,b)=>tk.push(a!==undefined?a:b));
      for(let i=0;i<tk.length;i++){if(tk[i]==='-o'){i++;continue}args.push(tk[i])}
      comp=/\+\+/.test(m[1])||/^c\+\+$/i.test(m[1])?'g++':'gcc';found=true;L('Einstellungen aus build.bat übernommen.');break}}
  if(!found){
    const win=(/\bw?WinMain\b/.test(txt)&&C.gui!=='console')||C.gui==='window';
    args=[isCpp?'-std=c++17':'-std=c11','-Os','-s','-static','-ffunction-sections','-fdata-sections','-Wl,--gc-sections'];
    if(win)args.push('-mwindows');if(/\b(wWinMain|wmain)\b/.test(txt))args.push('-municode');
    new Set(['.'].concat(F.filter(f=>/\.(h|hpp)$/i.test(f)).map(f=>path.posix.dirname(f)))).forEach(d=>args.push('-I'+d));
    S.forEach(f=>isCpp&&/\.c$/i.test(f)?args.push('-x','c',f,'-x','none'):args.push(f));
    const libs=new Set(/windows\.h/i.test(txt)?['user32','gdi32','kernel32','advapi32','shell32','comdlg32']:[]);
    LIBS.forEach(x=>{if(x[0].test(txt))x[1].forEach(l=>libs.add(l))});libs.forEach(l=>args.push('-l'+l));
    L('Automatisch erkannt: '+S.length+' Quelldatei(en), '+(isCpp?'C++':'C')+', '+(win?'Fenster':'Konsole'))}
  run(comp,args.concat(['-o',path.join(OUT,N+'.exe')]),{cwd:R});
}
function cs(){
  const R=root(/\.(csproj|cs)$/i),F=walk(R);let pr=F.find(f=>/\.csproj$/i.test(f));
  if(!pr){const t=F.filter(f=>/\.cs$/i.test(f)).map(f=>rd(R,f)).join('\n'),wf=/System\.Windows\.Forms/.test(t);pr='Any2EXE.csproj';
    fs.writeFileSync(path.join(R,pr),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>'+(wf||C.gui==='window'?'WinExe':'Exe')+'</OutputType><TargetFramework>net8.0'+(wf?'-windows':'')+'</TargetFramework>'+(wf?'<UseWindowsForms>true</UseWindowsForms>':'')+'<ImplicitUsings>disable</ImplicitUsings><Nullable>disable</Nullable></PropertyGroup></Project>')}
  const pub=path.join(OUT,'pub');
  run('dotnet',['publish',pr,'-c','Release','-r','win-x64','--self-contained','true','-p:PublishSingleFile=true','-p:IncludeNativeLibrariesForSelfExtract=true','-p:EnableCompressionInSingleFile=true','-o',pub],{cwd:R});
  place(pub);fs.rmSync(pub,{recursive:true,force:true});
}
function py(){
  const R=root(/\.py$/i),F=walk(R),PY=f=>/\.py$/.test(f);
  const e=(C.entry&&F.includes(C.entry)&&C.entry)||['main.py','app.py','__main__.py','run.py'].find(x=>F.includes(x))||F.filter(f=>PY(f)&&!f.includes('/')).find(f=>/__name__\s*==/.test(rd(R,f)))||F.find(PY);
  const t=F.filter(PY).map(f=>rd(R,f)).join('\n');
  const gui=C.gui==='window'||(C.gui!=='console'&&/^\s*(import|from)\s+(tkinter|PyQt[56]|PySide[26]|wx|pygame|kivy|customtkinter|turtle)\b/m.test(t));
  run('python',['-m','pip','install','--upgrade','pip','pyinstaller']);
  if(fs.existsSync(path.join(R,'requirements.txt')))run('python',['-m','pip','install','-r','requirements.txt'],{cwd:R});
  const a=['-m','PyInstaller','--onefile','--noconfirm','--clean','--name',N,'--distpath',OUT,'--workpath',path.resolve('pyi'),'--specpath',path.resolve('pyi')];
  if(gui)a.push('--noconsole');
  fs.readdirSync(R,{withFileTypes:true}).forEach(d=>{if(d.isDirectory()&&!/^(\.|__pycache__|venv|env|build|dist)/.test(d.name))a.push('--add-data',path.resolve(R,d.name)+';'+d.name)});
  a.push(path.resolve(R,e));L('Startdatei: '+e+(gui?' (Fenster)':' (Konsole)'));run('python',a,{cwd:R});
}
function nd(){
  const R=root(/^package\.json$|\.m?js$/i);let pk={};try{pk=JSON.parse(rd(R,'package.json'))}catch(e){}
  if(pk.dependencies)run('npm',['install','--no-audit','--no-fund'],{cwd:R});
  const F=walk(R),e=C.entry||(typeof pk.bin==='string'?pk.bin:pk.bin&&Object.values(pk.bin)[0])||pk.main||['index.js','main.js','app.js','server.js'].find(x=>F.includes(x))||F.find(f=>/\.m?js$/.test(f));
  L('Startdatei: '+e);run('npx',['--yes','@yao-pkg/pkg@6',e,'--targets','node20-win-x64','--output',path.join(OUT,N+'.exe')],{cwd:R});
}
function jv(){
  const R=root(/\.(java|jar)$/i),F=walk(R),S=F.filter(f=>/\.java$/.test(f)),J=F.filter(f=>/\.jar$/i.test(f)),st='stage',ap=st+'/app',sz=f=>fs.statSync(path.join(R,f)).size;
  fs.mkdirSync(ap+'/lib',{recursive:true});let mc=C.main;
  if(S.length){
    fs.mkdirSync('cls',{recursive:true});fs.writeFileSync('src.txt',S.map(f=>'"'+path.resolve(R,f).replace(/\\/g,'/')+'"').join('\n'));
    J.forEach(j=>fs.copyFileSync(path.join(R,j),ap+'/lib/'+path.basename(j)));
    run('javac',['-encoding','UTF-8','-d','cls'].concat(J.length?['-cp',path.resolve(ap,'lib')+'/*']:[],['@src.txt']));
    F.filter(f=>!/\.(java|jar|class|bat|md|txt)$/i.test(f)).forEach(f=>{fs.mkdirSync(path.dirname('cls/'+f),{recursive:true});fs.copyFileSync(path.join(R,f),'cls/'+f)});
    if(!mc)for(const f of S){const t=rd(R,f);if(/static\s+void\s+main\s*\(/.test(t)){const p=t.match(/^\s*package\s+([\w.]+)\s*;/m);mc=(p?p[1]+'.':'')+path.basename(f,'.java');break}}
    if(!mc)throw new Error('Keine main-Methode gefunden – Hauptklasse angeben.');
    run('jar',['--create','--file',ap+'/app.jar','-C','cls','.']);
  }else if(J.length){J.sort((a,b)=>sz(b)-sz(a));fs.copyFileSync(path.join(R,J[0]),ap+'/app.jar');J.slice(1).forEach(j=>fs.copyFileSync(path.join(R,j),ap+'/lib/'+path.basename(j)))}
  else throw new Error('Weder .java noch .jar gefunden.');
  const mods=cap('jdeps',['--multi-release','base','--ignore-missing-deps','--print-module-deps','--class-path',ap+'/lib/*',ap+'/app.jar'])||'java.se';
  L('Module: '+mods);
  run('jlink',['--add-modules',mods+',jdk.unsupported','--strip-debug','--no-header-files','--no-man-pages','--compress=zip-6','--output',st+'/runtime']);
  const win=C.gui==='window'||(C.gui!=='console'&&/java\.desktop|javafx/.test(mods));
  fs.writeFileSync(st+'/launch.txt','runtime\\bin\\'+(win?'javaw':'java')+'.exe|'+(S.length?'-cp "%D%\\app\\app.jar;%D%\\app\\lib\\*" '+mc:'-jar "%D%\\app\\app.jar"')+'\n');
  run('jar',['--create','--file','payload.zip','--no-manifest','-C',st,'.']);
  run('gcc',['-O2','-s','-static'].concat(win?['-mwindows']:[],['.any2exe/launcher.c','-o','launcher.exe']));
  const pl=fs.readFileSync('payload.zip'),tr=Buffer.alloc(24);
  tr.write('A2EPAYLD',0,'latin1');tr.writeBigUInt64LE(BigInt(pl.length),8);tr.write(require('crypto').randomBytes(4).toString('hex'),16,'latin1');
  fs.writeFileSync(path.join(OUT,N+'.exe'),Buffer.concat([fs.readFileSync('launcher.exe'),pl,tr]));
}
const MAIN=`const {app,BrowserWindow,protocol,net,shell,Menu}=require("electron");
const path=require("path"),fs=require("fs"),{pathToFileURL}=require("url");
const cfg=require("./config.json");
protocol.registerSchemesAsPrivileged([{scheme:"app",privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
if(cfg.single&&!app.requestSingleInstanceLock())app.quit();
function create(){
 const ic=path.join(__dirname,"..","build","icon.png");
 const w=new BrowserWindow({width:cfg.width,height:cfg.height,fullscreen:cfg.fullscreen,frame:!cfg.frameless,title:cfg.title,autoHideMenuBar:true,icon:fs.existsSync(ic)?ic:undefined,webPreferences:{contextIsolation:true,sandbox:true}});
 w.webContents.setWindowOpenHandler(({url})=>{let same=url.startsWith("app://");try{if(cfg.mode==="url")same=new URL(url).origin===new URL(cfg.url).origin}catch(e){}if(same)return{action:"allow"};shell.openExternal(url);return{action:"deny"}});
 w.webContents.on("before-input-event",(e,i)=>{if(i.type==="keyDown"&&i.key==="F11")w.setFullScreen(!w.isFullScreen())});
 w.loadURL(cfg.mode==="url"?cfg.url:"app://local/index.html");
}
app.whenReady().then(()=>{Menu.setApplicationMenu(null);
 if(cfg.mode==="files"){const root=path.join(__dirname,"..","www");
  protocol.handle("app",req=>{let p=decodeURIComponent(new URL(req.url).pathname);let f=path.normalize(path.join(root,p));
   if(!f.startsWith(root))return new Response("",{status:403});
   if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const i=path.join(f,"index.html");f=fs.existsSync(i)?i:path.join(root,"index.html")}
   return net.fetch(pathToFileURL(f).toString())})}
 create()});
app.on("second-instance",()=>{const w=BrowserWindow.getAllWindows()[0];if(w){if(w.isMinimized())w.restore();w.focus()}});
app.on("window-all-closed",()=>app.quit());
`;
function web(){
  const W='web',files=!C.url,sl=N.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'app',ic=fs.existsSync('.any2exe/icon.png');
  fs.mkdirSync(W+'/src',{recursive:true});
  fs.writeFileSync(W+'/src/config.json',JSON.stringify({mode:files?'files':'url',url:C.url||'',title:N,width:C.width||1280,height:C.height||800,fullscreen:!!C.fullscreen,frameless:!!C.frameless,single:C.single!==false}));
  fs.writeFileSync(W+'/src/main.js',MAIN);
  if(ic){fs.mkdirSync(W+'/build',{recursive:true});fs.copyFileSync('.any2exe/icon.png',W+'/build/icon.png')}
  if(files){if(!fs.existsSync(P))throw new Error('Keine Webseiten-Dateien übergeben.');fs.cpSync(P,W+'/www',{recursive:true})}
  const win={target:['portable'],artifactName:sl+'.exe'};if(ic)win.icon='build/icon.png';
  fs.writeFileSync(W+'/package.json',JSON.stringify({name:sl,version:C.ver||'1.0.0',description:N,main:'src/main.js',author:'Any2EXE',devDependencies:{electron:'^33.0.0','electron-builder':'^25.1.8'},build:{appId:'com.any2exe.'+sl.replace(/-/g,''),productName:N,directories:{output:'dist'},files:['src/**','build/**','www/**'],win}},null,2));
  run('npm',['install','--no-audit','--no-fund'],{cwd:W});
  run('npx',['electron-builder','--win','portable','--publish','never'],{cwd:W});
  place(W+'/dist');
}
try{({web:web,cpp:cpp,csharp:cs,python:py,node:nd,java:jv})[C.type]();
  const o=fs.readdirSync(OUT).filter(f=>/\.exe$/i.test(f));if(!o.length)throw new Error('Keine .exe erzeugt.');
  o.forEach(f=>L('Fertig: '+f+' ('+(fs.statSync(path.join(OUT,f)).size/1048576).toFixed(1)+' MB)'));
}catch(e){console.error('\n[Any2EXE] FEHLER: '+e.message);process.exit(1)}
