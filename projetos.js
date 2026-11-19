"use strict";

// Coleções anteriores contêm apenas um array de diagramas.
function dadosColecao(){
  return estado.projetos.length ? {versao:3,diagramas:estado.diagramas,projetos:estado.projetos} : estado.diagramas;
}
const tiposRequisito={RF:"Requisitos funcionais",RNF:"Requisitos não funcionais"};
function codigoRequisito(r){
  return r.tipo+"-"+String(r.numero).padStart(3,"0");
}
function lerRequisitos(lista=[]){
  if(!Array.isArray(lista)) throw new Error("Lista de requisitos inválida");
  const codigos=new Set();
  return lista.map(r=>{
    if(!r || !Object.hasOwn(tiposRequisito,r.tipo) || !Number.isSafeInteger(r.numero) ||
       r.numero<1 || typeof r.descricao!=="string" || !r.descricao.trim()){
      throw new Error("Requisito inválido");
    }
    const codigo=codigoRequisito(r);
    if(codigos.has(codigo)) throw new Error("Código de requisito repetido");
    codigos.add(codigo);
    return {tipo:r.tipo,numero:r.numero,descricao:r.descricao.trim()};
  });
}
function lerColecao(obj){
  const diagramas=Array.isArray(obj)?obj:obj?.diagramas;
  const projetos=Array.isArray(obj)?[]:obj?.projetos;
  if(!Array.isArray(diagramas)||!Array.isArray(projetos)||
     diagramas.some(d=>!d||!Object.hasOwn(TIPOS,d.tipo)||!Array.isArray(d.no)||!Array.isArray(d.seta))){
    throw new Error("Coleção inválida");
  }
  const ids=new Set(diagramas.map(d=>d.id));
  return {diagramas,projetos:projetos.map(p=>{
    if(!p||typeof p.nome!=="string"||!p.id||!Array.isArray(p.diagramas)) throw new Error("Projeto inválido");
    return {id:p.id,nome:p.nome,requisitos:lerRequisitos(p.requisitos),diagramas:[...new Set(p.diagramas.filter(id=>ids.has(id)))]};
  })};
}

