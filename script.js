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
  ancoraOrigem:null,
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
    const div=document.createElement("button");
    div.type="button";
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
  const tipos=TIPOS[d.tipo].conexoes;
  grupo.replaceChildren(...tipos.map(tipo=>new Option(RÓTULO_CONEXAO[tipo],tipo)));
  grupo.value=estado.tipoConexao;
  document.getElementById("opcoesConexao").hidden=estado.ferramenta!=="conectar" || tipos.length<2;
}
document.getElementById("grupoConexoes").addEventListener("change",ev=>{
  estado.tipoConexao=ev.target.value;
});

const menuDiagrama=document.getElementById("menuDiagrama");
document.addEventListener("click",ev=>{
  if(!menuDiagrama.open) return;
  if(!menuDiagrama.contains(ev.target)) menuDiagrama.open=false;
  else if(ev.target.closest("button")){
    menuDiagrama.open=false;
    menuDiagrama.querySelector("summary").focus();
  }
});
menuDiagrama.addEventListener("keydown",ev=>{
  if(ev.key==="Escape"){
    menuDiagrama.open=false;
    menuDiagrama.querySelector("summary").focus();
  }
});

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
const ladosAtividade=["topo","direita","inferior","esquerda"];

// Preserva as âncoras salvas e atribui as livres mais próximas às setas antigas.
function conexoesAtividade(d,pontosPorNo){
  const uso=new Map(), caminhos=new Map();
  let alterado=false;
  for(const id of pontosPorNo.keys()) uso.set(id,{topo:0,direita:0,inferior:0,esquerda:0});
  for(const s of d.seta){
    if(ladosAtividade.includes(s.ancoraDe)) uso.get(s.de)[s.ancoraDe]++;
    if(ladosAtividade.includes(s.ancoraPara)) uso.get(s.para)[s.ancoraPara]++;
  }
  function candidatos(id,fixo){
    if(ladosAtividade.includes(fixo)) return [fixo];
    const contagem=uso.get(id);
    // Blocos antigos acima do limite mantêm as conexões, dividindo os pontos.
    const minimo=Math.min(...Object.values(contagem));
    return ladosAtividade.filter(lado=>contagem[lado]===minimo);
  }
  for(const s of d.seta){
    const aa=pontosPorNo.get(s.de), bb=pontosPorNo.get(s.para);
    const destinos=candidatos(s.para,s.ancoraPara);
    let menor=Infinity, origem, destino;
    for(const a of candidatos(s.de,s.ancoraDe)){
      for(const b of destinos){
        const distancia=Math.hypot(aa[a].x-bb[b].x,aa[a].y-bb[b].y);
        if(distancia<menor){menor=distancia; origem=a; destino=b;}
      }
    }
    if(s.ancoraDe!==origem){s.ancoraDe=origem; uso.get(s.de)[origem]++; alterado=true;}
    if(s.ancoraPara!==destino){s.ancoraPara=destino; uso.get(s.para)[destino]++; alterado=true;}
    caminhos.set(s.id,{p1:aa[origem],p2:bb[destino]});
  }
  if(alterado) salvarLocal();
  return caminhos;
}

