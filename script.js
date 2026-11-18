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

/* ---------- Blocos / formas ----------
   OBS: as cores são aplicadas por classe (CSS), não por atributo — atributos SVG
   não resolvem variáveis CSS (var(--x)). As classes em .forma-* definem fill/stroke.
*/
const formasPorId = new Map(Object.values(TIPOS).flatMap(cfg =>
  cfg.paleta.map(item => [item.id, item.forma])
));
function formaDoTipo(tipo){
  return formasPorId.get(tipo) || tipo;
}

function formaSVG(tipo,w,h){
  switch(formaDoTipo(tipo)){
    case "oval":
      return `<circle class="forma-pre forma-oval" cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/2-2}"/>
              <text class="no-texto" x="${w/2}" y="${h/2+5}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">Início</text>`;
    case "alvo":
      return `<circle class="forma-pre forma-alvo-ext" cx="${w/2}" cy="${h/2}" r="${Math.max(w,h)/2-3}"/>
              <circle class="forma-pre forma-alvo-int" cx="${w/2}" cy="${h/2}" r="${Math.max(w,h)/2-11}" stroke-width="3"/>
              <text class="no-texto" x="${w/2}" y="${h+18}" text-anchor="middle" font-size="12" font-weight="700">Fim</text>`;
    case "barra":
      return `<rect class="forma-pre forma-barra" x="2" y="4" width="${w-4}" height="${Math.min(18,h-8)}" rx="4" stroke-width="2"/>
              <text class="no-texto" x="${w/2}" y="${h+18}" text-anchor="middle" font-size="11.5" font-weight="700">fork / join</text>`;
    case "losango":
      return `<path class="forma-pre forma-decisao" d="M ${w/2},3 L ${w-3},${h/2} L ${w/2},${h-3} L 3,${h/2} Z"
                    stroke-width="2.2"/>`;
    case "retângulo":
      return `<rect class="forma-pre forma-ret" x="2" y="2" width="${w-4}" height="${h-4}" rx="8" stroke-width="2"/>`;
    case "retângulo-vaz":
      return `<rect class="forma-pre forma-ret-vaz" x="2" y="2" width="${w-4}" height="${h-4}" rx="8"
                    stroke-dasharray="7 5"/>`;
    case "elipse":
      return `<ellipse class="forma-pre forma-elipse" cx="${w/2}" cy="${h/2}" rx="${w/2-4}" ry="${h/2-4}"
                    stroke-width="2"/>`;
    case "ator":
      // figura humana (bonequinho) desenhada de forma proporcional
      const cx=w/2;
      const {headR,headY,bodyTop,bodyBot,armY,armDx,legBot}=geomAtor(w,h);
      return `<circle class="forma-pre forma-ator" cx="${cx}" cy="${headY}" r="${headR}" stroke-width="2.6"/>
              <line class="forma-pre forma-ator" x1="${cx}" y1="${bodyTop}" x2="${cx}" y2="${bodyBot}" stroke-width="2.6"/>
              <line class="forma-pre forma-ator" x1="${cx-armDx}" y1="${armY}" x2="${cx+armDx}" y2="${armY}" stroke-width="2.6"/>
              <line class="forma-pre forma-ator" x1="${cx}" y1="${bodyBot}" x2="${cx-15}" y2="${legBot}" stroke-width="2.6"/>
              <line class="forma-pre forma-ator" x1="${cx}" y1="${bodyBot}" x2="${cx+15}" y2="${legBot}" stroke-width="2.6"/>`;
    case "limite":
      return `<rect class="forma-pre forma-limite" x="2" y="2" width="${w-4}" height="${h-4}" rx="4"
                    stroke-dasharray="8 6" opacity=".85"/>`;
    case "nota":
      return `<path class="forma-pre forma-nota" d="M2,4 h${w-18} l14,8 v${h-16} h-${w-4} v-${h-8} z"
                    stroke-width="1.8" stroke-linejoin="round"/>`;
    default:
      return `<rect class="forma-pre" x="2" y="2" width="${w-4}" height="${h-4}" rx="8" stroke-width="2"/>`;
  }
}
function dimsPadrao(tipo){
  switch(formaDoTipo(tipo)){
    case "oval":     return {w:110,h:66};
    case "alvo":     return {w:88,h:88};
    case "barra":    return {w:140,h:34};
    case "losango":  return {w:170,h:110};
    case "retângulo":return {w:180,h:60};
    case "elipse":   return {w:170,h:80};
    case "ator":     return {w:96,h:130};
    case "limite":   return {w:620,h:380};
    case "nota":     return {w:140,h:96};
    default:         return {w:180,h:60};
  }
}