const dialogoProjeto=document.getElementById("dialogoProjeto");
const listaEscolha=document.getElementById("adicionarAoProjeto");
let rascunhoProjeto=null;
let exportandoProjeto=false;
function botaoProjeto(texto,acao,descricao){
  const b=document.createElement("button");
  b.type="button"; b.className="fbtn"; b.textContent=texto;
  if(descricao){b.title=descricao; b.setAttribute("aria-label",descricao);}
  b.addEventListener("click",acao);
  return b;
}
function renderProjetos(){
  const lista=document.getElementById("listaProjetos");
  lista.replaceChildren();
  document.getElementById("semProjetos").hidden=estado.projetos.length>0;
  for(const p of [...estado.projetos].reverse()){
    const card=document.createElement("article"); card.className="card-diag";
    const titulo=document.createElement("h3"); titulo.textContent=p.nome;
    const detalhes=document.createElement("p"); detalhes.className="meta";
    const totalReq=p.requisitos.length;
    detalhes.textContent=quantidadeItens(p.diagramas.length,"diagrama","diagramas")+" · "+quantidadeItens(totalReq,"requisito","requisitos");
    const acoes=document.createElement("div"); acoes.className="arquivos";
    const pdf=botaoProjeto("Baixar PDF",()=>exportarProjeto(p));
    pdf.disabled=exportandoProjeto||(!p.diagramas.length && !totalReq);
    acoes.append(botaoProjeto("Organizar",()=>abrirProjeto(p)),pdf);
    acoes.appendChild(botaoProjeto("Excluir",async ()=>{
      const mensagem=p.diagramas.length || totalReq
        ? "Os requisitos e a organização das páginas deste projeto serão excluídos. Os diagramas continuarão disponíveis na biblioteca."
        : "Este projeto vazio será excluído permanentemente da biblioteca.";
      if(!await confirmarAcao("Excluir projeto?",p.nome||"Sem título",mensagem,"Excluir projeto")) return;
      const antes=estado.projetos;
      estado.projetos=antes.filter(item=>item.id!==p.id);
      if(!salvarLocal()){estado.projetos=antes;return;}
      renderInicio();
      document.getElementById("abaProjetos").focus({preventScroll:true});
      toast("Projeto excluído","sucesso");
    },"Excluir projeto "+p.nome));
    card.append(titulo,detalhes,acoes); lista.appendChild(card);
  }
}
function abrirProjeto(projeto){
  rascunhoProjeto=projeto?structuredClone(projeto):{id:novoId("P"),nome:"",diagramas:[],requisitos:[]};
  document.getElementById("secaoRequisitos").open=false;
  renderRequisitos();
  document.getElementById("tituloProjeto").textContent=projeto?"Organizar projeto":"Criar projeto";
  document.getElementById("nomeProjeto").value=rascunhoProjeto.nome;
  renderPaginasProjeto(); dialogoProjeto.showModal();
  document.getElementById("nomeProjeto").focus();
}
function renderRequisitos(){
  const requisitos=rascunhoProjeto.requisitos;
  for(const tipo of Object.keys(tiposRequisito)){
    const lista=document.getElementById("lista"+tipo);
    lista.replaceChildren();
    for(const r of requisitos.filter(item=>item.tipo===tipo)){
      const item=document.createElement("li"),rotulo=document.createElement("label");
      const codigo=codigoRequisito(r),campo=document.createElement("textarea");
      campo.id="requisito-"+codigo; rotulo.htmlFor=campo.id; rotulo.textContent=codigo;
      campo.rows=2; campo.value=r.descricao;
      campo.placeholder=tipo==="RF"?"Ex.: Permitir que o cliente consulte seus pedidos.":
        "Ex.: Exibir os pedidos em até 2 segundos.";
      campo.addEventListener("input",()=>{r.descricao=campo.value;campo.setCustomValidity("");});
      const remover=botaoProjeto("Remover",async ()=>{
        if(r.descricao.trim() && !await confirmarAcao("Remover requisito?",codigo,"A remoção será aplicada ao salvar o projeto.","Remover requisito")) return;
        requisitos.splice(requisitos.indexOf(r),1); renderRequisitos();
        document.querySelector('[data-adicionar-requisito="'+tipo+'"]').focus();
      },"Remover "+codigo);
      item.append(rotulo,remover,campo); lista.appendChild(item);
    }
  }
}
for(const botao of document.querySelectorAll("[data-adicionar-requisito]")){
  botao.addEventListener("click",()=>{
    const tipo=botao.dataset.adicionarRequisito;
    const maior=rascunhoProjeto.requisitos.reduce((n,r)=>r.tipo===tipo?Math.max(n,r.numero):n,0);
    const requisito={tipo,numero:maior+1,descricao:""};
    rascunhoProjeto.requisitos.push(requisito); renderRequisitos();
    document.getElementById("requisito-"+codigoRequisito(requisito)).focus();
  });
}
function renderPaginasProjeto(){
  const ids=rascunhoProjeto.diagramas;
  const mapa=new Map(estado.diagramas.map(d=>[d.id,d]));
  const disponiveis=estado.diagramas.filter(d=>!ids.includes(d.id));
  listaEscolha.replaceChildren(...disponiveis.map(d=>new Option(d.nome||"Sem título",d.id)));
  if(!disponiveis.length) listaEscolha.add(new Option(mapa.size?"Todos já foram adicionados":"Crie um diagrama na página inicial",""));
  listaEscolha.disabled=!disponiveis.length;
  document.getElementById("incluirDiagrama").disabled=!disponiveis.length;
  const lista=document.getElementById("paginasProjeto");
  lista.replaceChildren(); document.getElementById("projetoVazio").hidden=ids.length>0;
  ids.forEach((id,i)=>{
    const item=document.createElement("li"),linha=document.createElement("div"),nome=document.createElement("span");
    linha.className="pagina-linha"; nome.textContent=mapa.get(id)?.nome||"Sem título";
    function mover(delta){
      const j=i+delta;
      [ids[i],ids[j]]=[ids[j],ids[i]];
      renderPaginasProjeto();
      document.getElementById("paginasProjeto").children[j].querySelector("button:not(:disabled)").focus();
    }
    const subir=botaoProjeto("↑",()=>mover(-1),"Mover "+nome.textContent+" para cima");
    const descer=botaoProjeto("↓",()=>mover(1),"Mover "+nome.textContent+" para baixo");
    subir.disabled=i===0; descer.disabled=i===ids.length-1;
    linha.append(nome,subir,descer,botaoProjeto("Remover",()=>{ids.splice(i,1);renderPaginasProjeto();},"Remover "+nome.textContent+" deste projeto"));
    item.appendChild(linha); lista.appendChild(item);
  });
}
document.getElementById("novoProjeto").addEventListener("click",()=>abrirProjeto(null));
document.getElementById("cancelarProjeto").addEventListener("click",()=>dialogoProjeto.close());
document.getElementById("incluirDiagrama").addEventListener("click",()=>{
  const d=estado.diagramas.find(item=>String(item.id)===listaEscolha.value);
  if(d&&!rascunhoProjeto.diagramas.includes(d.id)){rascunhoProjeto.diagramas.push(d.id);renderPaginasProjeto();}
});
document.getElementById("formProjeto").addEventListener("submit",ev=>{
  ev.preventDefault();
  const campo=document.getElementById("nomeProjeto");
  rascunhoProjeto.nome=campo.value.trim();
  if(!rascunhoProjeto.nome){campo.value="";campo.reportValidity();return;}
  for(const r of rascunhoProjeto.requisitos){
    r.descricao=r.descricao.trim();
    if(!r.descricao){
      document.getElementById("secaoRequisitos").open=true;
      const campo=document.getElementById("requisito-"+codigoRequisito(r));
      campo.setCustomValidity("Descreva o requisito ou remova este campo.");
      campo.focus();campo.reportValidity();return;
    }
  }
  const antes=estado.projetos;
  const existe=antes.some(p=>p.id===rascunhoProjeto.id);
  estado.projetos=existe?antes.map(p=>p.id===rascunhoProjeto.id?rascunhoProjeto:p):[...antes,rascunhoProjeto];
  if(!salvarLocal()){estado.projetos=antes;return;}
  dialogoProjeto.close(); renderInicio(); toast("Projeto salvo.","sucesso");
});