function pontoDisponivel(d,id,lado,ignorar=null){
  const ligadas=d.seta.filter(s=>s!==ignorar && (s.de===id || s.para===id));
  if(ligadas.length>=4){
    toast("Este bloco já tem quatro conexões.","erro");
    return false;
  }
  if(lado && ligadas.some(s=>(s.de===id?s.ancoraDe:s.ancoraPara)===lado)){
    toast("Esse ponto já está conectado. Escolha outro ponto azul.","erro");
    return false;
  }
  return true;
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
function pontoFrontal(aa,tx,ty){
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
function parEncaixe(aa,bb){
  const ca=centroAncora(aa), cb=centroAncora(bb);
  return {
    p1:pontoFrontal(aa,cb.x,cb.y),
    p2:pontoFrontal(bb,ca.x,ca.y)
  };
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
/* Cada lado do bloco distribui as pontas que chegam e saem dele.
   A ordem acompanha a posição do outro bloco para evitar cruzamentos locais. */
function calcularFanout(d,pontosPorNo){
  const lados=new Map(), pares=new Map();
  function registrar(id,ponto,alvo,seta){
    const aa=pontosPorNo.get(id);
    const ladosDoNo=lados.get(id)||new Map();
    lados.set(id,ladosDoNo);
    const bordas=[
      ["esquerda","x",-1],["direita","x",1],["topo","y",-1],["inferior","y",1]
    ];
    const [lado,normal,sinal]=bordas.reduce((melhor,atual)=>{
      const distancia=([nome,eixo])=>Math.abs(ponto[eixo]-aa[nome][eixo]);
      return distancia(atual)<distancia(melhor)?atual:melhor;
    });
    const eixo=normal==="x"?"y":"x";
    if(!ladosDoNo.has(lado)){
      const min=eixo==="y"?aa.topo.y:aa.esquerda.x;
      const max=eixo==="y"?aa.inferior.y:aa.direita.x;
      ladosDoNo.set(lado,{eixo,min,max,pontas:[]});
    }
    ponto[normal]+=4*sinal;
    // Ordena as setas de ida e volta pela perpendicular ao sentido da viagem.
    // Na borda vertical distribuímos em y; na horizontal, em x (sinal oposto).
    const sentido=id===seta.de ? sinal : -sinal;
    const faixa=normal==="x" ? sentido : -sentido;
    ladosDoNo.get(lado).pontas.push({ponto,alvo:alvo[eixo],faixa,id:seta.id});
  }
  for(const s of d.seta){
    const aa=pontosPorNo.get(s.de), bb=pontosPorNo.get(s.para);
    if(!aa||!bb) continue;
    const a=centroAncora(aa), b=centroAncora(bb);
    const {p1,p2}=parEncaixe(aa,bb);
    registrar(s.de,p1,b,s); registrar(s.para,p2,a,s);
    pares.set(s.id,{p1,p2});
  }
  for(const grupos of lados.values()){
    for(const {eixo,min,max,pontas} of grupos.values()){
      if(pontas.length<2) continue;
      pontas.sort((a,b)=>a.ponto[eixo]-b.ponto[eixo] || a.alvo-b.alvo || a.faixa-b.faixa || String(a.id).localeCompare(String(b.id)));
      const margem=Math.min(6,(max-min)/4);
      const passo=Math.min(22,(max-min-2*margem)/(pontas.length-1));
      let anterior=min+margem-passo;
      pontas.forEach(({ponto},i)=>{
        const limite=max-margem-(pontas.length-1-i)*passo;
        ponto[eixo]=Math.min(limite,Math.max(anterior+passo,ponto[eixo]));
        anterior=ponto[eixo];
      });
    }
  }
  return pares;
}

/* Duas marcas próximas podem ser mais largas que o espaço entre as setas.
   Procura uma posição livre ao longo da própria conexão, começando pelo centro. */
function posicionarRotulo(tracado,largura,comTexto,ocupados){
  let melhor, menor=Infinity;
  for(const t of [.5,.35,.65,.2,.8]){
    const {x,y}=tracado.ponto(t);
    const caixa={x1:x-largura/2-3,x2:x+largura/2+3,y1:y-(comTexto?32:10),y2:y+10};
    let area=0;
    for(const c of ocupados){
      area+=Math.max(0,Math.min(c.x2,caixa.x2)-Math.max(c.x1,caixa.x1))*
            Math.max(0,Math.min(c.y2,caixa.y2)-Math.max(c.y1,caixa.y1));
    }
    if(area<menor){melhor={x,y,caixa};menor=area;}
    if(area===0) break;
  }
  ocupados.push(melhor.caixa);
  return melhor;
}

// Mede o contorno visível em coordenadas locais uma vez para cada tipo de bloco.
const contornosPorTipo=new Map();
function medirContorno(no,grupo){
  if(contornosPorTipo.has(no.tipo)) return;
  const formas=no.tipo==="ator" ? grupo.querySelectorAll(".forma-ator") : [grupo.querySelector(".forma-pre")];
  const contornos=Array.from(formas,forma=>{
    const comprimento=forma.getTotalLength();
    const n=Math.max(1,Math.ceil(comprimento/3));
    return Array.from({length:n+1},(_,i)=>forma.getPointAtLength(comprimento*i/n));
  });
  contornosPorTipo.set(no.tipo,contornos);
}
function encaixeNoContorno(no,alvo){
  const x=alvo.x-no.x,y=alvo.y-no.y;
  let melhor,menor=Infinity;
  for(const parte of contornosPorTipo.get(no.tipo)){
    for(let i=1;i<parte.length;i++){
      const a=parte[i-1],b=parte[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
      const px=a.x+t*dx,py=a.y+t*dy,dist=(px-x)**2+(py-y)**2;
      if(dist<menor){menor=dist;melhor={x:no.x+px,y:no.y+py};}
    }
  }
  return melhor;
}
function interpolar(a,b,t){
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
// Spline interpolante: cada ponto arrastado fica exatamente sobre a curva.
function tracadoLinha(p1,p2,dobras){
  const pontos=[p1,...dobras,p2], trechos=[];
  let caminho=`M ${p1.x} ${p1.y}`;
  for(let i=0;i<pontos.length-1;i++){
    const a=pontos[i],b=pontos[i+1],antes=pontos[i-1]||a,depois=pontos[i+2]||b;
    const c={x:a.x+(b.x-antes.x)/6,y:a.y+(b.y-antes.y)/6};
    const e={x:b.x-(depois.x-a.x)/6,y:b.y-(depois.y-a.y)/6};
    trechos.push({a,b,c,e});
    caminho+=dobras.length ? ` C ${c.x} ${c.y} ${e.x} ${e.y} ${b.x} ${b.y}` : ` L ${b.x} ${b.y}`;
  }
  function ponto(t){
    if(!dobras.length) return interpolar(p1,p2,t);
    const i=Math.min(trechos.length-1,Math.floor(t*trechos.length));
    const u=t*trechos.length-i,{a,b,c,e}=trechos[i];
    const ac=interpolar(a,c,u),ce=interpolar(c,e,u),eb=interpolar(e,b,u);
    return interpolar(interpolar(ac,ce,u),interpolar(ce,eb,u),u);
  }
  return {caminho,ponto,tangente:trechos.at(-1).e};
}

const ancorasRender=new Map();
const alcasLinha=document.getElementById("alcasLinha");
const tipoLinha=document.getElementById("tipoLinha");
let gestoLinha=null;
function setaAtual(){
  return diagramaAtual()?.seta.find(s=>s.id===estado.setaSelecionada);
}
function atualizarControlesLinha(d){
  const s=setaAtual(), tipos=TIPOS[d.tipo].conexoes;
  document.getElementById("tipoLinhaGrupo").hidden=!s||tipos.length<2;
  if(s && tipos.length>1){
    if(tipoLinha.dataset.diagrama!==d.tipo){
      tipoLinha.replaceChildren(...tipos.map(t=>new Option(RÓTULO_CONEXAO[t],t)));
      tipoLinha.dataset.diagrama=d.tipo;
    }
    tipoLinha.value=s.tipo;
  }
  document.getElementById("endireitarLinha").hidden=!s?.dobras?.length;
}
tipoLinha.addEventListener("change",()=>{
  const s=setaAtual();
  if(s){s.tipo=tipoLinha.value; salvarLocal(); render();}
});
document.getElementById("endireitarLinha").addEventListener("click",()=>{
  const s=setaAtual();
  if(s){delete s.dobras; salvarLocal(); render();}
});
function mostrarAlcas(par,tracado,dobras){
  function alca(p,acao,indice,titulo){
    const c=document.createElementNS(svg.namespaceURI,"circle");
    c.setAttribute("cx",p.x); c.setAttribute("cy",p.y);
    c.setAttribute("r",acao==="inserir"?4:6);
    c.dataset.acao=acao; c.dataset.indice=indice;
    const dica=document.createElementNS(svg.namespaceURI,"title");
    dica.textContent=titulo; c.appendChild(dica); alcasLinha.appendChild(c);
  }
  for(let i=0;i<=dobras.length;i++){
    alca(tracado.ponto((i+.5)/(dobras.length+1)),"inserir",i,"Arraste para criar uma curva");
  }
  dobras.forEach((p,i)=>alca(p,"mover",i,"Arraste para ajustar a curva"));
  alca(par.p1,"de",0,"Arraste a origem até a borda de um bloco");
  alca(par.p2,"para",0,"Arraste o destino até a borda de um bloco");
}
alcasLinha.addEventListener("click",ev=>ev.stopPropagation());
function iniciarGestoLinha(ev,s,acao,indice,peloTraco=false){
  if(gestoLinha || ev.button!==0 || !s || !acao) return;
  ev.preventDefault(); ev.stopPropagation();
  gestoLinha={id:s.id,ponteiro:ev.pointerId,acao,indice,peloTraco,
    inicio:{x:ev.clientX,y:ev.clientY},dobras:[...(s.dobras||[])]};
  alcasLinha.setPointerCapture(ev.pointerId);
}
alcasLinha.addEventListener("pointerdown",ev=>{
  iniciarGestoLinha(ev,setaAtual(),ev.target.dataset.acao,Number(ev.target.dataset.indice));
});
function atualizarGestoLinha(ev){
  const g=gestoLinha;
  if(!g || g.ponteiro!==ev.pointerId) return;
  if(!g.pos && Math.hypot(ev.clientX-g.inicio.x,ev.clientY-g.inicio.y)<3) return;
  g.pos=posMundo(ev.clientX,ev.clientY);
  if(g.acao==="inserir"){g.dobras.splice(g.indice,0,g.pos); g.acao="mover";}
  if(g.acao==="mover") g.dobras[g.indice]=g.pos;
}
alcasLinha.addEventListener("pointermove",ev=>{
  if(gestoLinha?.ponteiro!==ev.pointerId) return;
  atualizarGestoLinha(ev);
  if(gestoLinha.pos) render();
});
function mudarExtremidade(s,g){
  const d=diagramaAtual(), atividade=d.tipo==="atividades";
  let candidato,menor=18/estado.zoom;
  for(const no of d.no){
    const aa=ancorasRender.get(no.id);
    if(!aa) continue;
    const opcoes=atividade ? Object.entries(aa) : [[null,encaixeNoContorno(no,g.pos)]];
    for(const [lado,p] of opcoes){
      const distancia=Math.hypot(p.x-g.pos.x,p.y-g.pos.y);
      if(distancia<=menor){menor=distancia;candidato={no,lado,p};}
    }
  }
  if(!candidato){toast("Solte a ponta sobre "+(atividade?"uma âncora.":"a borda de um bloco."),"erro");return;}
  const {no,lado,p}=candidato, origem=g.acao==="de";
  const de=origem?no.id:s.de,para=origem?s.para:no.id;
  if(de===para || d.seta.some(o=>o!==s && o.de===de && o.para===para)){
    toast("Escolha outro bloco para essa conexão.","erro"); return;
  }
  if(atividade && !pontoDisponivel(d,no.id,lado,s)) return;
  s[g.acao]=no.id;
  if(atividade) s[origem?"ancoraDe":"ancoraPara"]=lado;
  else s[origem?"pontoDe":"pontoPara"]={x:p.x-no.x,y:p.y-no.y};
  salvarLocal();
}
alcasLinha.addEventListener("pointerup",ev=>{
  if(gestoLinha?.ponteiro!==ev.pointerId) return;
  atualizarGestoLinha(ev);
  const g=gestoLinha,s=setaAtual(); gestoLinha=null;
  if(s?.id===g.id && !g.pos && g.peloTraco){clickSeta(s);return;}
  if(s?.id===g.id && g.pos){
    if(g.acao==="mover"){s.dobras=g.dobras; salvarLocal();}
    else mudarExtremidade(s,g);
  }
  render();
});
alcasLinha.addEventListener("lostpointercapture",()=>{
  if(gestoLinha){gestoLinha=null; render();}
});

function render(){
  const d=diagramaAtual(); if(!d) return;
  // remove conexões órfãs (um dos blocos não existe mais) — evita setas invisíveis
  // que não podem ser clicadas nem excluídas
  const antesSetas=d.seta.length;
  d.seta=d.seta.filter(s=>d.no.some(n=>n.id===s.de)&&d.no.some(n=>n.id===s.para));
  if(d.seta.length!==antesSetas) salvarLocal();
  const pontosPorNo=ancorasRender;
  pontosPorNo.clear();
  alcasLinha.replaceChildren();
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
    if(d.tipo!=="atividades") medirContorno(no,g);
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
  // área de clique: cobre todo o box do bloco (transparente) — permite clicar e
  // arrastar em qualquer ponto do bloco, inclusive em áreas vazias da figura do ator
  const hit=document.createElementNS("http://www.w3.org/2000/svg","rect");
  hit.setAttribute("class","hit-no");
  hit.setAttribute("x",0); hit.setAttribute("y",0);
  hit.setAttribute("width",w); hit.setAttribute("height",h);
  hit.setAttribute("rx",4);
  g.appendChild(hit);
  if(estado.ferramenta==="conectar"||estado.selecionados.has(no.id)){
    for(const k of ladosAtividade){
      const circ=document.createElementNS("http://www.w3.org/2000/svg","circle");
      circ.setAttribute("class","ancora");
      if(d.tipo==="atividades") circ.dataset.ancora=k;
      circ.setAttribute("cx",aa[k].x-no.x);
      circ.setAttribute("cy",aa[k].y-no.y);
      circ.setAttribute("r",6);
      g.appendChild(circ);
    }
  }

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
  const camadaRotulos=document.getElementById("camadaRotulos");
  camadaRotulos.replaceChildren();
  const ocupados=[];
  const fanout=d.tipo==="atividades" ? conexoesAtividade(d,pontosPorNo) : calcularFanout(d,pontosPorNo);
  const nosPorId=new Map(d.no.map(no=>[no.id,no]));
  for(const s of d.seta){
    const par=fanout.get(s.id);
    if(!par) continue;
    if(d.tipo!=="atividades"){
      const a=nosPorId.get(s.de),b=nosPorId.get(s.para);
      par.p1=s.pontoDe ? {x:a.x+s.pontoDe.x,y:a.y+s.pontoDe.y} : encaixeNoContorno(a,par.p1);
      par.p2=s.pontoPara ? {x:b.x+s.pontoPara.x,y:b.y+s.pontoPara.y} : encaixeNoContorno(b,par.p2);
    }
    const gesto=gestoLinha?.id===s.id ? gestoLinha : null;
    if(gesto?.pos && gesto.acao==="de") par.p1=gesto.pos;
    if(gesto?.pos && gesto.acao==="para") par.p2=gesto.pos;
    const dobras=gesto?.dobras || s.dobras || [];
    const tracado=tracadoLinha(par.p1,par.p2,dobras);
    const dPath=tracado.caminho;
    const sel=estado.setaSelecionada===s.id;
    if(sel && estado.ferramenta==="selecionar") mostrarAlcas(par,tracado,dobras);
    const vazio=s.tipo==="include"||s.tipo==="extend";
    const semSeta=s.tipo==="geralizacao";
    const marca=vazio?`<<${s.tipo}>>`:"";
    // cabeça sólida da seta, desenhada ABAIXO das linhas (camada de fundo), para a
    // ponta não ser vazada e as linhas que cruzam por ela ficarem visíveis
    if(!semSeta){
      const pol=document.createElementNS("http://www.w3.org/2000/svg","polygon");
      pol.setAttribute("points",cabecaSeta(tracado.tangente,par.p2));
      pol.setAttribute("class","seta-cabeca"+(sel?" selecionada":""));
      camadaSetasFundo.appendChild(pol);
    }
    let html=`<path class="conector-hit" d="${dPath}"/>`;
    html+=`<path class="conector ${sel?"selecionado":""}" d="${dPath}" ${s.tipo==="geralizacao"||vazio?'stroke-dasharray="6 5"':""}/>`;
    const texto=(s.rotulo||"").trim();
    let rotulos="";
    if(marca||texto){
      const larguraMarca=marca.length*5.5+10, larguraTexto=texto.length*7.2+12;
      const {x,y}=posicionarRotulo(tracado,Math.max(larguraMarca,larguraTexto),Boolean(texto),ocupados);
      if(marca) rotulos+=`<rect class="conector-caixa" x="${x-larguraMarca/2}" y="${y-8}" width="${larguraMarca}" height="16" rx="4"/>
        <text class="conector-marca-pequena ${s.tipo}" x="${x}" y="${y+3}" text-anchor="middle">${esc(marca)}</text>`;
      if(texto){
        const topo=marca?y-29:y-9;
        rotulos+=`<rect class="conector-caixa" x="${x-larguraTexto/2}" y="${topo}" width="${larguraTexto}" height="18" rx="5"/>
          <text class="conector-marca" x="${x}" y="${topo+13}" text-anchor="middle">${esc(texto)}</text>`;
      }
    }
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("data-seta",s.id);
    g.setAttribute("class",sel?"seta-grp selecionada":"seta-grp");
    g.innerHTML=html;
    g.style.pointerEvents="auto";
    g.onclick=ev=>{ ev.stopPropagation(); clickSeta(s); };
    // duplo-clique seleciona a seta (qualquer ferramenta)
    g.ondblclick=ev=>{ ev.stopPropagation(); selecionarSeta(s); };
    if(sel && estado.ferramenta==="selecionar"){
      g.onpointerdown=ev=>{
        const p=posMundo(ev.clientX,ev.clientY);
        const n=dobras.length+1;
        let indice=0,menor=Infinity;
        for(let i=0;i<n*12;i++){
          const q=tracado.ponto((i+.5)/(n*12)),dist=Math.hypot(q.x-p.x,q.y-p.y);
          if(dist<menor){indice=Math.floor(i/12);menor=dist;}
        }
        iniciarGestoLinha(ev,s,"inserir",indice,true);
      };
    }
    camadaConexoes.appendChild(g);
    if(rotulos){
      const grupo=g.cloneNode(false);
      grupo.innerHTML=rotulos;
      grupo.onclick=g.onclick; grupo.ondblclick=g.ondblclick;
      camadaRotulos.appendChild(grupo);
    }
  }
  const dica=document.getElementById("dicaCanvas");
  dica.style.display=d.no.length===0?"block":"none";
  const info=document.getElementById("infoSelecionado");
  const quantidade=estado.selecionados.size;
  document.getElementById("acoesSelecao").hidden=!quantidade && !estado.setaSelecionada;
  document.getElementById("btnEditarTexto").hidden=quantidade>1;
  info.textContent=estado.setaSelecionada ? "Seta selecionada" :
    quantidade===1 ? "Bloco selecionado" : quantidade+" blocos selecionados";
  atualizarControlesLinha(d);
  atualizarCampoNomeAtor();
  posicionarInline(); // acompanha o bloco se ele se mover enquanto o campo de edição está aberto
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
    const d=diagramaAtual();
    const lado=ev.target?.dataset?.ancora;
    if(!estado.origemConexao){
      if(d.tipo==="atividades" && !pontoDisponivel(d,no.id,lado)) return;
      estado.ancoraOrigem=lado;
      estado.origemConexao=no.id; render();
      toast(d.tipo==="atividades" ? "Escolha um ponto azul livre ou clique no bloco de destino." :
        "Bloco origem definido. Clique no bloco de destino para criar a seta.","sucesso");
    }else if(estado.origemConexao===no.id){
      estado.origemConexao=null; render();
    }else{
      const de=estado.origemConexao;
      if(d.tipo!=="atividades") estado.origemConexao=null;
      adicionarSeta(de,no.id,estado.ancoraOrigem,lado);
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
  input.style.top=(p.y-14)+"px"; // posição inicial; refinada abaixo com a altura real
  input.style.transform="translateX(-50%)";
  wrap.appendChild(input);
  // centraliza verticalmente o campo exatamente sobre a linha do texto:
  // o centro do campo fica na baseline do texto (p.y), ajustado pelo padding
  const ih=input.offsetHeight||30;
  input.style.top=(p.y - ih/2)+"px";
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
/* Atualiza a posição do campo de edição inline aberto para acompanhar o bloco.
   Antes o campo era posicionado só na abertura; ao arrastar o bloco ele ficava
   fixo no local original. Agora, a cada render (incluindo cada movimento do
   arrasto), o campo é reposicionado sobre o texto na posição atual do bloco. */
function posicionarInline(){
  if(!inlineEdit) return;
  const d=diagramaAtual(); if(!d) return;
  const no=d.no.find(n=>n.id===inlineEdit.no.id); if(!no) return;
  const {w,h}=dimsPadrao(no.tipo);
  const {tx,ty}=posicaoTexto(no,w,h);
  const p=mundoParaWrap(no.x+tx, no.y+ty);
  // centraliza o campo (centro na baseline do texto), como na abertura
  const ih=inlineEdit.input.offsetHeight||30;
  inlineEdit.input.style.left=p.x+"px";
  inlineEdit.input.style.top=(p.y - ih/2)+"px";
}
function adicionarSeta(de,para,ancoraDe,ancoraPara){
  const d=diagramaAtual();
  if(de===para){ toast("Não é possível conectar um bloco a ele mesmo.","erro"); return;}
  if(d.seta.some(s=>s.de===de&&s.para===para)){ toast("Esta conexão já existe.","erro"); return;}
  const atividade=d.tipo==="atividades";
  if(atividade && (!pontoDisponivel(d,de,ancoraDe) || !pontoDisponivel(d,para,ancoraPara))) return;
  const seta={id:novoId(),de,para,tipo:estado.tipoConexao,rotulo:""};
  if(atividade){seta.ancoraDe=ancoraDe; seta.ancoraPara=ancoraPara;}
  d.seta.push(seta);
  estado.origemConexao=null;
  estado.ancoraOrigem=null;
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
  document.getElementById("ferrSelecionar").setAttribute("aria-pressed",String(f==="selecionar"));
  document.getElementById("ferrConectar").setAttribute("aria-pressed",String(f==="conectar"));
  svg.classList.toggle("ferramenta-conectar",f==="conectar");
  if(diagramaAtual()) renderConexoes();
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
  for(const camada of [camadaConexoes,camadaSetasFundo,document.getElementById("camadaRotulos")]){
    if(!camada.childElementCount) continue;
    const r=camada.getBBox();
    minX=Math.min(minX,r.x); minY=Math.min(minY,r.y);
    maxX=Math.max(maxX,r.x+r.width); maxY=Math.max(maxY,r.y+r.height);
  }
  if(!isFinite(minX)){ minX=0;minY=0;maxX=800;maxY=600; }
  const PAD=60;
  return {x:minX-PAD,y:minY-PAD,w:maxX-minX+PAD*2,h:maxY-minY+PAD*2};
}
/* CSS mínimo injetado no SVG exportado: variáveis do tema atual + classes de
   forma/texto/conector — o arquivo SVG standalone não carrega o style.css, então
   os estilos devem vir junto no próprio arquivo para renderizar com cores corretas */
// Cores da imagem em papel branco, inclusive quando o editor usa o tema escuro.
const coresPNG={
  "--primario":"#294e91", "--panel":"#f0f5fc", "--borda":"#8999ae",
  "--borda-2":"#354e70", "--texto":"#17283d", "--texto-2":"#41546c",
  "--sucesso":"#176144", "--aviso":"#824309"
};
function cssExport(formato){
  const tema=getComputedStyle(document.documentElement);
  const cor=nome=>formato==="png" ? coresPNG[nome] : tema.getPropertyValue(nome).trim();
  return `
.forma-pre{stroke:${cor("--borda-2")};stroke-width:2}
.forma-oval,.forma-alvo-ext,.forma-barra{fill:${cor("--primario")}}
.forma-alvo-int{fill:${cor("--panel")};stroke:${cor("--primario")}}
.forma-decisao,.forma-ret,.forma-ret-vaz,.forma-elipse,.forma-limite,.forma-nota{fill:${cor("--panel")}}
.forma-ator{fill:none;stroke:${cor("--texto-2")}}
.no-texto{fill:${cor("--texto")};font-family:"Segoe UI",system-ui,sans-serif;user-select:none}
.conector{fill:none;stroke:${cor("--texto-2")};stroke-width:1.8}
.conector-hit{fill:none;stroke:transparent;stroke-width:10;pointer-events:stroke;cursor:pointer}
.conector-caixa{fill:${cor("--panel")};stroke:${cor("--borda")}}
.conector-marca{font-size:11.5px;font-weight:700;fill:${cor("--texto-2")};font-family:inherit}
.conector-marca.include{fill:${cor("--sucesso")}}
.conector-marca.extend{fill:${cor("--aviso")}}
.seta-marca{fill:${cor("--texto-2")}}
.seta-marca-sel{fill:${cor("--primario")}}
.seta-cabeca{fill:${cor("--texto-2")}}
.seta-cabeca.selecionada{fill:${cor("--primario")}}
.conector-marca-pequena{font-size:8.5px;font-weight:700;fill:${cor("--texto-2")};font-family:inherit}
.conector-marca-pequena.include{fill:${cor("--sucesso")}}
.conector-marca-pequena.extend{fill:${cor("--aviso")}}${formato==="png" ? `
.forma-oval + .no-texto{fill:white}
.conector-caixa{fill:white}
.conector-marca,.conector-marca-pequena{font-family:"Segoe UI",system-ui,sans-serif}
.conector-marca-pequena{font-size:10px}` : ""}
`;
}
function construirSVGExport(formato){
  const bb=bboxDoCanvas();
  const clone=svg.cloneNode(true);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.querySelector("#gradePlano")?.remove();
  clone.querySelector("#alcasLinha")?.remove();
  const contNos=clone.querySelector("#camadaNos");
  if(contNos) contNos.querySelectorAll(".ancora,.hit-no,.alinha-ator").forEach(n=>n.remove());
  const contSetas=clone.querySelector("#camadaConexoes");
  if(contSetas) contSetas.querySelectorAll(".conector-hit").forEach(n=>n.remove());
  clone.setAttribute("viewBox",`${bb.x} ${bb.y} ${bb.w} ${bb.h}`);
  clone.setAttribute("width",bb.w); clone.setAttribute("height",bb.h);
  // injeta os estilos (variáveis do tema + classes) para o SVG standalone renderizar correto
  const estilo=document.createElementNS("http://www.w3.org/2000/svg","style");
  estilo.textContent=cssExport(formato);
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
    const {svg:clone}=construirSVGExport(tipo);
    download(nomeArquivo(d.nome,".svg"),new XMLSerializer().serializeToString(clone),"image/svg+xml;charset=utf-8");
    toast("SVG exportado ✓","sucesso");
  }else{
    const {svg:clone,bb}=construirSVGExport(tipo);
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
  new ResizeObserver(()=>{
    if(diagramaAtual()){
      aplicarZoomVisual();
      posicionarInline();
    }
  }).observe(document.getElementById("canvasWrap"));
  window.addEventListener("keydown",ev=>{
    if(!diagramaAtual() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if(ev.target.tagName==="INPUT"||ev.target.tagName==="TEXTAREA"||ev.target.tagName==="SELECT") return;
    if(ev.key==="Delete"||ev.key==="Backspace"){
      if(estado.selecionados.size||estado.setaSelecionada){ ev.preventDefault(); excluirSelecionados(); }
    }else if(ev.key==="t"||ev.key==="T") definirFerramenta("selecionar");
    else if(ev.key==="c"||ev.key==="C") definirFerramenta("conectar");
  });
}
init();
