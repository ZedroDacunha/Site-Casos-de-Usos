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
  projetos:[],
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
      return `<circle class="forma-pre forma-oval" cx="${w/2}" cy="${h/2}" r="${h/2-recuoCircular.oval}"/>`;
    case "alvo":{
      const raio=h/2-recuoCircular.alvo;
      return `<circle class="forma-pre forma-alvo-ext" cx="${w/2}" cy="${h/2}" r="${raio}"/>
              <circle class="forma-pre forma-alvo-int" cx="${w/2}" cy="${h/2}" r="${raio-8}" stroke-width="3"/>`;
    }
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

const formasDeCaixa=new Set(["retângulo","retângulo-vaz","elipse","losango","limite","nota","oval","alvo"]);
const recuoCircular={oval:2,alvo:3};
const tamanhoMinimo={w:56,h:40,diametro:40};

// Mantém a margem horizontal usada nos pontos de início dos diagramas existentes.
function dimensoesCirculo(tipo,diametro){
  const base=dimsPadrao(tipo);
  const h=limitarTamanho("diametro",diametro)+2*recuoCircular[formaDoTipo(tipo)];
  return {w:h+base.w-base.h,h};
}
function textoDoBloco(no){
  if(no.texto) return no.texto;
  const forma=formaDoTipo(no.tipo);
  if(forma==="oval") return "Início";
  if(forma==="alvo") return "Fim";
  return "";
}
function limitarTamanho(eixo,valor){
  return Math.min(5000,Math.max(tamanhoMinimo[eixo],Math.round(valor)));
}
let gestoTamanho=null;

function dimensoesNo(no){
  if(gestoTamanho?.no===no) return gestoTamanho.atual;
  const base=dimsPadrao(no.tipo);
  const forma=formaDoTipo(no.tipo);
  if(recuoCircular[forma]) return Number.isFinite(no.diametro) ? dimensoesCirculo(no.tipo,no.diametro) : base;
  if(!formasDeCaixa.has(forma)) return base;
  for(const eixo of ["w","h"]){
    if(Number.isFinite(no[eixo])) base[eixo]=limitarTamanho(eixo,no[eixo]);
  }
  return base;
}

// Mede as palavras com a mesma fonte usada na tela e no SVG exportado.
const medidaRotulo=document.createElement("canvas").getContext("2d");
medidaRotulo.font='16px "Segoe UI",system-ui,sans-serif';
const segmentosRotulo=typeof Intl.Segmenter==="function" ? new Intl.Segmenter("pt",{granularity:"grapheme"}) : null;
function quebrarRotulo(texto,largura){
  const linhas=[];
  for(const paragrafo of texto.split(/\r?\n/)){
    let linha="";
    for(const palavra of paragrafo.trim().split(/\s+/)){
      const proposta=linha ? linha+" "+palavra : palavra;
      if(medidaRotulo.measureText(proposta).width<=largura){linha=proposta;continue;}
      if(linha) linhas.push(linha);
      linha=palavra;
      if(medidaRotulo.measureText(palavra).width<=largura) continue;
      linha="";
      const letras=segmentosRotulo ? Array.from(segmentosRotulo.segment(palavra),g=>g.segment) : [...palavra];
      for(const letra of letras){
        if(linha && medidaRotulo.measureText(linha+letra).width>largura){linhas.push(linha);linha="";}
        linha+=letra;
      }
    }
    linhas.push(linha);
  }
  return linhas;
}

