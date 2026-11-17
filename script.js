"use strict";
/* =========================================================================
   Editor de Diagramas — base de modelagem visual
   Tela inicial com a lista de diagramas → "novo diagrama" → editor manual
   com ferramentas de blocos (bonequinhos, caixas, etc.) e setas de conexão.
   Nada é gerado automaticamente: o usuário monta e edita o diagrama.
   ========================================================================= */

const CHAVE_SAVE="editor-diagramas-v1";
const CHAVE_TEMA="editor-diagramas-tema";

/* ---------- Estado central ---------- */
const estado={
  diagramas:[],           // lista de diagramas
  diagramaAtualId:null,   // id do diagrama aberto no editor
  ferramenta:"selecionar", // "selecionar" | "conectar"
  tipoConexao:"associacao",
  selecionados:new Set(),
  setaSelecionada:null,
  origemConexao:null,
  zoom:1,
  _idSeq:1
};

/* ---------- Configuração dos tipos de diagrama ---------- */
const TIPOS={
  casos:{
    nome:"Diagrama de Casos de Uso",
    titulo:"Blocos de caso de uso",
    conexoes:["associacao","include","extend","geralizacao"],
    paleta:[
      {id:"ator",     label:"Ator (bonequinho)",             forma:"ator"},
      {id:"uc",       label:"Caixa de ação (caso de uso)",   forma:"elipse"},
      {id:"caixa",    label:"Caixa",                         forma:"retângulo"},
      {id:"sistema",  label:"Limite do Sistema",              forma:"limite"},
      {id:"nota",     label:"Nota",                          forma:"nota"}
    ]
  },
  atividades:{
    nome:"Diagrama de Atividades",
    titulo:"Blocos de atividade",
    conexoes:["associacao"],
    paleta:[
      {id:"inicio",   label:"Início",      forma:"oval"},
      {id:"acao",     label:"Ação",        forma:"retângulo"},
      {id:"decisao",  label:"Decisão",     forma:"losango"},
      {id:"barra",    label:"Fork / Join", forma:"barra"},
      {id:"alvo",     label:"Fim",         forma:"alvo"}
    ]
  },
  roteiro:{
    nome:"Diagrama de Roteiro",
    titulo:"Blocos do roteiro",
    conexoes:["associacao"],
    paleta:[
      {id:"inicio",   label:"Início",        forma:"oval"},
      {id:"tela",     label:"Tela",          forma:"retângulo"},
      {id:"etapa",    label:"Etapa / Ação",  forma:"retângulo-vaz"},
      {id:"decisao",  label:"Decisão",       forma:"losango"},
      {id:"fim",      label:"Fim",           forma:"alvo"}
    ]
  }
};
const RÓTULO_CONEXAO={
  associacao:"Associação (seta)",
  include:"<<include>>",
  extend:"<<extend>>",
  geralizacao:"Generalização (linha vazada)"
};