/* ---------- Utilitários ---------- */
function novoId(prefixo){ return (prefixo||"N")+(estado._idSeq++).toString(36)+Math.random().toString(36).slice(2,5); }
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
// Botão "Editar texto": edição inline do bloco selecionado (campo sobre a
// caixa, onde o usuário digita); para seta, mantém o prompt de rótulo
document.getElementById("btnEditarTexto").addEventListener("click",()=>{
  const d=diagramaAtual(); if(!d) return;
  if(estado.setaSelecionada){
    const s=d.seta.find(x=>x.id===estado.setaSelecionada);
    if(s){ editarTextoSeta(s); return; }
  }
  if(estado.selecionados.size){
    const no=d.no.find(n=>estado.selecionados.has(n.id));
    if(no){ abrirInline(no); return; }
  }
  toast("Selecione um bloco ou uma seta para editar o texto.","erro");
});

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
    div.innerHTML=`<svg width="44" height="36" viewBox="0 0 ${w} ${h}">${formaSVG(it.id,w,h)}</svg><span class="label">${it.label}</span>`;
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
const camadaSetasFundo=document.getElementById("camadaSetasFundo");

function aplicarZoomVisual(){
  const wrap=document.getElementById("canvasWrap");
  const r=wrap.getBoundingClientRect();
  const w=r.width/estado.zoom, h=r.height/estado.zoom;
  svg.setAttribute("viewBox",`${-w/2} ${-h/2} ${w} ${h}`);
  document.getElementById("zoomContador").textContent=Math.round(estado.zoom*100)+"%";
}
function posMundo(clientX,clientY){
  // conversão de coordenadas de tela para o plano do SVG usando getBoundingClientRect
  // (API universal, sem depender de getScreenCTM/createSVGPoint, que podem falhar)
  const r=svg.getBoundingClientRect();
  if(!r.width||!r.height) return {x:0,y:0};
  const vb=svg.viewBox.baseVal;
  const w=vb.width||r.width, h=vb.height||r.height;
  return {x:(clientX-r.left)/r.width*w+vb.x, y:(clientY-r.top)/r.height*h+vb.y};
}
/* geometria do ator (bonequinho): coordenadas relativas ao grupo do bloco.
   o retângulo invisível que envolve a figura vai de x0 a x1 (pontas dos braços)
   e de y0 a y1 (topo da cabeça até a base das pernas) */
function geomAtor(w,h){
  const headR=Math.min(15,(h-40)/4);
  const headY=headR+9;
  const bodyTop=headY+headR+1;
  const bodyBot=h-32;
  const armY=bodyTop+(bodyBot-bodyTop)*0.45;
  const armDx=Math.min(26,w/2-10);
  const legBot=h-4;
  return {headR,headY,bodyTop,bodyBot,armY,armDx,legBot,x0:w/2-armDx,y0:headY-headR,x1:w/2+armDx,y1:legBot};
}
function ancoras(no,grupo,w,h){
  // A primeira forma é o contorno externo. Textos e áreas de clique ficam de fora.
  const borda=grupo.querySelector(".forma-pre").getBBox();
  let esquerda=borda.x, direita=borda.x+borda.width;
  let topo=borda.y, inferior=borda.y+borda.height;
  let meioY=(topo+inferior)/2;
  if(no.tipo==="ator"){
    const g=geomAtor(w,h);
    esquerda=g.x0; direita=g.x1; topo=g.y0; inferior=g.y1; meioY=g.armY;
  }
  const cx=no.x+(esquerda+direita)/2, cy=no.y+meioY;
  return {
    topo:{x:cx,y:no.y+topo}, direita:{x:no.x+direita,y:cy},
    inferior:{x:cx,y:no.y+inferior}, esquerda:{x:no.x+esquerda,y:cy}
  };
}
/* pontos de conexão sem depender do DOM (usa o box de dimsPadrao + geomAtor).
   Usado no bbox de exportação, onde não há grupo renderizado para consultar getBBox */