const rotulosPorNo=new WeakMap();
function comporRotulo(no,w,h){
  const anterior=rotulosPorNo.get(no);
  if(anterior?.w===w && anterior.h===h && anterior.texto===no.texto) return anterior.layout;
  const forma=formaDoTipo(no.tipo);
  const esquerda=forma==="limite" || forma==="nota";
  let largura=w-24, altura=h-16;
  // Retângulos inscritos deixam todos os cantos do texto dentro das bordas curvas ou inclinadas.
  if(forma==="elipse"){largura=(w-12)*0.78;altura=(h-12)*0.60;}
  if(recuoCircular[forma]){
    // No fim, o rótulo fica dentro do círculo interno, com folga para seu traço.
    const livre=h-2*recuoCircular[forma]-(forma==="alvo"?20:4);
    largura=livre*0.78; altura=livre*0.60;
  }
  if(forma==="losango"){largura=(w-10)*0.54;altura=(h-10)*0.46;}
  if(esquerda) altura=h-28;
  let fonte=16,linhas;
  for(;;){
    linhas=quebrarRotulo(textoDoBloco(no),largura*16/fonte);
    const alturaTexto=linhas.length*fonte*1.25;
    const maior=linhas.reduce((max,l)=>Math.max(max,medidaRotulo.measureText(l).width*fonte/16),1);
    if(alturaTexto<=altura && maior<=largura) break;
    fonte*=Math.min(0.91,largura/maior,Math.sqrt(altura/alturaTexto));
  }
  const x=esquerda?12:w/2;
  const y=(esquerda?16:(h-linhas.length*fonte*1.25)/2)+fonte;
  const layout={linhas,fonte,x,y,anchor:esquerda?"start":"middle"};
  rotulosPorNo.set(no,{w,h,texto:no.texto,layout});
  return layout;
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

const dialogoConfirmacao=document.getElementById("dialogoConfirmacao");
function confirmarAcao(titulo,alvo,mensagem,acao){
  if(dialogoConfirmacao.open) return Promise.resolve(false);
  document.getElementById("tituloConfirmacao").textContent=titulo;
  document.getElementById("alvoConfirmacao").textContent=alvo;
  document.getElementById("mensagemConfirmacao").textContent=mensagem;
  document.getElementById("confirmarAcao").textContent=acao;
  dialogoConfirmacao.returnValue="cancelar";
  dialogoConfirmacao.showModal();
  return new Promise(resolve=>{
    dialogoConfirmacao.addEventListener("close",()=>resolve(dialogoConfirmacao.returnValue==="confirmar"),{once:true});
  });
}
function quantidadeItens(n,singular,plural){
  return n+" "+(n===1?singular:plural);
}

/* ---------- Persistência ---------- */
function salvarLocal(grupo=null){
  registrarEdicao(grupo);
  try{
    localStorage.setItem(CHAVE_SAVE,JSON.stringify(dadosColecao()));
    return true;
  }catch(e){
    toast("Não foi possível salvar os dados neste navegador.","erro");
    return false;
  }
}
function carregarLocal(){
  try{
    const dados=localStorage.getItem(CHAVE_SAVE);
    if(dados){
      const obj=JSON.parse(dados);
      const colecao=lerColecao(obj);
      estado.diagramas=colecao.diagramas;
      estado.projetos=colecao.projetos;
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
const dialogoNovo=document.getElementById("modalFundo");
function modalFechar(){ dialogoNovo.close(); }
document.getElementById("modalFechar").addEventListener("click",modalFechar);
document.getElementById("modalCancelar").addEventListener("click",modalFechar);
dialogoNovo.addEventListener("click",e=>{ if(e.target===dialogoNovo) modalFechar(); });
for(const botao of document.querySelectorAll("[data-criar]")){
  botao.addEventListener("click",()=>{
    document.getElementById("modalNome").value="";
    document.getElementById("modalTipo").value=botao.dataset.criar;
    dialogoNovo.showModal();
    document.getElementById("modalNome").focus();
  });
}
document.getElementById("modalConfirmar").addEventListener("click",()=>{
  const nome=document.getElementById("modalNome").value.trim();
  const tipo=document.getElementById("modalTipo").value;
  if(!nome){
    const campo=document.getElementById("modalNome");
    campo.value=""; campo.focus(); campo.reportValidity();
    return;
  }
  const diagrama={
    id:novoId("D"),
    nome,
    tipo,
    data:new Date().toLocaleDateString("pt-BR"),
    no:[],
    seta:[]
  };
  document.getElementById("buscaDiagramas").value="";
  estado.diagramas.push(diagrama);
  salvarLocal();
  mostrarColecao(abasBiblioteca[0]);
  modalFechar();
  abrirDiagrama(diagrama.id);
  document.getElementById("ferrSelecionar").focus();
  toast("Diagrama criado — monte seus blocos","sucesso");
});
document.getElementById("modalNome").addEventListener("keydown",e=>{
  if(e.key==="Enter"){ e.preventDefault(); document.getElementById("modalConfirmar").click(); }
});

/* =========================================================================
   Tela inicial: lista de diagramas
   ========================================================================= */
const abasBiblioteca=Array.from(document.querySelectorAll(".abas [role=tab]"));
function mostrarColecao(ativa){
  for(const aba of abasBiblioteca){
    const selecionada=aba===ativa;
    aba.tabIndex=selecionada ? 0 : -1;
    aba.setAttribute("aria-selected",String(selecionada));
    document.getElementById(aba.getAttribute("aria-controls")).hidden=!selecionada;
  }
}
abasBiblioteca.forEach((aba,i)=>{
  aba.addEventListener("click",()=>mostrarColecao(aba));
  aba.addEventListener("keydown",ev=>{
    let alvo;
    if(ev.key==="Home") alvo=abasBiblioteca[0];
    else if(ev.key==="End") alvo=abasBiblioteca.at(-1);
    else if(ev.key==="ArrowLeft" || ev.key==="ArrowRight"){
      const passo=ev.key==="ArrowRight"?1:-1;
      alvo=abasBiblioteca[(i+passo+abasBiblioteca.length)%abasBiblioteca.length];
    }else return;
    ev.preventDefault(); mostrarColecao(alvo); alvo.focus();
  });
});

function renderInicio(){
  const cont=document.getElementById("listaDiagramas");
  cont.innerHTML="";
  document.getElementById("totalDiagramas").textContent=estado.diagramas.length;
  document.getElementById("totalProjetos").textContent=estado.projetos.length;
  const busca=document.getElementById("buscaDiagramas");
  const normalizar=valor=>valor.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const termo=normalizar(busca.value.trim());
  const visiveis=estado.diagramas.filter(d=>normalizar(String(d.nome||"")).includes(termo)).reverse();
  document.getElementById("grupoBusca").hidden=!estado.diagramas.length;
  document.getElementById("btnExportarJSON").disabled=!estado.diagramas.length && !estado.projetos.length;
  renderProjetos();
  const vazio=document.getElementById("vazioDiagramas");
  vazio.hidden=visiveis.length>0;
  vazio.textContent=estado.diagramas.length ? "Nenhum diagrama com esse nome." :
    "Seus diagramas ficam salvos neste navegador. Escolha um tipo acima para criar o primeiro.";
  for(const d of visiveis){
    const cfg=TIPOS[d.tipo]||{nome:d.tipo};
    const card=document.createElement("div");
    card.className="card-diag";
    card.dataset.tipo=d.tipo;
    card.innerHTML=`
      <div class="cabeca">
        <h3>${esc(d.nome)}</h3>
        <span class="pill">${esc(cfg.nome)}</span>
      </div>
      <p class="meta">${d.no.length} ${d.no.length===1?"bloco":"blocos"} · ${d.seta.length} ${d.seta.length===1?"conexão":"conexões"} · ${esc(d.data||"—")}</p>
      <div class="acoes">
        <button class="btn btn-primario" type="button" data-acao="abrir">Abrir</button>
        <button class="btn btn-perigo" type="button" data-acao="excluir">Excluir</button>
      </div>`;
    card.querySelector("[data-acao=abrir]").addEventListener("click",()=>abrirDiagrama(d.id));
    card.querySelector("[data-acao=excluir]").addEventListener("click",()=>excluirDiagrama(d.id));
    cont.appendChild(card);
  }
}
document.getElementById("buscaDiagramas").addEventListener("input",renderInicio);
async function excluirDiagrama(id){
  const d=estado.diagramas.find(x=>x.id===id);
  if(!d) return;
  const associados=estado.projetos.filter(p=>p.diagramas.includes(id)).length;
  const mensagem=associados
    ? "O diagrama será excluído da biblioteca e removido de "+quantidadeItens(associados,"projeto","projetos")+". Essa ação é permanente."
    : "O diagrama e todo o seu conteúdo serão excluídos permanentemente da biblioteca.";
  if(!await confirmarAcao("Excluir diagrama?",d.nome||"Sem título",mensagem,"Excluir diagrama")) return;
  const diagramasAntes=estado.diagramas, projetosAntes=estado.projetos;
  estado.diagramas=estado.diagramas.filter(x=>x.id!==id);
  estado.projetos=estado.projetos.map(p=>p.diagramas.includes(id)?{...p,diagramas:p.diagramas.filter(item=>item!==id)}:p);
  if(!salvarLocal()){
    estado.diagramas=diagramasAntes; estado.projetos=projetosAntes;
    return;
  }
  renderInicio();
  document.getElementById("abaDiagramas").focus({preventScroll:true});
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
  iniciarHistorico(d);
  aplicarZoomVisual("abrir");
}
function voltarInicio(){
  historico=null;
  estado.diagramaAtualId=null;
  estado.selecionados.clear(); estado.setaSelecionada=null; estado.origemConexao=null;
  document.getElementById("telaEditor").classList.remove("ativa");
  document.getElementById("telaInicio").classList.add("ativa");
  renderInicio();
}
const alternarPaleta=document.getElementById("alternarPaleta");
alternarPaleta.addEventListener("click",()=>{
  const painel=document.getElementById("painelBlocos");
  painel.hidden=!painel.hidden;
  alternarPaleta.setAttribute("aria-expanded",String(!painel.hidden));
  document.getElementById("layoutEditor").classList.toggle("sem-paleta",painel.hidden);
  render();
});
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
    div.innerHTML=`<svg aria-hidden="true" width="44" height="36" viewBox="0 0 ${w} ${h}">${formaSVG(it.id,w,h)}</svg><span class="label">${it.label}</span>`;
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

function aplicarZoomVisual(motivo="zoom"){
  const r=svg.getBoundingClientRect();
  if(!r.width || !r.height) return;
  const w=r.width/estado.zoom, h=r.height/estado.zoom;
  const vb=svg.viewBox.baseVal;
  let x=vb.x,y=vb.y;
  if(motivo==="abrir" || !vb.width || !vb.height){
    x=-w/2; y=-h/2;
  }else if(motivo==="zoom"){
    // Aproxima ou afasta em torno do centro que o usuário está vendo.
    x+=(vb.width-w)/2; y+=(vb.height-h)/2;
  }
  // Quando um painel abre ou fecha, só muda a extensão da área visível.
  svg.setAttribute("viewBox",`${x} ${y} ${w} ${h}`);
  document.getElementById("zoomContador").textContent=Math.round(estado.zoom*100)+"%";
  posicionarInline();
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
/* Geometria do desenho do ator em coordenadas locais. */
function geomAtor(w,h){
  const headR=Math.min(15,(h-40)/4);
  const headY=headR+9;
  const bodyTop=headY+headR+1;
  const bodyBot=h-32;
  const armY=bodyTop+(bodyBot-bodyTop)*0.45;
  const armDx=Math.min(26,w/2-10);
  const legBot=h-4;
  return {headR,headY,bodyTop,bodyBot,armY,armDx,legBot};
}
function areaDoAtor(w,h,texto){
  const nome=texto.getBBox();
  const x=Math.min(0,nome.width ? nome.x-6 : 0);
  const direita=Math.max(w,nome.width ? nome.x+nome.width+6 : w);
  const inferior=Math.max(h,nome.height ? nome.y+nome.height+5 : h);
  return {x,y:0,width:direita-x,height:inferior};
}
function ancoras(no,borda){
  const esquerda=borda.x, direita=borda.x+borda.width;
  const topo=borda.y, inferior=borda.y+borda.height;
  const cx=no.x+(esquerda+direita)/2, cy=no.y+(topo+inferior)/2;
  return {
    topo:{x:cx,y:no.y+topo}, direita:{x:no.x+direita,y:cy},
    inferior:{x:cx,y:no.y+inferior}, esquerda:{x:no.x+esquerda,y:cy}
  };
}
const ladosAtividade=["topo","direita","inferior","esquerda"];

// Preserva as âncoras salvas e atribui as livres mais próximas às setas antigas.
function conexoesAtividade(d,pontosPorNo,gravar=true){
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
  if(alterado && gravar) salvarLocal();
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
function bordaDoAtor(aa,p){
  const x=Math.max(aa.esquerda.x,Math.min(aa.direita.x,p.x));
  const y=Math.max(aa.topo.y,Math.min(aa.inferior.y,p.y));
  const lados=[{x:aa.esquerda.x,y},{x:aa.direita.x,y},{x,y:aa.topo.y},{x,y:aa.inferior.y}];
  return lados.reduce((a,b)=>Math.hypot(b.x-p.x,b.y-p.y)<Math.hypot(a.x-p.x,a.y-p.y)?b:a);
}
function calcularFanout(d,pontosPorNo){
  const atores=new Map(d.no.filter(no=>no.tipo==="ator").map(no=>[no.id,no]));
  const lados=new Map(), pares=new Map();
  function registrar(id,ponto,alvo,seta){
    const aa=pontosPorNo.get(id);
    const ator=atores.get(id);
    const manual=id===seta.de ? seta.pontoDe : seta.pontoPara;
    if(ator && manual){
      Object.assign(ponto,bordaDoAtor(aa,{x:ator.x+manual.x,y:ator.y+manual.y}));
    }
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
    if(!ator) ponto[normal]+=4*sinal;
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
function posicionarRotulo(tracado,largura,comTexto,ocupados,condicao=false){
  let melhor, menor=Infinity;
  for(const t of [.5,.35,.65,.2,.8]){
    let {x,y}=tracado.ponto(t);
    if(condicao){
      // Mantém a condição acima da tangente local ou ao lado de uma saída vertical.
      const a=tracado.ponto(t-.001),b=tracado.ponto(t+.001);
      const dx=b.x-a.x,dy=b.y-a.y,comprimento=Math.hypot(dx,dy);
      const sentido=dx===0 ? Math.sign(dy)||1 : Math.sign(dx);
      const nx=comprimento ? sentido*dy/comprimento : 0;
      const ny=comprimento ? -sentido*dx/comprimento : -1;
      const distancia=Math.abs(nx)*largura/2+Math.abs(ny)*9+5;
      x+=nx*distancia; y+=ny*distancia;
    }
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

// Mede o contorno visível em coordenadas locais uma vez considerando o tamanho atual do bloco.
const contornosPorNo=new WeakMap();
function medirContorno(no,grupo){
  const {w,h}=dimensoesNo(no);
  const anterior=contornosPorNo.get(no);
  if(anterior?.w===w && anterior.h===h) return;
  const formas=[grupo.querySelector(".forma-pre")];
  const contornos=Array.from(formas,forma=>{
    const comprimento=forma.getTotalLength();
    const n=Math.max(1,Math.ceil(comprimento/3));
    return Array.from({length:n+1},(_,i)=>forma.getPointAtLength(comprimento*i/n));
  });
  contornosPorNo.set(no,{w,h,contornos});
}
function encaixeNoContorno(no,alvo){
  if(no.tipo==="ator") return bordaDoAtor(ancorasRender.get(no.id),alvo);
  const x=alvo.x-no.x,y=alvo.y-no.y;
  let melhor,menor=Infinity;
  for(const parte of contornosPorNo.get(no).contornos){
    for(let i=1;i<parte.length;i++){
      const a=parte[i-1],b=parte[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
      const px=a.x+t*dx,py=a.y+t*dy,dist=(px-x)**2+(py-y)**2;
      if(dist<menor){menor=dist;melhor={x:no.x+px,y:no.y+py};}
    }
  }
  return melhor;
}
// Pontas antigas guardavam coordenadas locais relativas ao tamanho padrão.
function extremidadeNo(no,manual,automatica){
  if(!manual) return encaixeNoContorno(no,automatica);
  const {w,h}=dimensoesNo(no);
  const base=dimsPadrao(no.tipo);
  if(recuoCircular[formaDoTipo(no.tipo)]){
    const dx=manual.x-(manual.w||base.w)/2, dy=manual.y-(manual.h||base.h)/2;
    const escala=(h/2-recuoCircular[formaDoTipo(no.tipo)])/(Math.hypot(dx,dy)||1);
    return {x:no.x+w/2+dx*escala,y:no.y+h/2+dy*escala};
  }
  return encaixeNoContorno(no,{
    x:no.x+manual.x*w/(manual.w||base.w),
    y:no.y+manual.y*h/(manual.h||base.h)
  });
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
const organizarBlocos=document.getElementById("organizarBlocos");
const distribuirBlocos=document.getElementById("distribuirBlocos");

function organizarSelecao(d,eixo,modo){
  // As âncoras medem o contorno que aparece no canvas, inclusive nos blocos redimensionados.
  const horizontal=eixo==="x";
  const medidas=[];
  for(const no of d.no){
    if(!estado.selecionados.has(no.id)) continue;
    const a=ancorasRender.get(no.id);
    if(!a) return;
    const inicio=horizontal?a.esquerda.x:a.topo.y;
    const fim=horizontal?a.direita.x:a.inferior.y;
    medidas.push({no,inicio,fim});
  }
  const distribuir=modo==="espaco";
  if(medidas.length<(distribuir?3:2)) return;
  const inicioGrupo=medidas.reduce((min,m)=>Math.min(min,m.inicio),Infinity);
  const fimGrupo=medidas.reduce((max,m)=>Math.max(max,m.fim),-Infinity);
  const movimentos=new Map();
  if(distribuir){
    medidas.sort((a,b)=>a.inicio-b.inicio);
    const ocupado=medidas.reduce((soma,m)=>soma+m.fim-m.inicio,0);
    // Se não houver espaço, expande a partir da primeira caixa para evitar sobreposição.
    const espacoLivre=fimGrupo-inicioGrupo-ocupado;
    const intervalo=espacoLivre>0?espacoLivre/(medidas.length-1):24;
    let cursor=inicioGrupo;
    for(const m of medidas){
      movimentos.set(m.no.id,cursor-m.inicio);
      cursor+=m.fim-m.inicio+intervalo;
    }
  }else{
    for(const m of medidas){
      let delta;
      if(modo==="inicio") delta=inicioGrupo-m.inicio;
      else if(modo==="fim") delta=fimGrupo-m.fim;
      else delta=(inicioGrupo+fimGrupo-m.inicio-m.fim)/2;
      movimentos.set(m.no.id,delta);
    }
  }
  if(!medidas.some(m=>Math.abs(movimentos.get(m.no.id))>0.000001)) return;
  for(const {no} of medidas) no[eixo]+=movimentos.get(no.id);

  // Em uma curva interna à seleção, as dobras acompanham gradualmente os dois extremos.
  for(const seta of d.seta){
    if(!seta.dobras?.length || !movimentos.has(seta.de) || !movimentos.has(seta.para)) continue;
    const de=movimentos.get(seta.de), para=movimentos.get(seta.para);
    seta.dobras.forEach((p,i)=>{p[eixo]+=de+(para-de)*(i+1)/(seta.dobras.length+1);});
  }
  salvarLocal();
  render();
}

organizarBlocos.addEventListener("change",()=>{
  const [eixo,modo]=organizarBlocos.value.split("-");
  organizarBlocos.value="";
  const d=diagramaAtual();
  if(d && estado.ferramenta==="selecionar") organizarSelecao(d,eixo,modo);
  svg.focus({preventScroll:true});
});
const alcasLinha=document.getElementById("alcasLinha");
const tipoLinha=document.getElementById("tipoLinha");
let gestoLinha=null;
function setaAtual(){
  return diagramaAtual()?.seta.find(s=>s.id===estado.setaSelecionada);
}
const campoCondicao=document.getElementById("campoCondicao");
function saidaDecisao(d,s){
  return d.tipo==="atividades" && s && d.no.some(n=>n.id===s.de && n.tipo==="decisao");
}
campoCondicao.addEventListener("input",()=>{
  const s=setaAtual();
  if(!s) return;
  s.rotulo=campoCondicao.value;
  salvarLocal("condicao:"+s.id); render();
});
campoCondicao.addEventListener("keydown",ev=>{
  if(ev.key==="Enter"){ev.preventDefault();svg.focus({preventScroll:true});}
});
function atualizarControlesLinha(d){
  const s=setaAtual(), tipos=TIPOS[d.tipo].conexoes;
  const condicao=Boolean(saidaDecisao(d,s));
  document.getElementById("grupoCondicao").hidden=!condicao;
  if(condicao && campoCondicao.value!==(s.rotulo||"")) campoCondicao.value=s.rotulo||"";
  if(condicao) document.getElementById("btnEditarTexto").hidden=true;
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
  else s[origem?"pontoDe":"pontoPara"]={x:p.x-no.x,y:p.y-no.y,...dimensoesNo(no)};
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

function render(d=diagramaAtual(),paraPDF=false){
  if(!d) return;
  // remove conexões órfãs (um dos blocos não existe mais) — evita setas invisíveis
  // que não podem ser clicadas nem excluídas
  const antesSetas=d.seta.length;
  d.seta=d.seta.filter(s=>d.no.some(n=>n.id===s.de)&&d.no.some(n=>n.id===s.para));
  if(!paraPDF && d.seta.length!==antesSetas) salvarLocal();
  const pontosPorNo=ancorasRender;
  pontosPorNo.clear();
  alcasLinha.replaceChildren();
  camadaNos.innerHTML="";
  for(const no of d.no){
    const {w,h}=dimensoesNo(no);
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    const origemAtiva=!paraPDF&&estado.ferramenta==="conectar"&&estado.origemConexao===no.id;
    g.setAttribute("class","no-grp"+(!paraPDF&&estado.selecionados.has(no.id)?" selecionado":"")+(origemAtiva?" origem":""));
    g.setAttribute("transform",`translate(${no.x},${no.y})`);
    g.setAttribute("data-id",no.id);
    g.innerHTML=formaSVG(no.tipo,w,h);
    camadaNos.appendChild(g);
    const forma=formaDoTipo(no.tipo);
    const caixa=formasDeCaixa.has(forma);
    const circular=Boolean(recuoCircular[forma]);
    const texto=document.createElementNS("http://www.w3.org/2000/svg","text");
    texto.setAttribute("class","no-texto");
    const pos=posicaoTexto(no,w,h);
    const layout=caixa ? comporRotulo(no,w,h) : {
      x:pos.tx,y:pos.ty,anchor:"middle",linhas:(no.texto||"").split("\n")
    };
    texto.setAttribute("text-anchor",layout.anchor);
    texto.setAttribute("x",layout.x);
    texto.setAttribute("y",layout.y);
    if(caixa) texto.setAttribute("font-size",layout.fonte);
    layout.linhas.forEach((ln,i)=>{
      const ts=document.createElementNS("http://www.w3.org/2000/svg","tspan");
      ts.setAttribute("x",layout.x);
      ts.setAttribute("y",layout.y+i*(caixa?layout.fonte*1.25:15));
      ts.textContent=ln;
      texto.appendChild(ts);
    });
    g.appendChild(texto);
    const ator=no.tipo==="ator";
    const borda=ator ? areaDoAtor(w,h,texto) : g.querySelector(".forma-pre").getBBox();
    const aa=ancoras(no,borda);
    pontosPorNo.set(no.id,aa);
    if(!ator && d.tipo!=="atividades") medirContorno(no,g);
  // área de clique: cobre todo o box do bloco (transparente) — permite clicar e
  // arrastar em qualquer ponto do bloco, inclusive em áreas vazias da figura do ator
  const hit=document.createElementNS("http://www.w3.org/2000/svg","rect");
  hit.setAttribute("class",ator?"hit-no area-ator":"hit-no");
  hit.setAttribute("x",ator||circular?borda.x:0); hit.setAttribute("y",0);
  hit.setAttribute("width",ator||circular?borda.width:w); hit.setAttribute("height",ator?borda.height:h);
  hit.setAttribute("rx",ator?0:4);
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

    if(!paraPDF && caixa && estado.ferramenta==="selecionar" &&
       estado.selecionados.size===1 && estado.selecionados.has(no.id)){
      const alca=document.createElementNS(svg.namespaceURI,"rect");
      alca.setAttribute("class","alca-tamanho");
      const direita=circular?borda.x+borda.width:w;
      const inferior=circular?borda.y+borda.height:h;
      alca.setAttribute("x",direita-7); alca.setAttribute("y",inferior-7);
      alca.setAttribute("width",14); alca.setAttribute("height",14);
      alca.setAttribute("rx",3);
      const titulo=document.createElementNS(svg.namespaceURI,"title");
      titulo.textContent="Arraste para redimensionar o bloco";
      alca.appendChild(titulo);
      alca.onpointerdown=ev=>iniciarTamanho(ev,no);
      g.appendChild(alca);
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
  const fanout=d.tipo==="atividades" ? conexoesAtividade(d,pontosPorNo,!paraPDF) : calcularFanout(d,pontosPorNo);
  const nosPorId=new Map(d.no.map(no=>[no.id,no]));
  for(const s of d.seta){
    const par=fanout.get(s.id);
    if(!par) continue;
    if(d.tipo!=="atividades"){
      const a=nosPorId.get(s.de),b=nosPorId.get(s.para);
      if(a.tipo!=="ator") par.p1=extremidadeNo(a,s.pontoDe,par.p1);
      if(b.tipo!=="ator") par.p2=extremidadeNo(b,s.pontoPara,par.p2);
    }
    const gesto=gestoLinha?.id===s.id ? gestoLinha : null;
    if(gesto?.pos && gesto.acao==="de") par.p1=gesto.pos;
    if(gesto?.pos && gesto.acao==="para") par.p2=gesto.pos;
    const dobras=gesto?.dobras || s.dobras || [];
    const tracado=tracadoLinha(par.p1,par.p2,dobras);
    const dPath=tracado.caminho;
    const sel=!paraPDF&&estado.setaSelecionada===s.id;
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
      const {x,y}=posicionarRotulo(tracado,Math.max(larguraMarca,larguraTexto),Boolean(texto),ocupados,
        d.tipo==="atividades" && nosPorId.get(s.de)?.tipo==="decisao");
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
  if(paraPDF) return;
  const dica=document.getElementById("dicaCanvas");
  dica.hidden=d.no.length>0;
  if(!d.no.length) dica.textContent=document.getElementById("painelBlocos").hidden ?
    "Abra Blocos para adicionar a primeira forma." : "Escolha um bloco na paleta para começar.";
  const info=document.getElementById("infoSelecionado");
  const quantidade=estado.selecionados.size;
  document.getElementById("acoesSelecao").hidden=!quantidade && !estado.setaSelecionada;
  organizarBlocos.hidden=quantidade<2 || estado.ferramenta!=="selecionar";
  distribuirBlocos.disabled=quantidade<3;
  document.getElementById("btnEditarTexto").hidden=quantidade>1;
  info.textContent=estado.setaSelecionada ? "Seta selecionada" :
    quantidade===1 ? "Bloco selecionado" : quantidade+" blocos selecionados";
  atualizarCamposTamanho(d);
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
  salvarLocal("ator:"+no.id); render();
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
  if(forma==="barra"){tx=w/2;ty=h+18;}
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
  const wrap=document.getElementById("canvasWrap");
  const caixa=formasDeCaixa.has(formaDoTipo(no.tipo));
  const input=document.createElement(caixa?"textarea":"input");
  input.className="editor-inline";
  input.setAttribute("aria-label","Texto do bloco");
  if(caixa) input.rows=2;
  input.maxLength=120;
  input.value=textoDoBloco(no);
  input.style.transform="translateX(-50%)";
  wrap.appendChild(input);
  inlineEdit={input,no,original:no.texto||""};
  posicionarInline();
  input.focus({preventScroll:true}); input.select();
  input.addEventListener("input",()=>{
    no.texto=input.value;
    render();
  });
  input.addEventListener("keydown",ev=>{
    if(ev.key==="Enter" && !(caixa && ev.shiftKey) && !ev.isComposing){ ev.preventDefault(); fecharInline(); salvarLocal(); }
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
  const {w,h}=dimensoesNo(no);
  const caixa=formasDeCaixa.has(formaDoTipo(no.tipo));
  const {tx,ty}=caixa ? {tx:w/2,ty:h/2} : posicaoTexto(no,w,h);
  const p=mundoParaWrap(no.x+tx, no.y+ty);
  const largura=caixa ? w*estado.zoom-8 : Math.max(120,(no.texto||"").length*8+24);
  inlineEdit.input.style.width=Math.min(svg.clientWidth,Math.max(50,largura))+"px";
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
  const condicao=saidaDecisao(d,seta);
  if(condicao){estado.selecionados.clear();estado.setaSelecionada=seta.id;}
  render(); salvarLocal();
  if(condicao) campoCondicao.focus({preventScroll:true});
  else toast("Seta criada ✓","sucesso");
}
async function excluirSelecionados(){
  const d=diagramaAtual();
  if(!d) return;
  const ids=new Set(estado.selecionados);
  const nos=d.no.filter(n=>ids.has(n.id));
  const setas=d.seta.filter(s=>ids.has(s.de)||ids.has(s.para)||s.id===estado.setaSelecionada);
  if(!nos.length && !setas.length){toast("Nada selecionado para excluir.","erro");return;}
  const nomeNo=no=>textoDoBloco(no).trim() || TIPOS[d.tipo].paleta.find(item=>item.id===no.tipo)?.label || "Bloco";
  let alvo,acao;
  if(nos.length){
    alvo=nos.length===1 ? nomeNo(nos[0]) : quantidadeItens(nos.length,"bloco selecionado","blocos selecionados");
    acao=nos.length===1 ? "Excluir bloco" : "Excluir blocos";
  }else{
    const seta=setas[0], origem=d.no.find(n=>n.id===seta.de), destino=d.no.find(n=>n.id===seta.para);
    alvo=origem && destino ? nomeNo(origem)+" → "+nomeNo(destino) : "Conexão selecionada";
    acao="Excluir conexão";
  }
  const mensagem=nos.length && setas.length
    ? "A exclusão inclui "+quantidadeItens(setas.length,"conexão","conexões")+". Você pode desfazer essa alteração no editor."
    : "Você pode desfazer essa alteração no editor.";
  if(!await confirmarAcao(acao+"?",alvo,mensagem,acao)) return;
  d.no=d.no.filter(n=>!ids.has(n.id));
  const removidas=new Set(setas.map(s=>s.id));
  d.seta=d.seta.filter(s=>!removidas.has(s.id));
  estado.selecionados.clear(); estado.setaSelecionada=null;
  if(ids.has(estado.origemConexao)){estado.origemConexao=null;estado.ancoraOrigem=null;}
  const salvo=salvarLocal();
  render(); svg.focus({preventScroll:true});
  if(salvo) toast("Seleção excluída","sucesso");
}
function adicionarBloco(tipo,x,y){
  const d=diagramaAtual();
  if(x===undefined||y===undefined){
    const vista=svg.viewBox.baseVal;
    x=vista.x+vista.width/2; y=vista.y+vista.height/2;
  }
  const dim=dimsPadrao(tipo);
  const no={id:novoId(),tipo,x:Math.round(x-dim.w/2),y:Math.round(y-dim.h/2),texto:formaDoTipo(tipo)==="limite"?"Sistema":""};
  d.no.push(no);
  estado.selecionados.clear(); estado.selecionados.add(no.id);
  estado.setaSelecionada=null;
  render(); salvarLocal();
  return no;
}

const camposTamanho=document.getElementById("camposTamanho");
function caixaSelecionada(d){
  if(!d || estado.selecionados.size!==1 || estado.ferramenta!=="selecionar") return;
  return d.no.find(n=>estado.selecionados.has(n.id) && formasDeCaixa.has(formaDoTipo(n.tipo)));
}
function atualizarCamposTamanho(d){
  const no=caixaSelecionada(d);
  camposTamanho.hidden=!no;
  if(no){
    const dim=dimensoesNo(no);
    const recuo=recuoCircular[formaDoTipo(no.tipo)];
    for(const campo of camposTamanho.querySelectorAll("input")){
      const diametro=campo.name==="diametro";
      campo.parentElement.hidden=diametro!==Boolean(recuo);
      if(!campo.parentElement.hidden) campo.value=diametro?dim.h-2*recuo:dim[campo.name];
    }
  }
}
camposTamanho.addEventListener("change",ev=>{
  const d=diagramaAtual(),no=caixaSelecionada(d),campo=ev.target;
  if(!no || !Object.hasOwn(tamanhoMinimo,campo.name)) return;
  if(Number.isFinite(campo.valueAsNumber)){
    no[campo.name]=limitarTamanho(campo.name,campo.valueAsNumber);
    salvarLocal();
  }
  render();
});
function iniciarTamanho(ev,no){
  ev.stopPropagation();
  if(!ev.isPrimary || ev.button!==0 || gestoTamanho) return;
  ev.preventDefault();
  const tamanho=dimensoesNo(no);
  gestoTamanho={no,id:ev.pointerId,inicio:posMundo(ev.clientX,ev.clientY),tamanho,atual:tamanho};
  camadaNos.setPointerCapture(ev.pointerId);
}
function moverTamanho(ev){
  const g=gestoTamanho;
  if(!g || ev.pointerId!==g.id) return;
  const p=posMundo(ev.clientX,ev.clientY);
  const dx=p.x-g.inicio.x,dy=p.y-g.inicio.y;
  const recuo=recuoCircular[formaDoTipo(g.no.tipo)];
  if(recuo){
    const delta=(dx+dy)/2;
    g.atual=dimensoesCirculo(g.no.tipo,g.tamanho.h-2*recuo+delta);
  }else{
    g.atual={w:limitarTamanho("w",g.tamanho.w+dx),h:limitarTamanho("h",g.tamanho.h+dy)};
  }
}
camadaNos.addEventListener("pointermove",ev=>{
  if(gestoTamanho?.id!==ev.pointerId) return;
  moverTamanho(ev); render();
});
function terminarTamanho(ev){
  const g=gestoTamanho;
  if(!g || ev.pointerId!==g.id) return;
  if(ev.type==="pointerup"){
    moverTamanho(ev);
    if(g.atual.w!==g.tamanho.w || g.atual.h!==g.tamanho.h){
      const recuo=recuoCircular[formaDoTipo(g.no.tipo)];
      if(recuo) g.no.diametro=g.atual.h-2*recuo;
      else Object.assign(g.no,g.atual);
      salvarLocal();
    }
  }
  gestoTamanho=null; render();
}
for(const evento of ["pointerup","pointercancel","lostpointercapture"])
  camadaNos.addEventListener(evento,terminarTamanho);

/* ---------- Arrastar blocos e pan ---------- */
svg.addEventListener("pointerdown",ev=>{
  if(ev.button!==0 || !ev.isPrimary || estado.ferramenta!=="selecionar" || estado.origemConexao) return;
  if(ev.target.closest(".no-grp,.seta-grp,#alcasLinha")) return;
  const ponteiro=ev.pointerId;
  const inicio=posMundo(ev.clientX,ev.clientY);
  let moveu=false;
  svg.setPointerCapture(ponteiro);
  svg.classList.add("arrastando-bg");
  const mover=e=>{
    if(e.pointerId!==ponteiro) return;
    if(!moveu && Math.hypot(e.clientX-ev.clientX,e.clientY-ev.clientY)<3) return;
    moveu=true;
    const p=posMundo(e.clientX,e.clientY), vb=svg.viewBox.baseVal;
    svg.setAttribute("viewBox",`${vb.x+inicio.x-p.x} ${vb.y+inicio.y-p.y} ${vb.width} ${vb.height}`);
    posicionarInline();
  };
  const fim=e=>{
    if(e.pointerId!==ponteiro) return;
    if(moveu && e.type==="pointerup") arrastoReal=true;
    svg.classList.remove("arrastando-bg");
    svg.removeEventListener("pointermove",mover);
    svg.removeEventListener("pointerup",fim);
    svg.removeEventListener("pointercancel",fim);
    svg.removeEventListener("lostpointercapture",fim);
  };
  svg.addEventListener("pointermove",mover);
  svg.addEventListener("pointerup",fim);
  svg.addEventListener("pointercancel",fim);
  svg.addEventListener("lostpointercapture",fim);
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
  if(ev.target===camadaNos || ev.target.closest(".no-grp,.seta-grp")) return;
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
document.getElementById("ferrLimpar").addEventListener("click",async ()=>{
  const d=diagramaAtual();
  if(d.no.length===0&&d.seta.length===0){ toast("O canvas já está vazio.","erro"); return;}
  const itens=quantidadeItens(d.no.length,"bloco","blocos")+" e "+quantidadeItens(d.seta.length,"conexão","conexões");
  if(!await confirmarAcao("Limpar diagrama?",d.nome||"Sem título","Remover "+itens+" da área de desenho? Você pode desfazer essa alteração no editor.","Limpar diagrama")) return;
  d.no=[]; d.seta=[]; estado.selecionados.clear(); estado.setaSelecionada=null;
  estado.origemConexao=null; estado.ancoraOrigem=null;
  const salvo=salvarLocal();
  render(); svg.focus({preventScroll:true});
  if(salvo) toast("Diagrama limpo","sucesso");
});
document.getElementById("tituloDiagrama").addEventListener("input",e=>{
  const d=diagramaAtual(); if(!d) return;
  d.nome=e.target.value; salvarLocal("titulo");
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
function bboxDoCanvas(d=diagramaAtual()){
  if(!d) return {x:0,y:0,w:800,h:600};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const no of d.no){
    const dim=dimensoesNo(no);
    minX=Math.min(minX,no.x); minY=Math.min(minY,no.y);
    maxX=Math.max(maxX,no.x+dim.w); maxY=Math.max(maxY,no.y+dim.h);
    if(no.tipo==="barra") maxY=Math.max(maxY,no.y+dim.h+28);
    if(no.tipo==="ator"){
      const aa=ancorasRender.get(no.id);
      minX=Math.min(minX,aa.esquerda.x); maxX=Math.max(maxX,aa.direita.x);
      maxY=Math.max(maxY,aa.inferior.y);
    }
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
.forma-pre{stroke:${formato==="png" ? cor("--borda-2") : cor("--contorno")};stroke-width:2}
.forma-oval,.forma-alvo-ext,.forma-barra{fill:${cor("--primario")}}
.forma-alvo-int{fill:${cor("--panel")};stroke:${cor("--primario")}}
.forma-decisao,.forma-ret,.forma-ret-vaz,.forma-elipse,.forma-limite,.forma-nota{fill:${cor("--panel")}}
.forma-ator{fill:none;stroke:${cor("--texto-2")}}
.no-texto{fill:${cor("--texto")};font-family:"Segoe UI",system-ui,sans-serif;user-select:none}
.forma-oval + .no-texto{fill:${cor("--panel")}}
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
.conector-caixa{fill:white}
.conector-marca,.conector-marca-pequena{font-family:"Segoe UI",system-ui,sans-serif}
.conector-marca-pequena{font-size:10px}` : ""}
`;
}
function construirSVGExport(formato,d=diagramaAtual()){
  const bb=bboxDoCanvas(d);
  const clone=svg.cloneNode(true);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  clone.querySelector("#gradePlano")?.remove();
  clone.querySelector("#alcasLinha")?.remove();
  const contNos=clone.querySelector("#camadaNos");
  if(contNos) contNos.querySelectorAll(".ancora,.hit-no,.alca-tamanho").forEach(n=>n.remove());
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
/* Gera a imagem PNG do diagrama (mesmo pipeline do export PNG: SVG -> canvas,
   escala 2). Retorna Promise com {blob, w, h} (w/h = pixels da imagem). */
function pngDoDiagrama(){
  const {svg:clone,bb}=construirSVGExport("png");
  const ser=new XMLSerializer().serializeToString(clone);
  const url=URL.createObjectURL(new Blob([ser],{type:"image/svg+xml;charset=utf-8"}));
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const scale=2;
      const canvas=document.createElement("canvas");
      canvas.width=bb.w*scale; canvas.height=bb.h*scale;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b=>resolve({blob:b,w:canvas.width,h:canvas.height}),"image/png");
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("falha ao renderizar o diagrama")); };
    img.src=url;
  });
}
function exportar(tipo){
  const d=diagramaAtual();
  if(!d||d.no.length===0){ toast("Adicione blocos antes de exportar.","erro"); return;}
  if(tipo==="svg"){
    const {svg:clone}=construirSVGExport("svg");
    download(nomeArquivo(d.nome,".svg"),new XMLSerializer().serializeToString(clone),"image/svg+xml;charset=utf-8");
    toast("SVG exportado ✓","sucesso");
  }else{
    pngDoDiagrama().then(({blob})=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob); a.download=nomeArquivo(d.nome,".png");
      document.body.appendChild(a); a.click();
      setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); },300);
      toast("PNG exportado ✓","sucesso");
    }).catch(()=>toast("Falha ao exportar PNG.","erro"));
  }
}
/* =========================================================================
   Exportação em .docx (Word) — puro cliente, sem dependências
   Um .docx é um ZIP com arquivos XML. Aqui:
   - zipStored: escritor ZIP mínimo (método stored, sem compactação)
   - exportarDocx: monta o pacote DOCX com o diagrama embutido como imagem PNG
   ========================================================================= */
/* Escritor ZIP mínimo (entradas stored, sem compactação). CRC32 + cabeçalhos
   local/central/final. Suficiente para arquivos DOCX (Word aceita stored). */
function zipStored(entradas){
  const encoder=new TextEncoder();
  const crcTable=(()=>{
    const t=new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      t[i]=c>>>0;
    }
    return t;
  })();
  const crc32=u8=>{
    let c=0xFFFFFFFF;
    for(let i=0;i<u8.length;i++) c=crcTable[(c^u8[i])&0xFF]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0;
  };
  const agora=new Date();
  const dosTime=((agora.getHours()&0x1F)<<11)|((agora.getMinutes()&0x3F)<<5)|((agora.getSeconds()/2)&0x1F);
  const dosDate=(((agora.getFullYear()-1980)&0x7F)<<9)|(((agora.getMonth()+1)&0xF)<<5)|(agora.getDate()&0x1F);
  const blobs=[]; const central=[]; let offset=0;
  for(const e of entradas){
    const nomeU=encoder.encode(e.nome);
    const dados=e.dados;
    const crc=crc32(dados);
    const local=new Uint8Array(30+nomeU.length);
    const lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0,true);
    lv.setUint16(8,0,true); lv.setUint16(10,0,true); lv.setUint16(12,dosTime,true);
    lv.setUint16(14,dosDate,true); lv.setUint32(16,crc,true);
    lv.setUint32(20,dados.length,true); lv.setUint32(24,dados.length,true);
    lv.setUint16(28,nomeU.length,true); lv.setUint16(30,0,true);
    local.set(nomeU,30);
    blobs.push(local,dados);
    const cd=new Uint8Array(46+nomeU.length);
    const cv=new DataView(cd.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0,true); cv.setUint16(10,0,true); cv.setUint16(12,dosTime,true);
    cv.setUint16(14,dosDate,true); cv.setUint32(16,crc,true);
    cv.setUint32(20,dados.length,true); cv.setUint32(24,dados.length,true);
    cv.setUint16(28,nomeU.length,true); cv.setUint16(30,0,true);
    cv.setUint16(32,0,true); cv.setUint16(34,0,true); cv.setUint16(36,0,true);
    cv.setUint32(38,0,true); cv.setUint32(42,offset,true);
    cd.set(nomeU,46);
    central.push(cd);
    offset+=local.length+dados.length;
  }
  const cdTotal=central.reduce((s,c)=>s+c.length,0);
  const cdBlob=new Uint8Array(cdTotal);
  let cdOff=0;
  for(const c of central){ cdBlob.set(c,cdOff); cdOff+=c.length; }
  const end=new Uint8Array(22);
  const ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(4,0,true); ev.setUint16(6,0,true);
  ev.setUint16(8,entradas.length,true); ev.setUint16(10,entradas.length,true);
  ev.setUint32(12,cdTotal,true); ev.setUint32(16,offset,true); ev.setUint16(20,0,true);
  const total=blobs.reduce((s,b)=>s+b.length,0)+cdTotal+end.length;
  const out=new Uint8Array(total);
  let o=0;
  for(const b of blobs){ out.set(b,o); o+=b.length; }
  out.set(cdBlob,o); o+=cdTotal;
  out.set(end,o);
  return out;
}
/* Escape para texto XML do Word */
function escDocx(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
/* Exporta o diagrama atual como .docx: documento Word com o título, uma
   legenda e a imagem do diagrama embutida (redimensionada para a página). */
function exportarDocx(){
  const d=diagramaAtual();
  if(!d||d.no.length===0){ toast("Adicione blocos antes de exportar.","erro"); return; }
  pngDoDiagrama().then(({blob,w,h})=>{
    return blob.arrayBuffer().then(buf=>{
      const png=new Uint8Array(buf);
      const cfg=TIPOS[d.tipo]||{nome:d.tipo};
      // tamanho da imagem na página: no maximo a largura util (6.5in = 5943600 EMU)
      const PAGE_W=6.5*914400;
      const cx=Math.min(w*9525, PAGE_W);
      const cy=Math.round(cx*h/w);
      const titulo=escDocx(d.nome);
      const legenda=escDocx(`Diagrama de ${cfg.nome} — ${d.no.length} bloco(s), ${d.seta.length} conexão(ões)`+(d.data?` — ${d.data}`:""));
      const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
      const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
      const docRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;
      const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${titulo}</w:t></w:r></w:p>
<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">${legenda}</w:t></w:r></w:p>
<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/>
<wp:docPr id="1" name="Diagrama"/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr><pic:cNvPr id="1" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic>
</a:graphicData></a:graphic>
</wp:inline></w:drawing></w:r></w:p>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`;
      const encoder=new TextEncoder();
      const zip=zipStored([
        {nome:"[Content_Types].xml", dados:encoder.encode(contentTypes)},
        {nome:"_rels/.rels", dados:encoder.encode(rels)},
        {nome:"word/document.xml", dados:encoder.encode(documentXml)},
        {nome:"word/_rels/document.xml.rels", dados:encoder.encode(docRels)},
        {nome:"word/media/image1.png", dados:png}
      ]);
      download(nomeArquivo(d.nome,".docx"),
        new Blob([zip],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      toast("DOCX exportado ✓","sucesso");
    });
  }).catch(()=>toast("Falha ao exportar DOCX.","erro"));
}
document.getElementById("btnExportarSVG").addEventListener("click",()=>exportar("svg"));
document.getElementById("btnExportarPNG").addEventListener("click",()=>exportar("png"));
document.getElementById("btnExportarDOCX").addEventListener("click",exportarDocx);
document.getElementById("btnExportarJSON").addEventListener("click",()=>{
  download(nomeArquivo("editor-diagramas",".json"),JSON.stringify(dadosColecao(),null,2),"application/json");
  toast("JSON exportado ✓","sucesso");
});
document.getElementById("btnImportarJSON").addEventListener("click",()=>document.getElementById("arquivoJSON").click());
document.getElementById("arquivoJSON").addEventListener("change",e=>{
  const arquivo=e.target.files[0]; if(!arquivo) return;
  const leitor=new FileReader();
  leitor.onload=async ()=>{
    try{
      const obj=JSON.parse(leitor.result);
      const colecao=lerColecao(obj);
      if((estado.diagramas.length || estado.projetos.length) && !await confirmarAcao("Substituir biblioteca?",arquivo.name,"Os diagramas e projetos salvos neste navegador serão substituídos pelos deste arquivo.","Substituir biblioteca")){
        e.target.value="";
        return;
      }
      document.getElementById("buscaDiagramas").value="";
      estado.diagramas=colecao.diagramas;
      estado.projetos=colecao.projetos;
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
// Histórico da sessão de edição atual. Cada salvamento registra o desenho uma vez.
let historico=null, copiaDiagrama=null;
const desfazer=document.getElementById("desfazer"),refazer=document.getElementById("refazer");
function atualizarBotoesHistorico(){
  desfazer.disabled=!historico?.antes.length;
  refazer.disabled=!historico?.depois.length;
}
desfazer.addEventListener("click",()=>restaurarEdicao(false));
refazer.addEventListener("click",()=>restaurarEdicao(true));
function iniciarHistorico(d){
  historico={id:d.id,atual:JSON.stringify(d),antes:[],depois:[],grupo:null};
  atualizarBotoesHistorico();
}
function registrarEdicao(grupo){
  const d=diagramaAtual();
  if(!d || d.id!==historico?.id) return;
  const atual=JSON.stringify(d);
  if(historico.atual===atual) return;
  if(!grupo || grupo!==historico.grupo){
    historico.antes.push(historico.atual);
    if(historico.antes.length>80) historico.antes.shift();
  }
  historico.atual=atual; historico.grupo=grupo; historico.depois.length=0;
  atualizarBotoesHistorico();
}
function restaurarEdicao(refazer){
  const h=historico,d=diagramaAtual();
  if(!d || h?.id!==d.id) return;
  const origem=refazer?h.depois:h.antes, destino=refazer?h.antes:h.depois;
  if(!origem.length) return;
  destino.push(h.atual); h.atual=origem.pop(); h.grupo=null;
  atualizarBotoesHistorico();
  Object.assign(d,JSON.parse(h.atual));
  estado.selecionados.clear(); estado.setaSelecionada=null;
  estado.origemConexao=null; estado.ancoraOrigem=null;
  document.getElementById("tituloDiagrama").value=d.nome;
  salvarLocal(); render();
}
function copiarSelecao(d){
  const ids=new Set(estado.selecionados);
  const linha=setaAtual();
  if(!ids.size && linha){ids.add(linha.de); ids.add(linha.para);}
  if(!ids.size) return null;
  const setas=linha && !estado.selecionados.size ? [linha] : d.seta.filter(s=>ids.has(s.de)&&ids.has(s.para));
  return structuredClone({tipo:d.tipo,no:d.no.filter(n=>ids.has(n.id)),seta:setas,colagens:0});
}
function colarSelecao(d,copia){
  if(!copia) return;
  if(d.tipo!==copia.tipo){toast("Cole em um diagrama do mesmo tipo.","erro");return;}
  const ids=new Map(),deslocamento=24*(++copia.colagens);
  const {no,seta}=structuredClone(copia);
  for(const n of no){
    const id=novoId(); ids.set(n.id,id);
    n.id=id; n.x+=deslocamento; n.y+=deslocamento; d.no.push(n);
  }
  for(const s of seta){
    s.id=novoId(); s.de=ids.get(s.de); s.para=ids.get(s.para);
    for(const p of s.dobras||[]){p.x+=deslocamento;p.y+=deslocamento;}
    d.seta.push(s);
  }
  estado.selecionados=new Set(ids.values()); estado.setaSelecionada=null;
  estado.origemConexao=null; estado.ancoraOrigem=null;
  render(); salvarLocal();
}
function atalhoEditor(ev){
  const d=diagramaAtual();
  if(!d || gestoTamanho || ev.defaultPrevented || ev.isComposing || ev.altKey || ev.target.isContentEditable ||
     ev.target.closest?.("input,textarea,select,dialog")) return;
  const tecla=ev.key.toLowerCase();
  if(ev.ctrlKey || ev.metaKey){
    if(!["a","c","v","d","z","y"].includes(tecla) || (ev.shiftKey && tecla!=="z")) return;
    ev.preventDefault();
    if(gestoLinha || arrastagem || ev.repeat) return;
    switch(tecla){
      case "a":
        estado.selecionados=new Set(d.no.map(n=>n.id)); estado.setaSelecionada=null; render();break;
      case "c":{
        const selecao=copiarSelecao(d);
        if(selecao){copiaDiagrama=selecao;toast("Seleção copiada.","sucesso");}
        break;
      }
      case "v": colarSelecao(d,copiaDiagrama);break;
      case "d": colarSelecao(d,copiarSelecao(d));break;
      case "z": restaurarEdicao(ev.shiftKey);break;
      case "y": restaurarEdicao(true);break;
    }
  }else if(tecla==="delete" || tecla==="backspace"){
    if(estado.selecionados.size||estado.setaSelecionada){ev.preventDefault();excluirSelecionados();}
  }else if(tecla==="t") definirFerramenta("selecionar");
  else if(tecla==="c") definirFerramenta("conectar");
}

function init(){
  carregarLocal();
  temaAplicar(temaInicial());
  renderInicio();
  new ResizeObserver(()=>{
    if(diagramaAtual()){
      aplicarZoomVisual("redimensionar");
    }
  }).observe(document.getElementById("canvasWrap"));
  window.addEventListener("keydown",atalhoEditor);
  document.addEventListener("focusout",()=>{if(historico) historico.grupo=null;});
  svg.addEventListener("pointerdown",()=>{
    if(document.activeElement?.matches("#camposTamanho input,#campoCondicao,#campoNomeAtor,#tituloDiagrama,#tipoLinha,#grupoConexoes")) svg.focus({preventScroll:true});
  },true);
}
init();