/* ---------- Blocos / formas ---------- */
function formaSVG(tipo,h,w){
  const k="var(--panel)", b="var(--borda-2)", p="var(--primario)",
        p2="var(--primario-2)", t2="var(--texto-2)";
  switch(tipo){
    case "oval":
      return `<circle class="forma-pre" cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/2-2}" fill="${p}"/>
              <text class="no-texto" x="${w/2}" y="${h/2+5}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">Início</text>`;
    case "alvo":
      return `<circle class="forma-pre" cx="${w/2}" cy="${h/2}" r="${Math.max(w,h)/2-3}" fill="${p}"/>
              <circle class="forma-pre" cx="${w/2}" cy="${h/2}" r="${Math.max(w,h)/2-11}" fill="${k}" stroke="${p}" stroke-width="3"/>
              <text class="no-texto" x="${w/2}" y="${h+18}" text-anchor="middle" font-size="12" font-weight="700">Fim</text>`;
    case "barra":
      return `<rect class="forma-pre" x="2" y="4" width="${w-4}" height="${Math.min(18,h-8)}" rx="4" fill="${p}" stroke="${p2}" stroke-width="2"/>
              <text class="no-texto" x="${w/2}" y="${h+18}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${t2}">fork / join</text>`;
    case "decisao":
      return `<path class="forma-pre" d="M ${w/2},3 L ${w-3},${h/2} L ${w/2},${h-3} L 3,${h/2} Z"
                    fill="${k}" stroke="${p2}" stroke-width="2.2"/>`;
    case "retângulo":
      return `<rect class="forma-pre" x="2" y="2" width="${w-4}" height="${h-4}" rx="8" fill="${k}" stroke="${p2}" stroke-width="2"/>`;
    case "retângulo-vaz":
      return `<rect class="forma-pre" x="2" y="2" width="${w-4}" height="${h-4}" rx="8"
                    fill="${k}" stroke="${p2}" stroke-width="2" stroke-dasharray="7 5"/>`;
    case "elipse":
      return `<ellipse class="forma-pre" cx="${w/2}" cy="${h/2}" rx="${w/2-4}" ry="${h/2-4}"
                    fill="${k}" stroke="${p2}" stroke-width="2"/>`;
    case "ator":
      // figura humana (bonequinho) desenhada de forma proporcional
      const cx=w/2;
      const headR=Math.min(15,(h-40)/4);      // raio da cabeça
      const headY=headR+9;                   // centro da cabeça
      const bodyTop=headY+headR+1;           // topo do corpo
      const bodyBot=h-32;                    // base do corpo / topo das pernas
      const armY=bodyTop+(bodyBot-bodyTop)*0.45; // altura dos braços
      const armDx=Math.min(26,w/2-10);       // distância horizontal dos braços
      const legBot=h-4;                      // base das pernas
      return `<circle class="forma-pre" cx="${cx}" cy="${headY}" r="${headR}" fill="none" stroke="${t2}" stroke-width="2.6"/>
              <line class="forma-pre" x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${bodyBot}" stroke="${t2}" stroke-width="2.6"/>
              <line class="forma-pre" x1="${cx-armDx}" y1="${armY}" x2="${cx+armDx}" y2="${armY}" stroke="${t2}" stroke-width="2.6"/>
              <line class="forma-pre" x1="${cx}" y1="${bodyBot}" x2="${cx-15}" y2="${legBot}" stroke="${t2}" stroke-width="2.6"/>
              <line class="forma-pre" x1="${cx}" y1="${bodyBot}" x2="${cx+15}" y2="${legBot}" stroke="${t2}" stroke-width="2.6"/>`;
    case "limite":
      return `<rect class="forma-pre" x="2" y="2" width="${w-4}" height="${h-4}" rx="4"
                    fill="${k}" stroke="${t2}" stroke-width="2" stroke-dasharray="8 6" opacity=".85"/>`;
    case "nota":
      return `<path class="forma-pre" d="M2,4 h${w-18} l14,8 v${h-16} h-${w-4} v-${h-8} z"
                    fill="${k}" stroke="${t2}" stroke-width="1.8" stroke-linejoin="round"/>`;
    default:
      return `<rect class="forma-pre" x="2" y="2" width="${w-4}" height="${h-4}" rx="8" fill="${k}" stroke="${b}" stroke-width="2"/>`;
  }
}
function dimsPadrao(tipo){
  switch(tipo){
    case "inicio":   return {w:110,h:66};
    case "alvo":     return {w:88,h:88};
    case "barra":    return {w:140,h:34};
    case "decisao":  return {w:170,h:110};
    case "retângulo":return {w:180,h:60};
    case "elipse":   return {w:170,h:80};
    case "ator":     return {w:96,h:130};
    case "limite":   return {w:620,h:380};
    case "nota":     return {w:140,h:96};
    default:         return {w:180,h:60};
  }
}

/* ---------- Utilitários ---------- */
function novoId(){ return "N"+(estado._idSeq++).toString(36)+Math.random().toString(36).slice(2,5); }
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/\n/g,"<tspan x='0' dy='15'>");
}
function toast(msg,tipo){
  const el=document.getElementById("toast");
  el.textContent=msg; el.className="toast show "+(tipo||"");
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>el.className="toast "+(tipo||""),2600);
}
function diagramaAtual(){ return estado.diagramas.find(d=>d.id===estado.diagramaAtualId); }

/* ---------- Persistência ---------- */
function salvarLocal(){
  try{ localStorage.setItem(CHAVE_SAVE,JSON.stringify(estado.diagramas)); }catch(e){}
}
function carregarLocal(){
  try{
    const dados=localStorage.getItem(CHAVE_SAVE);
    if(dados){
      const obj=JSON.parse(dados);
      if(Array.isArray(obj)) estado.diagramas=obj;
    }
  }catch(e){}
}
function temaAplicar(tema){
  document.documentElement.setAttribute("data-theme",tema);
  try{ localStorage.setItem(CHAVE_TEMA,tema); }catch(e){}
}
function temaInicial(){
  try{ const t=localStorage.getItem(CHAVE_TEMA); if(t) return t; }catch(e){}
  return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
}