function ancorasDados(no){
  const {w,h}=dimsPadrao(no.tipo);
  let esquerda=0, direita=w, topo=0, inferior=h, meioY=h/2;
  if(no.tipo==="ator"){
    const g=geomAtor(w,h);
    esquerda=g.x0; direita=g.x1; topo=g.y0; inferior=g.y1; meioY=g.armY;
  }
  const cx=no.x+(esquerda+direita)/2, cy=no.y+meioY;
  return {
    topo:{x:cx,y:no.y+topo}, direita:{x:no.x+direita,y:cy},
    inferior:{x:cx,y:no.y+inferior}, esquerda:{x:no.x+esquerda,y:cy}
  };
}
function parAncoras(aa,ba){
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
/* Centro da caixa de âncoras de um nó (centro geométrico da caixa delimitadora).
   Os pontos de âncora já estão em coordenadas mundiais, então o centro é a média. */
function centroAncora(aa){
  return {
    x:(aa.esquerda.x+aa.direita.x)/2,
    y:(aa.topo.y+aa.inferior.y)/2
  };
}
/* Ponto de encaixe na borda do nó: interseção da semirreta que vai do centro do nó
   na direção de (tx,ty) com a caixa delimitadora. Isso dá um ponto de encaixe em
   QUALQUER lugar do perímetro (não só os 4 pontos médios dos lados), deixando o
   diagrama menos rígido e com muito mais possibilidades de encaixe. */
function pontoFrontal(aa,no,tx,ty){
  const c=centroAncora(aa);
  const dx=tx-c.x, dy=ty-c.y;
  if(Math.abs(dx)<0.001&&Math.abs(dy)<0.001) return c;
  let t=Infinity;
  if(dx>0) t=Math.min(t,(aa.direita.x-c.x)/dx);
  else if(dx<0) t=Math.min(t,(aa.esquerda.x-c.x)/dx);
  if(dy>0) t=Math.min(t,(aa.inferior.y-c.y)/dy);
  else if(dy<0) t=Math.min(t,(aa.topo.y-c.y)/dy);
  if(!isFinite(t)||t<=0) t=1;
  return {x:c.x+t*dx, y:c.y+t*dy};
}
/* Par de pontos de encaixe: ponto de saída de A na direção de B, e ponto de
   entrada de B na direção de A — os dois pontos "enfrentam" um ao outro. */
function parEncaixe(aa,a,bb,b){
  const ca=centroAncora(aa), cb=centroAncora(bb);
  return {
    p1:pontoFrontal(aa,a,cb.x,cb.y),
    p2:pontoFrontal(bb,b,ca.x,ca.y)
  };
}
/* Caminho reto entre dois pontos de encaixe — mais natural que o caminho em L */
function caminhoReto(p1,p2){
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
}
/* Cabeça (ponta) da seta como triângulo SÓLIDO (não vazada): a ponta fica em p2 e
    a base atrás, na direção de p1->p2. Desenhada numa camada ABAIXO das linhas das
    setas, para a cabeça ser sólida e as linhas que cruzam por ela ficarem visíveis
    (não ficarem ocultas por trás da cabeça). */
function cabecaSeta(p1,p2,tam,larg){
  tam=tam||10; larg=larg||4.5;
  const dx=p2.x-p1.x, dy=p2.y-p1.y;
  const len=Math.hypot(dx,dy)||1;
  const ux=dx/len, uy=dy/len;
  const px=-uy, py=ux; // perpendicular à direção
  const bx=p2.x-ux*tam, by=p2.y-uy*tam; // centro da base (atrás da ponta)
  const lx=bx+px*larg, ly=by+py*larg;
  const rx=bx-px*larg, ry=by-py*larg;
  return `${p2.x},${p2.y} ${lx},${ly} ${rx},${ry}`;
}
function caminhoL(p1,p2){
  const dx=p2.x-p1.x, dy=p2.y-p1.y;
  if(Math.abs(dx)<1&&Math.abs(dy)<1) return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  if(Math.abs(dx)>=Math.abs(dy)) return `M ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
  return `M ${p1.x} ${p1.y} L ${p1.x} ${p2.y} L ${p2.x} ${p2.y}`;
}
/* ponto médio do caminho desenhado (não do segmento entre as âncoras) — usado para
   posicionar o rótulo exatamente no meio da seta, mesmo em linhas em L */
function pontoMeio(p1,p2){
  const dx=p2.x-p1.x, dy=p2.y-p1.y;
  const adx=Math.abs(dx), ady=Math.abs(dy);
  if(adx<1&&ady<1) return {x:p1.x,y:p1.y};
  const total=adx+ady, meio=total/2;
  if(adx>=ady){
    if(meio<=adx) return {x:p1.x+(dx>0?meio:-meio), y:p1.y};
    return {x:p2.x, y:p1.y+(dy>0?(meio-adx):-(meio-adx))};
  }
  if(meio<=ady) return {x:p1.x, y:p1.y+(dy>0?meio:-meio)};
  return {x:p1.x+(dx>0?(meio-ady):-(meio-ady)), y:p2.y};
}
/* Distribui os pontos de partida/chegada das setas: cada seta usa o ponto de
   encaixe (frente) na borda do bloco, e quando várias setas saem do mesmo bloco
   são ordenadas por ângulo e deslocadas perpendicularmente (fan-out), além do
   afastamento da borda — as setas não ficam sobrepostas entre si nem coladas no
   contorno, e o encaixe pode acontecer em qualquer ponto do perímetro. */
function calcularFanout(d,pontosPorNo){
  const SPACING=10, GAP=4;
  const pares=[];
  for(const s of d.seta){
    const a=d.no.find(n=>n.id===s.de), b=d.no.find(n=>n.id===s.para);
    if(!a||!b) continue;
    const aa=pontosPorNo.get(a.id), bb=pontosPorNo.get(b.id);
    if(!aa||!bb) continue;
    pares.push({s,a,b,aa,bb,par:parEncaixe(aa,a,bb,b)});
  }
  // agrupar por nó de origem e ordenar por ângulo para o fan-out angular
  const porOrigem=new Map();
  for(const item of pares){
    const arr=porOrigem.get(item.a.id)||[];
    arr.push(item);
    porOrigem.set(item.a.id,arr);
  }
  for(const [id,arr] of porOrigem){
    arr.sort((x,y)=>{
      const ca=centroAncora(x.aa);
      const cb=centroAncora(y.aa);
      return Math.atan2(x.par.p1.y-ca.y,x.par.p1.x-ca.x)-
             Math.atan2(y.par.p1.y-cb.y,y.par.p1.x-cb.x);
    });
    arr.forEach((item,i)=>item.iO=i);
  }
  const out=new Map();
  for(const {s,a,b,aa,bb,par,iO} of pares){
    const nO=(porOrigem.get(a.id)||[]).length||1;
    const off=(iO-(nO-1)/2)*SPACING;
    const dx=par.p2.x-par.p1.x, dy=par.p2.y-par.p1.y;
    const len=Math.hypot(dx,dy)||1;
    const px=-dy/len, py=dx/len; // perpendicular à direção da seta
    out.set(s.id,{
      p1:afastarEncaixe(par.p1,aa,a,GAP,px*off,py*off),
      p2:afastarEncaixe(par.p2,bb,b,GAP,px*off,py*off)
    });
  }
  return out;
}
function afastarEncaixe(p,aa,no,GAP,dx,dy){
  const c=centroAncora(aa);
  let nx=p.x-c.x, ny=p.y-c.y;
  const nl=Math.hypot(nx,ny)||1;
  nx/=nl; ny/=nl; // normal de saída (de centro até o ponto de encaixe)
  return {x:p.x+nx*GAP+dx, y:p.y+ny*GAP+dy};
}

function render(){
  const d=diagramaAtual(); if(!d) return;
  // remove conexões órfãs (um dos blocos não existe mais) — evita setas invisíveis
  // que não podem ser clicadas nem excluídas
  const antesSetas=d.seta.length;
  d.seta=d.seta.filter(s=>d.no.some(n=>n.id===s.de)&&d.no.some(n=>n.id===s.para));
  if(d.seta.length!==antesSetas) salvarLocal();
  const pontosPorNo=new Map();
  camadaNos.innerHTML="";
  for(const no of d.no){
    const {w,h}=dimsPadrao(no.tipo);
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    const origemAtiva=estado.ferramenta==="conectar"&&estado.origemConexao===no.id;
    g.setAttribute("class","no-grp"+(estado.selecionados.has(no.id)?" selecionado":"")+(origemAtiva?" origem":""));
    g.setAttribute("transform",`translate(${no.x},${no.y})`);
    g.setAttribute("data-id",no.id);
    g.innerHTML=formaSVG(no.tipo,w,h);
    camadaNos.appendChild(g);
    const aa=ancoras(no,g,w,h);
    pontosPorNo.set(no.id,aa);
    const forma=formaDoTipo(no.tipo);
    let tx=w/2, ty=h/2+5, anchor="middle";
    if(forma==="alvo"||forma==="barra"){tx=w/2;ty=h+18;anchor="middle";}
    else if(no.tipo==="ator"){tx=w/2;ty=h+16;anchor="middle";} // etiqueta abaixo da figura (não sobre as pernas)
    else if(forma==="limite"){tx=14;ty=26;anchor="start";}
    else if(no.tipo==="nota"){tx=14;ty=30;anchor="start";}
    const texto=document.createElementNS("http://www.w3.org/2000/svg","text");
    texto.setAttribute("class","no-texto");
    texto.setAttribute("x",tx);texto.setAttribute("y",ty);
    texto.setAttribute("text-anchor",anchor);
    if(forma!=="oval"&&forma!=="alvo"){
      (no.texto||"").split("\n").forEach((ln,i)=>{
        const ts=document.createElementNS("http://www.w3.org/2000/svg","tspan");
        ts.setAttribute("x",tx);ts.setAttribute("dy",i===0?0:15);
        ts.textContent=ln;
        texto.appendChild(ts);
      });
      g.appendChild(texto);
    }
  if(estado.ferramenta==="conectar"||estado.selecionados.has(no.id)){
    for(const k of ["topo","direita","inferior","esquerda"]){
      const circ=document.createElementNS("http://www.w3.org/2000/svg","circle");
      circ.setAttribute("class","ancora");
      circ.setAttribute("cx",aa[k].x-no.x);
      circ.setAttribute("cy",aa[k].y-no.y);
      circ.setAttribute("r",6);
      g.appendChild(circ);
    }
  }
  // área de clique: cobre todo o box do bloco (transparente) — permite clicar e
  // arrastar em qualquer ponto do bloco, inclusive em áreas vazias da figura do ator
  const hit=document.createElementNS("http://www.w3.org/2000/svg","rect");
  hit.setAttribute("class","hit-no");
  hit.setAttribute("x",0); hit.setAttribute("y",0);
  hit.setAttribute("width",w); hit.setAttribute("height",h);
  hit.setAttribute("rx",4);
  g.appendChild(hit);
  // retângulo invisível ao redor do ator: envolve a figura (topo da cabeça, pontas
  // dos braços, base das pernas) — guia de alinhamento das âncoras (não é visível)
  if(no.tipo==="ator"){
    const geo=geomAtor(w,h);
    const alinha=document.createElementNS("http://www.w3.org/2000/svg","rect");
    alinha.setAttribute("class","alinha-ator");
    alinha.setAttribute("x",geo.x0); alinha.setAttribute("y",geo.y0);
    alinha.setAttribute("width",geo.x1-geo.x0); alinha.setAttribute("height",geo.y1-geo.y0);
    alinha.setAttribute("rx",4);
    g.appendChild(alinha);
  }
    g.onclick=ev=>{ ev.stopPropagation(); clickNo(no,ev); };
    // duplo-clique: seleciona e abre a edição inline do texto (trocar o nome
    // diretamente na caixa) — qualquer ferramenta, incluse conectar. O clique
    // simples mantém seu papel (selecionar / definir origem-destino).
    // Com Shift, apenas seleciona (adiciona/remove) sem abrir a edição.
    g.ondblclick=ev=>{
      ev.stopPropagation();
      selecionarNo(no,ev);
      if(!(ev&&ev.shiftKey)) abrirInline(no);
    };
  }
  camadaSetasFundo.innerHTML="";
  camadaConexoes.innerHTML="";
  const fanout=calcularFanout(d,pontosPorNo);
  for(const s of d.seta){
    const a=d.no.find(n=>n.id===s.de), b=d.no.find(n=>n.id===s.para);
    if(!a||!b) continue;
    const par=fanout.get(s.id)||parEncaixe(pontosPorNo.get(a.id),a,pontosPorNo.get(b.id),b);
    const dPath=caminhoReto(par.p1,par.p2);
    const sel=estado.setaSelecionada===s.id;
    const vazio=s.tipo==="include"||s.tipo==="extend";
    const semSeta=s.tipo==="geralizacao";
    const marca=vazio?`<<${s.tipo}>>`:"";
    const meio={x:(par.p1.x+par.p2.x)/2, y:(par.p1.y+par.p2.y)/2};
    const lblX=meio.x, lblY=meio.y;
    // cabeça sólida da seta, desenhada ABAIXO das linhas (camada de fundo), para a
    // ponta não ser vazada e as linhas que cruzam por ela ficarem visíveis
    if(!semSeta){
      const pol=document.createElementNS("http://www.w3.org/2000/svg","polygon");
      pol.setAttribute("points",cabecaSeta(par.p1,par.p2));
      pol.setAttribute("class","seta-cabeca"+(sel?" selecionada":""));
      camadaSetasFundo.appendChild(pol);
    }
    let html=`<path class="conector-hit" d="${dPath}"/>`;
    html+=`<path class="conector ${sel?"selecionado":""}" d="${dPath}" ${s.tipo==="geralizacao"||vazio?'stroke-dasharray="6 5"':""}/>`;
    if(marca) html+=`<rect class="conector-caixa" x="${lblX-marca.length*2.4-4}" y="${lblY-7}" width="${marca.length*4.8+8}" height="14" rx="4"/>
                     <text class="conector-marca-pequena ${s.tipo}" x="${lblX}" y="${lblY+3.5}" text-anchor="middle">${esc(marca)}</text>`;
    if(s.rotulo&&s.rotulo.trim()){
      html+=`<rect class="conector-caixa" x="${lblX-s.rotulo.length*3.6-6}" y="${lblY-22}" width="${s.rotulo.length*7.2+12}" height="18" rx="6" opacity=".95"/>
             <text class="conector-marca" x="${lblX}" y="${lblY-8}" text-anchor="middle">${esc(s.rotulo)}</text>`;
    }
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("data-seta",s.id);
    g.setAttribute("class",sel?"seta-grp selecionada":"seta-grp");
    g.innerHTML=html;
    g.style.pointerEvents="auto";
    g.onclick=ev=>{ ev.stopPropagation(); clickSeta(s); };
    // duplo-clique seleciona a seta (qualquer ferramenta)
    g.ondblclick=ev=>{ ev.stopPropagation(); selecionarSeta(s); };
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
  atualizarCampoNomeAtor();
}

/* ---------- Campo de nome do ator ----------
   Mostra na barra do editor um campo "Nome do ator" quando um único ator
   esta selecionado. O texto digitado vira o rotulo exibido abaixo do
   bonequinho (mesmo rotulo editado pelo duplo-clique), salvo no localStorage.
*/
function atualizarCampoNomeAtor(force){
  const d=diagramaAtual();
  const grupo=document.getElementById("grupoNomeAtor");
  const campo=document.getElementById("campoNomeAtor");
  if(!d){ if(grupo) grupo.style.display="none"; return; }
  const ids=[...estado.selecionados];
  const ator=ids.length===1 && d.no.find(n=>n.id===ids[0]&&n.tipo==="ator");
  if(!ator){ if(grupo) grupo.style.display="none"; return; }
  grupo.style.display="flex";
  const no=d.no.find(n=>n.id===ids[0]);
  // nao reinicia o valor enquanto o usuario esta digitando (evita perder o foco);
  // force = atualiza mesmo assim (ex.: texto editado por duplo-clique)
  if(force||document.activeElement!==campo) campo.value=no.texto||"";
}
document.getElementById("campoNomeAtor").addEventListener("input",e=>{
  const d=diagramaAtual();
  if(!d) return;
  const ids=[...estado.selecionados];
  if(ids.length!==1) return;
  const no=d.no.find(n=>n.id===ids[0]);
  if(!no||no.tipo!=="ator") return;
  no.texto=e.target.value;
  salvarLocal(); render();
});

/* ---------- Interação: cliques ---------- */
/* Seleciona um bloco independente da ferramenta ativa (usado pelo duplo-clique):
   com Shift, adiciona/remove da seleção; sem Shift, seleciona somente ele. */
function selecionarNo(no,ev){
  if(ev&&ev.shiftKey){
    if(estado.selecionados.has(no.id)) estado.selecionados.delete(no.id);
    else estado.selecionados.add(no.id);
  }else{
    estado.selecionados.clear();
    estado.selecionados.add(no.id);
    estado.setaSelecionada=null;
  }
  render();
}
/* Seleciona uma seta independente da ferramenta ativa (usado pelo duplo-clique) */
function selecionarSeta(s){
  estado.selecionados.clear();
  estado.setaSelecionada=s.id;
  render();
}
function clickNo(no,ev){
  if(arrastoReal){ arrastoReal=false; return; } // foi um arrasto, não um clique
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
function editarTextoSeta(s){
  const v=prompt("Rótulo da conexão (em branco para remover):",s.rotulo||"");
  if(v!==null){ s.rotulo=v; salvarLocal(); render(); }
}

/* ---------- Edição inline do texto do bloco (caixa) ----------
   Ao clicar em "Editar texto" com um bloco selecionado, abre um campo HTML
   posicionado sobre o texto da caixa, onde o usuario digita e o texto
   aparece dentro da caixa em tempo real. Enter/desfocar salva; Escape cancela.
*/
function mundoParaWrap(x,y){
  const r=svg.getBoundingClientRect();
  const wrap=document.getElementById("canvasWrap");
  const wr=wrap.getBoundingClientRect();
  if(!r.width||!r.height) return {x:0,y:0};
  const vb=svg.viewBox.baseVal;
  const w=vb.width||r.width, h=vb.height||r.height;
  return {x:(x-vb.x)/w*r.width + r.left - wr.left, y:(y-vb.y)/h*r.height + r.top - wr.top};
}
function posicaoTexto(no,w,h){
  const forma=formaDoTipo(no.tipo);
  let tx=w/2, ty=h/2+5;
  if(forma==="alvo"||forma==="barra"){tx=w/2;ty=h+18;}
  else if(no.tipo==="ator"){tx=w/2;ty=h+16;}
  else if(forma==="limite"){tx=14;ty=26;}
  else if(forma==="nota"){tx=14;ty=30;}
  return {tx,ty};
}
function fecharInline(){
  if(!inlineEdit) return;
  const {input}=inlineEdit;
  if(input.parentNode) input.parentNode.removeChild(input);
  inlineEdit=null;
  render();
}
function abrirInline(no){
  const d=diagramaAtual(); if(!d) return;
  if(inlineEdit) fecharInline();
  const {w,h}=dimsPadrao(no.tipo);
  const {tx,ty}=posicaoTexto(no,w,h);
  const p=mundoParaWrap(no.x+tx, no.y+ty);
  const wrap=document.getElementById("canvasWrap");
  const input=document.createElement("input");
  input.className="editor-inline";
  input.type="text";
  input.maxLength=120;
  input.value=no.texto||"";
  input.style.width=Math.max(120,(no.texto||"").length*8+24)+"px";
  input.style.left=p.x+"px";
  input.style.top=(p.y-14)+"px";
  input.style.transform="translateX(-50%)";
  wrap.appendChild(input);
  inlineEdit={input,no,original:no.texto||""};
  input.focus(); input.select();
  input.addEventListener("input",()=>{
    no.texto=input.value;
    render();
  });
  input.addEventListener("keydown",ev=>{
    if(ev.key==="Enter"){ ev.preventDefault(); fecharInline(); salvarLocal(); }
    else if(ev.key==="Escape"){ ev.preventDefault(); no.texto=inlineEdit.original; fecharInline(); }
  });
  input.addEventListener("blur",()=>{ fecharInline(); salvarLocal(); });
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
    // centro do plano: o viewBox é centrado em (0,0), então adicionar em (0,0)
    // coloca o bloco no centro visível da tela, não num canto
    x=0; y=0;
  }
  const dim=dimsPadrao(tipo);
  const no={id:novoId(),tipo,x:Math.round(x-dim.w/2),y:Math.round(y-dim.h/2),texto:formaDoTipo(tipo)==="limite"?"Sistema":""};
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
// true quando o usuário realmente arrastou (movimento acima do limite) — usado para
// ignorar o clique que o browser dispara após o arrasto, em qualquer ferramenta
let arrastoReal=false;
// edição inline do texto do bloco (campo HTML posicionado sobre a caixa)
let inlineEdit=null;
svg.addEventListener("pointerdown",ev=>{
  const grp=ev.target.closest(".no-grp");
  if(!grp) return;
  ev.preventDefault(); // evita seleção de texto / arrasto nativo do browser
  const d=diagramaAtual(); if(!d) return;
  const no=d.no.find(n=>n.id===grp.getAttribute("data-id"));
  if(!no) return;
  // Em conectar, NÃO inicia arrasto e NÃO captura o ponteiro: com setPointerCapture o
  // evento click é redirecionado para o svg (elemento capturante) e nunca chega ao
  // grupo do bloco, então a conexão nunca é criada. O clique precisa chegar ao
  // grupo normalmente para acionar clickNo (origem -> destino -> seta).
  if(estado.ferramenta==="conectar") return;
  // arrasto funciona em qualquer ferramenta (selecionar, conectar, seta, texto)
  // NÃO seleciona e NÃO captura o ponteiro aqui no pointerdown: a seleção e a
  // captura acontecem só quando o movimento de arrasto realmente começa (primeiro
  // pointermove que ultrapassa o limite). Se capturar no pointerdown, o click e o
  // dblclick são redirecionados para o svg (elemento capturante) e nunca chegam ao
  // grupo — o clique simples/duplo deixaria de selecionar (só selecionaria ao
  // arrastar). O click precisa chegar ao grupo normalmente.
  const p0=posMundo(ev.clientX,ev.clientY);
  arrastagem={p0,originais:new Map(),capturado:false,grp,no};
  arrastoReal=false;
});
svg.addEventListener("pointermove",ev=>{
  if(!arrastagem) return;
  const p=posMundo(ev.clientX,ev.clientY);
  const dx=p.x-arrastagem.p0.x, dy=p.y-arrastagem.p0.y;
  // limite mínimo de movimento para considerar um arrasto real (e não um clique)
  if(Math.abs(dx)>3||Math.abs(dy)>3){
    // primeiro movimento real de arrasto: aí seleciona (se ainda não estiver) e
    // captura o ponteiro — a captura só é necessária para o arrasto e só aí, para
    // o clique simples/duplo (sem arrasto) chegar normalmente ao grupo
    if(!arrastagem.capturado){
      arrastagem.capturado=true;
      arrastoReal=true;
      const {grp,no}=arrastagem;
      if(!estado.selecionados.has(no.id)){
        if(!ev.shiftKey){
          estado.selecionados.clear(); estado.setaSelecionada=null;
        }
        estado.selecionados.add(no.id);
      }
      // reconstrói as origens com a seleção atual (inclui o nó que será arrastado)
      for(const n of diagramaAtual().no.filter(n=>estado.selecionados.has(n.id))){
        arrastagem.originais.set(n.id,{x:n.x,y:n.y});
      }
      try{ svg.setPointerCapture(ev.pointerId); }catch(e){}
    }
  }
  for(const [id,o] of arrastagem.originais){
    const n=diagramaAtual().no.find(x=>x.id===id);
    if(n){ n.x=Math.round(o.x+dx); n.y=Math.round(o.y+dy); }
  }
  render();
});
const fimArrasto=()=>{ if(arrastagem){ arrastagem=null; salvarLocal(); } };
svg.addEventListener("pointerup",fimArrasto);
svg.addEventListener("pointercancel",fimArrasto);
// fecha o arrasto também se o ponteiro for solto fora do canvas
document.addEventListener("pointerup",fimArrasto);
document.addEventListener("pointercancel",fimArrasto);
svg.addEventListener("click",ev=>{
  if(arrastoReal){ arrastoReal=false; return; } // foi um arrasto, não um clique
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
    if(formaDoTipo(no.tipo)==="alvo"||no.tipo==="barra") maxY=Math.max(maxY,no.y+dim.h+28);
    if(no.tipo==="ator") maxY=Math.max(maxY,no.y+dim.h+30); // inclui a etiqueta abaixo da figura
  }
  // inclui as caixas de rótulo das setas (marca include/extend e rótulo do usuário)
  // — usa a mesma distribuição de âncoras (encaixe/fan-out) da renderização, para o
  // rótulo ficar no mesmo ponto que o renderizado
  const pontosExport=new Map();
  for(const no of d.no) pontosExport.set(no.id,ancorasDados(no));
  const fanoutExport=calcularFanout(d,pontosExport);
  for(const s of d.seta){
    const a=d.no.find(n=>n.id===s.de), b=d.no.find(n=>n.id===s.para);
    if(!a||!b) continue;
    const par=fanoutExport.get(s.id)||parEncaixe(ancorasDados(a),a,ancorasDados(b),b);
    const m={x:(par.p1.x+par.p2.x)/2, y:(par.p1.y+par.p2.y)/2};
    let meia=0;
    if(s.tipo==="include"||s.tipo==="extend") meia=28;
    if(s.rotulo&&s.rotulo.trim()) meia=Math.max(meia, s.rotulo.length*3.6+6);
    minX=Math.min(minX,m.x-meia); maxX=Math.max(maxX,m.x+meia);
    minY=Math.min(minY,m.y-22); maxY=Math.max(maxY,m.y+8);
  }
  if(!isFinite(minX)){ minX=0;minY=0;maxX=800;maxY=600; }
  const PAD=60;
  return {x:minX-PAD,y:minY-PAD,w:maxX-minX+PAD*2,h:maxY-minY+PAD*2};
}
/* CSS mínimo injetado no SVG exportado: variáveis do tema atual + classes de
   forma/texto/conector — o arquivo SVG standalone não carrega o style.css, então
   os estilos devem vir junto no próprio arquivo para renderizar com cores corretas */
function cssExport(){
  const vars=["--primario","--primario-2","--panel","--borda","--borda-2","--texto","--texto-2","--sucesso","--aviso"];
  let root="";
  for(const v of vars){
    const val=getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    if(val) root+=v+":"+val+";";
  }
  return root+`
.forma-pre{stroke:var(--borda-2);stroke-width:2}
.forma-oval,.forma-alvo-ext,.forma-barra{fill:var(--primario)}
.forma-alvo-int{fill:var(--panel);stroke:var(--primario)}
.forma-decisao,.forma-ret,.forma-ret-vaz,.forma-elipse,.forma-limite,.forma-nota{fill:var(--panel)}
.forma-ator{fill:none;stroke:var(--texto-2)}
.no-texto{fill:var(--texto);font-family:"Segoe UI",system-ui,sans-serif;user-select:none}
.conector{fill:none;stroke:var(--texto-2);stroke-width:1.8}
.conector-hit{fill:none;stroke:transparent;stroke-width:10;pointer-events:all;cursor:pointer}
.conector-caixa{fill:var(--panel);stroke:var(--borda)}
.conector-marca{font-size:11.5px;font-weight:700;fill:var(--texto-2);font-family:inherit}
.conector-marca.include{fill:var(--sucesso)}
.conector-marca.extend{fill:var(--aviso)}
.seta-marca{fill:var(--texto-2)}
.seta-marca-sel{fill:var(--primario)}
.seta-cabeca{fill:var(--texto-2)}
.seta-cabeca.selecionada{fill:var(--primario)}
.conector-marca-pequena{font-size:8.5px;font-weight:700;fill:var(--texto-2);font-family:inherit}
.conector-marca-pequena.include{fill:var(--sucesso)}
.conector-marca-pequena.extend{fill:var(--aviso)}
`;
}
function construirSVGExport(){
  const d=diagramaAtual();
  const bb=bboxDoCanvas();
  const clone=svg.cloneNode(true);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.querySelector("#gradePlano")?.remove();
  const contNos=clone.querySelector("#camadaNos");
  if(contNos) contNos.querySelectorAll(".ancora,.hit-no,.alinha-ator").forEach(n=>n.remove());
  const contSetas=clone.querySelector("#camadaConexoes");
  if(contSetas) contSetas.querySelectorAll(".conector-hit").forEach(n=>n.remove());
  clone.setAttribute("viewBox",`${bb.x} ${bb.y} ${bb.w} ${bb.h}`);
  clone.setAttribute("width",bb.w); clone.setAttribute("height",bb.h);
  // injeta os estilos (variáveis do tema + classes) para o SVG standalone renderizar correto
  const estilo=document.createElementNS("http://www.w3.org/2000/svg","style");
  estilo.textContent=cssExport();
  clone.insertBefore(estilo,clone.firstChild);
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
