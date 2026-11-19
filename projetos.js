"use strict";

// Coleções anteriores contêm apenas um array de diagramas.
function dadosColecao(){
  return estado.projetos.length ? {versao:2,diagramas:estado.diagramas,projetos:estado.projetos} : estado.diagramas;
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
    return {id:p.id,nome:p.nome,diagramas:[...new Set(p.diagramas.filter(id=>ids.has(id)))]};
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
    detalhes.textContent=p.diagramas.length+(p.diagramas.length===1?" diagrama":" diagramas");
    const acoes=document.createElement("div"); acoes.className="arquivos";
    const pdf=botaoProjeto("Baixar PDF",()=>exportarProjeto(p));
    pdf.disabled=exportandoProjeto||!p.diagramas.length;
    acoes.append(botaoProjeto("Organizar",()=>abrirProjeto(p)),pdf);
    acoes.appendChild(botaoProjeto("Excluir",async ()=>{
      const mensagem=p.diagramas.length
        ? "A organização das páginas será excluída. Os diagramas continuarão disponíveis na biblioteca."
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
  rascunhoProjeto=projeto?{...projeto,diagramas:[...projeto.diagramas]}:{id:novoId("P"),nome:"",diagramas:[]};
  document.getElementById("tituloProjeto").textContent=projeto?"Organizar projeto":"Criar projeto";
  document.getElementById("nomeProjeto").value=rascunhoProjeto.nome;
  renderPaginasProjeto(); dialogoProjeto.showModal();
  document.getElementById("nomeProjeto").focus();
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
      return {nome:d.nome||"Sem título",bb,svg:new XMLSerializer().serializeToString(svg)};
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
// Usa texto selecionável quando a fonte PDF cobre o título. Para outros alfabetos,
// usa a fonte do navegador para conservar os caracteres no documento.
async function escreverTitulo(pdf,pagina,texto,fonte,tamanho,x,topo,largura){
  try{
    fonte.encodeText(texto);
  }catch{
    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(largura*3); canvas.height=(tamanho+8)*3;
    const ctx=canvas.getContext("2d");
    ctx.scale(3,3);ctx.font=tamanho+"px sans-serif";ctx.fillText(texto,0,tamanho,largura);
    const imagem=await pdf.embedPng(canvas.toDataURL("image/png"));
    pagina.drawImage(imagem,{x,y:topo-tamanho-8,width:largura,height:tamanho+8});
    return topo-tamanho-12;
  }
  let linha="";
  for(const letra of texto){
    if(linha && fonte.widthOfTextAtSize(linha+letra,tamanho)>largura){
      pagina.drawText(linha,{x,y:topo-tamanho,font:fonte,size:tamanho});
      topo-=tamanho+5; linha="";
    }
    linha+=letra;
  }
  pagina.drawText(linha,{x,y:topo-tamanho,font:fonte,size:tamanho});
  return topo-tamanho-10;
}
async function montarPDF(lib,nome,paginas,obterImagem,progresso){
  const pdf=await lib.PDFDocument.create();
  pdf.setTitle(nome);
  const titulo=await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  const texto=await pdf.embedFont(lib.StandardFonts.Helvetica);
  const [curto,longo]=lib.PageSizes.A4, margem=36;
  for(const [i,item] of paginas.entries()){
    progresso(i+1,paginas.length);
    const {w,h}=item.bb;
    const pagina=pdf.addPage(w>h?[longo,curto]:[curto,longo]);
    const largura=pagina.getWidth()-2*margem;
    let topo=await escreverTitulo(pdf,pagina,nome,texto,10,margem,pagina.getHeight()-margem,largura);
    topo=await escreverTitulo(pdf,pagina,item.nome,titulo,19,margem,topo,largura);
    const imagem=await pdf.embedPng(await obterImagem(item));
    const base=margem+16, escala=Math.min(largura/w,(topo-base)/h);
    pagina.drawImage(imagem,{x:margem+(largura-w*escala)/2,y:topo-h*escala,width:w*escala,height:h*escala});
    pagina.drawText((i+1)+" / "+paginas.length,{x:margem,y:22,size:9,font:texto});
  }
  return pdf.save();
}
async function exportarProjeto(projeto){
  if(exportandoProjeto||!projeto.diagramas.length) return;
  exportandoProjeto=true; renderProjetos();
  const status=document.getElementById("progressoPDF");status.hidden=false;status.textContent="Preparando diagramas…";
  try{
    const paginas=capturarPaginas(projeto);
    const bytes=await montarPDF(await carregarPDF(),projeto.nome,paginas,imagemDoDiagrama,(i,n)=>{
      status.textContent="Gerando página "+i+" de "+n+"…";
    });
    download(nomeArquivo(projeto.nome,".pdf"),bytes,"application/pdf");
    toast("PDF do projeto exportado.","sucesso");
  }catch{
    toast("Não foi possível gerar o PDF deste projeto. Tente novamente.","erro");
  }finally{
    status.hidden=true;exportandoProjeto=false;renderProjetos();
  }
}