/* ---------- Modal: novo diagrama ---------- */
function modalAberto(){ document.getElementById("modalFundo").classList.add("aberto"); }
function modalFechar(){ document.getElementById("modalFundo").classList.remove("aberto"); }
document.getElementById("modalFechar").addEventListener("click",modalFechar);
document.getElementById("modalCancelar").addEventListener("click",modalFechar);
document.getElementById("modalFundo").addEventListener("click",e=>{ if(e.target.id==="modalFundo") modalFechar(); });
document.getElementById("btnNovoDiagrama").addEventListener("click",()=>{
  document.getElementById("modalTitulo").textContent="Novo diagrama";
  document.getElementById("modalNome").value="";
  document.getElementById("modalTipo").value="casos";
  modalAberto(); setTimeout(()=>document.getElementById("modalNome").focus(),60);
});
document.getElementById("modalConfirmar").addEventListener("click",()=>{
  const nome=document.getElementById("modalNome").value.trim();
  const tipo=document.getElementById("modalTipo").value;
  if(!nome){ toast("Digite um nome para o diagrama.","erro"); return; }
  const diagrama={
    id:novoId("D"),
    nome,
    tipo,
    data:new Date().toLocaleDateString("pt-BR"),
    no:[],
    seta:[]
  };
  estado.diagramas.push(diagrama);
  salvarLocal();
  modalFechar();
  abrirDiagrama(diagrama.id);
  toast("Diagrama criado — monte seus blocos","sucesso");
});
document.getElementById("modalNome").addEventListener("keydown",e=>{
  if(e.key==="Enter"){ e.preventDefault(); document.getElementById("modalConfirmar").click(); }
});

/* =========================================================================
   Tela inicial: lista de diagramas
   ========================================================================= */
function renderInicio(){
  const cont=document.getElementById("listaDiagramas");
  cont.innerHTML="";
  document.getElementById("vazioDiagramas").style.display=estado.diagramas.length?"none":"block";
  for(const d of estado.diagramas){
    const cfg=TIPOS[d.tipo]||{nome:d.tipo};
    const card=document.createElement("div");
    card.className="card-diag";
    card.innerHTML=`
      <div class="cabeca">
        <h3>${esc(d.nome)}</h3>
        <span class="pill">${esc(cfg.nome)}</span>
      </div>
      <p class="meta">${d.no.length} bloco(s) · ${d.seta.length} conexão(ões) · ${esc(d.data||"—")}</p>
      <div class="acoes">
        <button class="btn btn-primario" type="button" data-acao="abrir">Abrir</button>
        <button class="btn btn-perigo" type="button" data-acao="excluir">Excluir</button>
      </div>`;
    card.querySelector("[data-acao=abrir]").addEventListener("click",()=>abrirDiagrama(d.id));
    card.querySelector("[data-acao=excluir]").addEventListener("click",()=>excluirDiagrama(d.id));
    cont.appendChild(card);
  }
}
function excluirDiagrama(id){
  const d=estado.diagramas.find(x=>x.id===id);
  if(!d) return;
  if(!confirm(`Excluir o diagrama "${d.nome}" e todo o seu conteúdo?`)) return;
  estado.diagramas=estado.diagramas.filter(x=>x.id!==id);
  if(estado.diagramaAtualId===id) estado.diagramaAtualId=null;
  salvarLocal(); renderInicio();
  toast("Diagrama excluído","sucesso");
}
function abrirDiagrama(id){
  const d=estado.diagramas.find(x=>x.id===id);
  if(!d) return;
  estado.diagramaAtualId=id;
  estado.selecionados.clear(); estado.setaSelecionada=null; estado.origemConexao=null;
  estado.zoom=1;
  estado.tipoConexao=(TIPOS[d.tipo]?.conexoes||["associacao"])[0];
  document.getElementById("tituloDiagrama").value=d.nome;
  document.getElementById("telaInicio").classList.remove("ativa");
  document.getElementById("telaEditor").classList.add("ativa");
  renderPaleta(); renderConexoes(); render();
  aplicarZoomVisual();
}
function voltarInicio(){
  estado.diagramaAtualId=null;
  estado.selecionados.clear(); estado.setaSelecionada=null; estado.origemConexao=null;
  document.getElementById("telaEditor").classList.remove("ativa");
  document.getElementById("telaInicio").classList.add("ativa");
  renderInicio();
}
document.getElementById("btnVoltar").addEventListener("click",voltarInicio);

/* =========================================================================
   Paleta
   ========================================================================= */