// Carrega a biblioteca local apenas no primeiro download.
let carregamentoPDF=null;
function carregarPDF(){
  if(!carregamentoPDF){
    carregamentoPDF=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="vendor/pdf-lib.min.js";
      script.onload=()=>resolve(window.PDFLib);
      script.onerror=()=>{script.remove();carregamentoPDF=null;reject(new Error("Biblioteca PDF indisponível"));};
      document.head.appendChild(script);
    });
  }
  return carregamentoPDF;
}
function capturarPaginas(projeto){
  const tela=document.getElementById("telaEditor");
  tela.classList.add("preparando-pdf");
  try{
    return projeto.diagramas.map(id=>{
      const d=structuredClone(estado.diagramas.find(item=>item.id===id));
      render(d,true);
      const {svg,bb}=construirSVGExport("png",d);
      const escala=Math.min(4,2400/Math.max(bb.w,bb.h));
      svg.setAttribute("width",Math.max(1,Math.round(bb.w*escala)));
      svg.setAttribute("height",Math.max(1,Math.round(bb.h*escala)));
      return {
        nome:d.nome||"Sem título", tipo:TIPOS[d.tipo].nome,
        blocos:d.no.length, conexoes:d.seta.length, bb,
        svg:new XMLSerializer().serializeToString(svg)
      };
    });
  }finally{tela.classList.remove("preparando-pdf");}
}
async function imagemDoDiagrama(pagina){
  const imagem=new Image();
  const url=URL.createObjectURL(new Blob([pagina.svg],{type:"image/svg+xml;charset=utf-8"}));
  try{
    imagem.src=url; await imagem.decode();
    const canvas=document.createElement("canvas");
    canvas.width=imagem.naturalWidth; canvas.height=imagem.naturalHeight;
    canvas.getContext("2d").drawImage(imagem,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  }finally{URL.revokeObjectURL(url);}
}
async function exportarProjeto(projeto){
  if(exportandoProjeto||(!projeto.diagramas.length && !projeto.requisitos.length)) return;
  exportandoProjeto=true; renderProjetos();
  const status=document.getElementById("progressoPDF");status.hidden=false;status.textContent="Preparando documento…";
  try{
    const paginas=capturarPaginas(projeto);
    const bytes=await montarPDF(await carregarPDF(),projeto.nome,paginas,imagemDoDiagrama,(i,n)=>{
      status.textContent="Preparando diagrama "+i+" de "+n+"…";
    },projeto.requisitos);
    download(nomeArquivo(projeto.nome,".pdf"),bytes,"application/pdf");
    toast("PDF do projeto exportado.","sucesso");
  }catch{
    toast("Não foi possível gerar o PDF deste projeto. Tente novamente.","erro");
  }finally{
    status.hidden=true;exportandoProjeto=false;renderProjetos();
  }
}