function renderPaleta(){
  const d=diagramaAtual(); if(!d) return;
  const cfg=TIPOS[d.tipo];
  document.getElementById("paletaTitulo").textContent=cfg.titulo;
  const lista=document.getElementById("paletaLista");
  lista.innerHTML="";
  for(const it of cfg.paleta){
    const div=document.createElement("div");
    div.className="item-bloco";
    div.draggable=false;
    const {w,h}=dimsPadrao(it.id);
    div.innerHTML=`<svg width="44" height="36" viewBox="0 0 ${Math.max(w,110)} ${Math.max(h,66)}">${formaSVG(it.id,Math.max(h,66),Math.max(w,110))}</svg><span class="label">${it.label}</span>`;
    div.addEventListener("click",()=>adicionarBloco(it.id));
    div.addEventListener("pointerdown",e=>{
      if(e.button!==0&&e.pointerType==="mouse") return;
      const tipo=it.id;
      const ghost=document.createElement("div");
      ghost.textContent=it.label;
      ghost.style.cssText="position:fixed;z-index:300;background:var(--panel);border:1px solid var(--primario);border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;box-shadow:var(--sombra-lg);pointer-events:none;transform:translate(-50%,-50%)";
      ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px";
      document.body.appendChild(ghost);
      const mover=ev=>{ ghost.style.left=ev.clientX+"px";ghost.style.top=ev.clientY+"px"; };
      const fim=ev=>{
        document.body.removeChild(ghost);
        document.removeEventListener("pointermove",mover);
        document.removeEventListener("pointerup",fim);
        if(document.getElementById("canvasWrap").contains(document.elementFromPoint(ev.clientX,ev.clientY))){
          const p=posMundo(ev.clientX,ev.clientY);
          adicionarBloco(tipo,p.x,p.y);
        }
      };
      document.addEventListener("pointermove",mover);
      document.addEventListener("pointerup",fim);
    });
    lista.appendChild(div);
  }
}
function renderConexoes(){
  const d=diagramaAtual(); if(!d) return;
  const grupo=document.getElementById("grupoConexoes");
  grupo.innerHTML="";
  for(const tipo of TIPOS[d.tipo].conexoes){
    const b=document.createElement("button");
    b.type="button";
    b.className="fbtn"+(estado.tipoConexao===tipo?" ativo":"");
    b.textContent=RÓTULO_CONEXAO[tipo];
    b.title=`Conexão: ${RÓTULO_CONEXAO[tipo]}`;
    b.addEventListener("click",()=>{ estado.tipoConexao=tipo; renderConexoes(); });
    grupo.appendChild(b);
  }
}

/* =========================================================================
   Editor: renderização (blocos + setas)
   ========================================================================= */
const svg=document.getElementById("canvas");
const camadaNos=document.getElementById("camadaNos");
const camadaConexoes=document.getElementById("camadaConexoes");

function aplicarZoomVisual(){
  const wrap=document.getElementById("canvasWrap");
  const r=wrap.getBoundingClientRect();
  const w=r.width/estado.zoom, h=r.height/estado.zoom;
  svg.setAttribute("viewBox",`${-w/2} ${-h/2} ${w} ${h}`);
  document.getElementById("zoomContador").textContent=Math.round(estado.zoom*100)+"%";
}
function posMundo(clientX,clientY){
  const pt=svg.createSVGPoint(); pt.setXY(clientX,clientY);
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function ancoras(no){
  const {w,h}=dimsPadrao(no.tipo);
  const cx=no.x+w/2, cy=no.y+h/2;
  // ator (bonequinho): âncoras alinhadas à figura, não às bordas do box
  if(no.tipo==="ator"){
    const headR=Math.min(15,(h-40)/4), headY=headR+9;
    const bodyBot=h-32, armY=bodyTop(no,h)+ (bodyBot-bodyTop(no,h))*0.45, armDx=Math.min(26,w/2-10);
    return {
      topo:{x:cx,y:no.y+headY-headR},       // topo da cabeça
      direita:{x:cx+armDx,y:no.y+armY},     // ponta do braço direito
      inferior:{x:cx,y:no.y+h-4},           // base das pernas
      esquerda:{x:cx-armDx,y:no.y+armY}     // ponta do braço esquerdo
    };
  }
  return {topo:{x:cx,y:no.y},direita:{x:no.x+w,y:cy},inferior:{x:cx,y:no.y+h},esquerda:{x:no.x,y:cy}};
}
function bodyTop(no,h){ const headR=Math.min(15,(h-40)/4); return headR+9+headR+1; }
function parAncoras(a,b){
  const aa=ancoras(a), ba=ancoras(b);
  const cand=[["topo","inferior"],["inferior","topo"],["esquerda","direita"],["direita","esquerda"],
              ["topo","direita"],["direita","topo"],["inferior","esquerda"],["esquerda","inferior"]];
  let melhor=null, menor=Infinity;
  for(const [x,y] of cand){
    const p=aa[x], q=ba[y];
    const d=Math.hypot(p.x-q.x,p.y-q.y);
    if(d<menor){menor=d;melhor={origem:x,destino:y,p1:p,p2:q};}
  }
  return melhor;
}
function caminhoL(p1,p2){
  const dx=p2.x-p1.x, dy=p2.y-p1.y;
  if(Math.abs(dx)<1&&Math.abs(dy)<1) return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  if(Math.abs(dx)>=Math.abs(dy)) return `M ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
  return `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y} L ${p2.x} ${p2.y}`;
}

function render(){
  const d=diagramaAtual(); if(!d) return;
  camadaNos.innerHTML="";
  for(const no of d.no){
    const {w,h}=dimsPadrao(no.tipo);
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("class","no-grp"+(estado.selecionados.has(no.id)?" selecionado":""));
    g.setAttribute("transform",`translate(${no.x},${no.y})`);
    g.setAttribute("data-id",no.id);
    g.innerHTML=formaSVG(no.tipo,w,h);
    let tx=w/2, ty=h/2+5, anchor="middle";
    if(no.tipo==="alvo"||no.tipo==="barra"){tx=w/2;ty=h+18;anchor="middle";}
    else if(no.tipo==="ator"){tx=w/2;ty=h-8;anchor="middle";}
    else if(no.tipo==="limite"){tx=14;ty=26;anchor="start";}
    else if(no.tipo==="nota"){tx=14;ty=30;anchor="start";}
    const texto=document.createElementNS("http://www.w3.org/2000/svg","text");
    texto.setAttribute("class","no-texto");
    texto.setAttribute("x",tx);texto.setAttribute("y",ty);
    texto.setAttribute("text-anchor",anchor);
    if(no.tipo!=="inicio"&&no.tipo!=="alvo"){
      (no.texto||"").split("\n").forEach((ln,i)=>{
        const ts=document.createElementNS("http://www.w3.org/2000/svg","tspan");
        ts.setAttribute("x",tx);ts.setAttribute("dy",i===0?0:15);
        ts.textContent=ln;
        texto.appendChild(ts);
      });
      g.appendChild(texto);
    }
    if(estado.ferramenta==="conectar"||estado.selecionados.has(no.id)){
      const aa=ancoras(no);
      for(const k of ["topo","direita","inferior","esquerda"]){
        const circ=document.createElementNS("http://www.w3.org/2000/svg","circle");
        circ.setAttribute("class","ancora");
        circ.setAttribute("cx",aa[k].x-no.x);
        circ.setAttribute("cy",aa[k].y-no.y);
        circ.setAttribute("r",6);
        g.appendChild(circ);
      }
    }
    g.onclick=ev=>{ ev.stopPropagation(); clickNo(no,ev); };
    g.ondblclick=ev=>{ ev.stopPropagation(); editarTextoNo(no); };
    camadaNos.appendChild(g);
  }
  camadaConexoes.innerHTML="";
  for(const s of d.seta){
    const a=d.no.find(n=>n.id===s.de), b=d.no.find(n=>n.id===s.para);
    if(!a||!b) continue;
    const par=parAncoras(a,b);
    const dPath=caminhoL(par.p1,par.p2);
    const sel=estado.setaSelecionada===s.id;
    const semSeta=s.tipo==="geralizacao";
    const marcaFinal=semSeta?"":(sel?"url(#setaMarkerSel)":"url(#setaMarker)");
    const marca=(s.tipo==="include"||s.tipo==="extend")?`<<${s.tipo}>>`:"";
    const lblX=(par.p1.x+par.p2.x)/2, lblY=(par.p1.y+par.p2.y)/2;
    let html=`<path class="conector ${sel?"selecionado":""}" d="${dPath}" marker-end="${marcaFinal}" ${s.tipo==="geralizacao"?'stroke-dasharray="6 5"':""}/>`;
    if(marca) html+=`<rect x="${lblX-28}" y="${lblY-9}" width="56" height="16" rx="4" fill="var(--panel)" stroke="var(--borda)"/>
                     <text class="conector-marca ${s.tipo}" x="${lblX}" y="${lblY+4}" text-anchor="middle">${marca}</text>`;
    if(s.rotulo&&s.rotulo.trim()){
      html+=`<rect x="${lblX-s.rotulo.length*3.6-6}" y="${lblY-22}" width="${s.rotulo.length*7.2+12}" height="18" rx="6" fill="var(--panel)" stroke="var(--borda)" opacity=".95"/>
             <text class="conector-marca" x="${lblX}" y="${lblY-8}" text-anchor="middle">${esc(s.rotulo)}</text>`;
    }
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("data-seta",s.id);
    g.setAttribute("class",sel?"seta-grp selecionada":"seta-grp");
    g.innerHTML=html;
    g.style.pointerEvents="auto";
    g.onclick=ev=>{ ev.stopPropagation(); clickSeta(s); };
    g.ondblclick=ev=>{ ev.stopPropagation(); editarTextoSeta(s); };
    camadaConexoes.appendChild(g);
  }
  const dica=document.getElementById("dicaCanvas");
  dica.style.display=d.no.length===0?"block":"none";
  const info=document.getElementById("infoSelecionado");
  if(estado.selecionados.size||estado.setaSelecionada){
    info.hidden=false;
    let txt=[];
    if(estado.selecionados.size) txt.push(estado.selecionados.size+" bloco(s) selecionado(s)");
    if(estado.setaSelecionada) txt.push("1 seta selecionada");
    info.textContent=txt.join(" • ")+" — arraste para mover, Excluir para remover";
  }else info.hidden=true;
}

/* ---------- Interação: cliques ---------- */
function clickNo(no,ev){
  if(estado.ferramenta==="conectar"){
    if(!estado.origemConexao){
      estado.origemConexao=no.id; render();
      toast("Bloco origem definido. Clique no bloco de destino para criar a seta.","sucesso");
    }else if(estado.origemConexao===no.id){
      estado.origemConexao=null; render();
    }else{
      adicionarSeta(estado.origemConexao,no.id);
      estado.origemConexao=null;
    }
    return;
  }
  if(ev.shiftKey){
    if(estado.selecionados.has(no.id)) estado.selecionados.delete(no.id);
    else estado.selecionados.add(no.id);
  }else{
    estado.selecionados.clear();
    estado.selecionados.add(no.id);
    estado.setaSelecionada=null;
  }
  render();
}
function clickSeta(s){
  if(estado.ferramenta==="conectar") return;
  estado.selecionados.clear();
  estado.setaSelecionada=estado.setaSelecionada===s.id?null:s.id;
  render();
}
function editarTextoNo(no){
  const atual=no.texto!==undefined?no.texto:(no.tipo==="limite"?"Sistema":"");
  const v=prompt("Edite o texto do bloco:",atual);
  if(v!==null){
    no.texto=v;
    if(no.tipo==="limite"&&v.trim()==="") no.texto="Sistema";
    salvarLocal(); render();
  }
}
function editarTextoSeta(s){
  const v=prompt("Rótulo da conexão (em branco para remover):",s.rotulo||"");
  if(v!==null){ s.rotulo=v; salvarLocal(); render(); }
}
function adicionarSeta(de,para){
  const d=diagramaAtual();
  if(de===para){ toast("Não é possível conectar um bloco a ele mesmo.","erro"); return;}
  if(d.seta.some(s=>s.de===de&&s.para===para)){ toast("Esta conexão já existe.","erro"); return;}
  d.seta.push({id:novoId(),de,para,tipo:estado.tipoConexao,rotulo:""});
  salvarLocal(); render();
  toast("Seta criada ✓","sucesso");
}
function excluirSelecionados(){
  const d=diagramaAtual();
  const nos=[...estado.selecionados].map(id=>d.no.find(n=>n.id===id)).filter(Boolean);
  if(nos.length===0&&!estado.setaSelecionada){ toast("Nada selecionado para excluir.","erro"); return;}
  const msg=nos.length?`Excluir ${nos.length} bloco(s) e todas as conexões ligadas a eles?`:"Excluir a seta selecionada?";
  if(!confirm(msg)) return;
  const ids=new Set(nos.map(n=>n.id));
  d.no=d.no.filter(n=>!ids.has(n.id));
  d.seta=d.seta.filter(s=>!ids.has(s.de)&&!ids.has(s.para)&&s.id!==estado.setaSelecionada);
  estado.selecionados.clear(); estado.setaSelecionada=null;
  salvarLocal(); render();
  toast("Elementos excluídos","sucesso");
}
function adicionarBloco(tipo,x,y){
  const d=diagramaAtual();
  if(x===undefined||y===undefined){
    const wrap=document.getElementById("canvasWrap").getBoundingClientRect();
    x=wrap.width/2-90; y=wrap.height/2-40;
  }
  const dim=dimsPadrao(tipo);
  const no={id:novoId(),tipo,x:Math.round(x-dim.w/2),y:Math.round(y-dim.h/2),texto:tipo==="limite"?"Sistema":""};
  d.no.push(no);
  estado.selecionados.clear(); estado.selecionados.add(no.id);
  estado.setaSelecionada=null;
  render();
  return no;
}

/* ---------- Arrastar blocos e pan ---------- */
svg.addEventListener("pointerdown",ev=>{
  if(ev.target.closest(".no-grp")||ev.target.closest(".seta-grp")||ev.target.classList.contains("ancora")) return;
  if(estado.ferramenta==="selecionar"&&!estado.origemConexao){
    const p0=posMundo(ev.clientX,ev.clientY);
    svg.classList.add("arrastando-bg");
    const mover=e=>{
      const p=posMundo(e.clientX,e.clientY);
      const vb=svg.viewBox.baseVal;
      svg.setAttribute("viewBox",`${vb.x+(p0.x-p.x)} ${vb.y+(p0.y-p.y)} ${vb.width} ${vb.height}`);
    };
    const fim=()=>{ svg.classList.remove("arrastando-bg");
      svg.removeEventListener("pointermove",mover); svg.removeEventListener("pointerup",fim); svg.removeEventListener("pointercancel",fim); };
    svg.addEventListener("pointermove",mover);
    svg.addEventListener("pointerup",fim);
    svg.addEventListener("pointercancel",fim);
  }
});
let arrastagem=null;
svg.addEventListener("pointerdown",ev=>{
  const grp=ev.target.closest(".no-grp");
  if(!grp) return;
  const d=diagramaAtual(); if(!d) return;
  const no=d.no.find(n=>n.id===grp.getAttribute("data-id"));
  if(!no) return;
  if(estado.ferramenta==="conectar") return;
  if(!estado.selecionados.has(no.id)){
    if(!ev.shiftKey){ estado.selecionados.clear(); estado.setaSelecionada=null; }
    estado.selecionados.add(no.id); render();
  }
  const p0=posMundo(ev.clientX,ev.clientY);
  const originais=new Map();
  for(const n of d.no.filter(n=>estado.selecionados.has(n.id))) originais.set(n.id,{x:n.x,y:n.y});
  arrastagem={p0,originais};
  try{ svg.setPointerCapture(ev.pointerId); }catch(e){}
});
svg.addEventListener("pointermove",ev=>{
  if(!arrastagem) return;
  const p=posMundo(ev.clientX,ev.clientY);
  const dx=p.x-arrastagem.p0.x, dy=p.y-arrastagem.p0.y;
  for(const [id,o] of arrastagem.originais){
    const n=diagramaAtual().no.find(x=>x.id===id);
    if(n){ n.x=Math.round(o.x+dx); n.y=Math.round(o.y+dy); }
  }
  render();
});
const fimArrasto=()=>{ if(arrastagem){ arrastagem=null; salvarLocal(); } };
svg.addEventListener("pointerup",fimArrasto);
svg.addEventListener("pointercancel",fimArrasto);
svg.addEventListener("click",ev=>{
  if(ev.target.closest(".no-grp")||ev.target.closest(".seta-grp")) return;
  if(estado.ferramenta==="conectar"&&estado.origemConexao){ estado.origemConexao=null; render(); }
  else{ estado.selecionados.clear(); estado.setaSelecionada=null; render(); }
});

/* ---------- Ferramentas ---------- */
function definirFerramenta(f){
  estado.ferramenta=f;
  estado.origemConexao=null;
  document.getElementById("ferrSelecionar").classList.toggle("ativo",f==="selecionar");
  document.getElementById("ferrConectar").classList.toggle("ativo",f==="conectar");
  svg.classList.toggle("ferramenta-conectar",f==="conectar");
  render();
}
document.getElementById("ferrSelecionar").addEventListener("click",()=>definirFerramenta("selecionar"));
document.getElementById("ferrConectar").addEventListener("click",()=>definirFerramenta("conectar"));
document.getElementById("ferrExcluir").addEventListener("click",excluirSelecionados);
document.getElementById("ferrLimpar").addEventListener("click",()=>{
  const d=diagramaAtual();
  if(d.no.length===0&&d.seta.length===0){ toast("O canvas já está vazio.","erro"); return;}
  if(!confirm(`Remover todos os ${d.no.length} bloco(s) e ${d.seta.length} conexão(ões)?`)) return;
  d.no=[]; d.seta=[]; estado.selecionados.clear(); estado.setaSelecionada=null;
  salvarLocal(); render();
  toast("Canvas limpo","sucesso");
});
document.getElementById("tituloDiagrama").addEventListener("input",e=>{
  const d=diagramaAtual(); if(!d) return;
  d.nome=e.target.value; salvarLocal();
});
document.getElementById("zoomIn").addEventListener("click",()=>{ estado.zoom=Math.min(3,estado.zoom*1.2); aplicarZoomVisual(); });
document.getElementById("zoomOut").addEventListener("click",()=>{ estado.zoom=Math.max(0.3,estado.zoom/1.2); aplicarZoomVisual(); });
document.getElementById("zoomReset").addEventListener("click",()=>{ estado.zoom=1; aplicarZoomVisual(); });
document.getElementById("btnTema").addEventListener("click",()=>{
  const atual=document.documentElement.getAttribute("data-theme");
  temaAplicar(atual==="dark"?"light":"dark");
});

/* =========================================================================
   Exportação SVG/PNG e import/export JSON
   ========================================================================= */
function bboxDoCanvas(){
  const d=diagramaAtual(); if(!d) return {x:0,y:0,w:800,h:600};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const no of d.no){
    const dim=dimsPadrao(no.tipo);
    minX=Math.min(minX,no.x); minY=Math.min(minY,no.y);
    maxX=Math.max(maxX,no.x+dim.w); maxY=Math.max(maxY,no.y+dim.h);
    if(no.tipo==="alvo"||no.tipo==="barra") maxY=Math.max(maxY,no.y+dim.h+26);
  }
  if(!isFinite(minX)){ minX=0;minY=0;maxX=800;maxY=600; }
  const PAD=60;
  return {x:minX-PAD,y:minY-PAD,w:maxX-minX+PAD*2,h:maxY-minY+PAD*2};
}
function construirSVGExport(){
  const d=diagramaAtual();
  const bb=bboxDoCanvas();
  const clone=svg.cloneNode(true);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.querySelector("#gradePlano")?.remove();
  const contNos=clone.querySelector("#camadaNos");
  if(contNos) contNos.querySelectorAll(".ancora").forEach(n=>n.remove());
  clone.setAttribute("viewBox",`${bb.x} ${bb.y} ${bb.w} ${bb.h}`);
  clone.setAttribute("width",bb.w); clone.setAttribute("height",bb.h);
  const bg=document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("x",bb.x);bg.setAttribute("y",bb.y);bg.setAttribute("width",bb.w);bg.setAttribute("height",bb.h);
  bg.setAttribute("fill","#ffffff");
  clone.insertBefore(bg,clone.firstChild);
  return {svg:clone,bb};
}
function download(nome,conteudo,mime){
  const blob=new Blob([conteudo],{type:mime});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=nome;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); },300);
}
function nomeArquivo(base,ext){
  const limpo=(base||"diagrama").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);
  return (limpo||"diagrama")+ext;
}
function exportar(tipo){
  const d=diagramaAtual();
  if(!d||d.no.length===0){ toast("Adicione blocos antes de exportar.","erro"); return;}
  if(tipo==="svg"){
    const {svg:clone}=construirSVGExport();
    download(nomeArquivo(d.nome,".svg"),new XMLSerializer().serializeToString(clone),"image/svg+xml;charset=utf-8");
    toast("SVG exportado ✓","sucesso");
  }else{
    const {svg:clone,bb}=construirSVGExport();
    const ser=new XMLSerializer().serializeToString(clone);
    const url=URL.createObjectURL(new Blob([ser],{type:"image/svg+xml;charset=utf-8"}));
    const img=new Image();
    img.onload=()=>{
      const scale=2;
      const canvas=document.createElement("canvas");
      canvas.width=bb.w*scale; canvas.height=bb.h*scale;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b=>{
        const a=document.createElement("a");
        a.href=URL.createObjectURL(b); a.download=nomeArquivo(d.nome,".png");
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); },300);
        toast("PNG exportado ✓","sucesso");
      },"image/png");
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); toast("Falha ao exportar PNG.","erro"); };
    img.src=url;
  }
}
document.getElementById("btnExportarSVG").addEventListener("click",()=>exportar("svg"));
document.getElementById("btnExportarPNG").addEventListener("click",()=>exportar("png"));
document.getElementById("btnExportarJSON").addEventListener("click",()=>{
  download(nomeArquivo("editor-diagramas",".json"),JSON.stringify(estado.diagramas,null,2),"application/json");
  toast("JSON exportado ✓","sucesso");
});
document.getElementById("btnImportarJSON").addEventListener("click",()=>document.getElementById("arquivoJSON").click());
document.getElementById("arquivoJSON").addEventListener("change",e=>{
  const arquivo=e.target.files[0]; if(!arquivo) return;
  const leitor=new FileReader();
  leitor.onload=()=>{
    try{
      const obj=JSON.parse(leitor.result);
      if(!Array.isArray(obj)) throw new Error("estrutura inválida");
      estado.diagramas=obj;
      estado.diagramaAtualId=null;
      salvarLocal(); renderInicio();
      toast("JSON importado ✓","sucesso");
    }catch(err){ toast("Arquivo JSON inválido ou incompatível.","erro"); }
    e.target.value="";
  };
  leitor.readAsText(arquivo);
});

/* =========================================================================
   Inicialização
   ========================================================================= */
function init(){
  carregarLocal();
  temaAplicar(temaInicial());
  renderInicio();
  window.addEventListener("resize",()=>{ if(diagramaAtual()) aplicarZoomVisual(); });
  window.addEventListener("keydown",ev=>{
    if(ev.target.tagName==="INPUT"||ev.target.tagName==="TEXTAREA"||ev.target.tagName==="SELECT") return;
    if(ev.key==="Delete"||ev.key==="Backspace"){
      if(estado.selecionados.size||estado.setaSelecionada){ ev.preventDefault(); excluirSelecionados(); }
    }else if(ev.key==="t"||ev.key==="T") definirFerramenta("selecionar");
    else if(ev.key==="c"||ev.key==="C") definirFerramenta("conectar");
  });
}
init();
