"use strict";

// O sumário e as seções usam as mesmas entradas para preservar a ordem do projeto.
async function montarPDF(lib,nome,diagramas,obterImagem,progresso,requisitos=[]){
  const pdf=await lib.PDFDocument.create();
  const data=new Date();
  pdf.setTitle(nome);
  pdf.setSubject("Documentação do projeto");
  pdf.setCreator("Editor de Diagramas");
  pdf.setLanguage("pt-BR");
  pdf.setCreationDate(data);
  const {StandardFonts,rgb}=lib;
  const normal=await pdf.embedFont(StandardFonts.Helvetica);
  const negrito=await pdf.embedFont(StandardFonts.HelveticaBold);
  const editorial=await pdf.embedFont(StandardFonts.TimesRomanBold);
  const tinta=rgb(.09,.15,.23), cinza=rgb(.28,.34,.40), verde=rgb(.01,.36,.36);
  const claro=rgb(.92,.96,.95), borda=rgb(.79,.84,.85);
  const [curto,longo]=lib.PageSizes.A4, margem=44, limite=65;
  const contexto=document.createElement("canvas").getContext("2d");
  const grupos=Object.entries(tiposRequisito).map(([tipo,titulo])=>({
    tipo,titulo,itens:requisitos.filter(r=>r.tipo===tipo)
  })).filter(g=>g.itens.length);
  const figuras=diagramas.map((item,i)=>({item,titulo:item.nome,codigo:"FIG. "+String(i+1).padStart(2,"0")}));
  const entradas=[...grupos,...figuras];

  // Coordenadas a partir da borda superior para compor páginas de alturas diferentes.
  function filete(p,x,y,largura,cor=borda){
    const altura=p.getHeight()-y;
    p.drawLine({start:{x,y:altura},end:{x:x+largura,y:altura},color:cor,thickness:.65});
  }
  function fonteCanvas(fonte,tam){
    return (fonte===normal?"":"bold ")+tam+"px "+(fonte===editorial?"serif":"sans-serif");
  }
  function medir(s,fonte,tam){
    try{return fonte.widthOfTextAtSize(s,tam);}
    catch{contexto.font=fonteCanvas(fonte,tam);return contexto.measureText(s).width;}
  }
  async function texto(p,s,x,y,fonte,tam,cor=tinta){
    if(!s) return;
    try{fonte.encodeText(s);}
    catch{
      const canvas=document.createElement("canvas");
      const largura=Math.ceil(medir(s,fonte,tam))+2, altura=Math.ceil(tam*1.6);
      canvas.width=largura*3; canvas.height=altura*3;
      const ctx=canvas.getContext("2d");
      ctx.scale(3,3);ctx.font=fonteCanvas(fonte,tam);
      ctx.fillStyle="rgb("+[cor.red,cor.green,cor.blue].map(v=>Math.round(v*255)).join(",")+")";
      ctx.fillText(s,0,tam);
      const imagem=await pdf.embedPng(canvas.toDataURL("image/png"));
      p.drawImage(imagem,{x,y:p.getHeight()-y-altura+tam,width:largura,height:altura});
      return;
    }
    p.drawText(s,{x,y:p.getHeight()-y,font:fonte,size:tam,color:cor});
  }
  function* linhas(valor,largura,fonte,tam){
    for(const trecho of valor.split(/\r\n|[\r\n]/)){
      let linha="";
      for(const palavra of trecho.trim().split(/\s+/)){
        const proposta=linha?linha+" "+palavra:palavra;
        if(medir(proposta,fonte,tam)<=largura){linha=proposta;continue;}
        if(linha) yield linha;
        linha="";
        for(const letra of palavra){
          if(linha && medir(linha+letra,fonte,tam)>largura){yield linha;linha="";}
          linha+=letra;
        }
      }
      yield linha;
    }
  }
  function abreviar(s,largura,fonte,tam){
    const limpo=s.replace(/\s+/g," ").trim();
    if(medir(limpo,fonte,tam)<=largura) return limpo;
    let trecho="";
    for(const letra of limpo){
      if(medir(trecho+letra+"…",fonte,tam)>largura) break;
      trecho+=letra;
    }
    return trecho.trimEnd()+"…";
  }
  async function cabecalho(p,secao){
    const dir=p.getWidth()-margem;
    await texto(p,"EDITOR DE DIAGRAMAS",margem,35,negrito,9,verde);
    await texto(p,secao,dir-medir(secao,normal,9),35,normal,9,cinza);
    filete(p,margem,46,dir-margem);
  }
  let indice=pdf.addPage([curto,longo]);
  const largura=curto-2*margem;
  await cabecalho(indice,"Emitido em "+data.toLocaleDateString("pt-BR"));
  await texto(indice,"DOCUMENTAÇÃO DO PROJETO",margem,101,negrito,10,verde);
  let y=146;
  for(const linha of linhas(nome,largura,editorial,35)){
    if(y>longo-145){indice=pdf.addPage([curto,longo]);await cabecalho(indice,"Apresentação");y=100;}
    await texto(indice,linha,margem,y,editorial,35);
    y+=40;
  }
  const metricas=[
    [requisitos.filter(r=>r.tipo==="RF").length,"Req. funcionais"],
    [requisitos.filter(r=>r.tipo==="RNF").length,"Req. não funcionais"],
    [diagramas.length,"Diagramas"]
  ];
  indice.drawRectangle({x:margem,y:longo-y-53,width:largura,height:59,color:claro});
  for(const [i,[total,rotulo]] of metricas.entries()){
    const x=margem+15+i*largura/3;
    await texto(indice,String(total),x,y+19,negrito,21,verde);
    await texto(indice,rotulo,x,y+39,normal,10,cinza);
  }
  y+=108;
  async function tituloIndice(){
    await texto(indice,"Sumário",margem,y,editorial,24);
    await texto(indice,"PÁG.",curto-margem-24,y,negrito,9,cinza);
    filete(indice,margem,y+13,largura,verde);
    y+=40;
  }
  async function continuarIndice(){
    indice=pdf.addPage([curto,longo]);await cabecalho(indice,"Sumário");y=93;
  }
  if(y+75>longo-limite) await continuarIndice();
  await tituloIndice();
  for(const entrada of entradas){
    if(y>longo-limite){await continuarIndice();await tituloIndice();}
    entrada.origem=indice;entrada.yIndice=y;
    await texto(indice,entrada.codigo||entrada.tipo,margem,y,negrito,9,verde);
    await texto(indice,abreviar(entrada.titulo,largura-106,normal,12),margem+61,y,normal,12);
    filete(indice,margem,y+11,largura);
    y+=32;
  }

  let pagina, cursor;
  async function secaoRequisitos(grupo,nova){
    if(nova){pagina=pdf.addPage([curto,longo]);await cabecalho(pagina,"Levantamento de requisitos");cursor=88;}
    const inicio=cursor;
    await texto(pagina,grupo.titulo,margem,cursor,editorial,23);
    cursor+=23;
    const legenda=grupo.tipo==="RF"?"Comportamentos que o sistema deve oferecer.":"Critérios de qualidade e restrições do sistema.";
    await texto(pagina,legenda,margem,cursor,normal,11,cinza);
    cursor+=15;filete(pagina,margem,cursor,largura,verde);cursor+=25;
    return inicio;
  }
  for(const grupo of grupos){
    const inicio=await secaoRequisitos(grupo,!pagina||cursor+112>longo-limite);
    grupo.destino=pagina;grupo.topo=inicio-35;
    for(const r of grupo.itens){
      const codigo=codigoRequisito(r);
      const coluna=Math.max(74,medir(codigo,negrito,10)+14);
      if(cursor+20>longo-limite) await secaoRequisitos(grupo,true);
      await texto(pagina,codigo,margem,cursor,negrito,10,verde);
      for(const linha of linhas(r.descricao,largura-coluna,normal,11.5)){
        if(cursor>longo-limite){
          await secaoRequisitos(grupo,true);
          await texto(pagina,codigo,margem,cursor,negrito,10,verde);
          await texto(pagina,"continuação",margem,cursor+13,normal,8,cinza);
        }
        await texto(pagina,linha,margem+coluna,cursor,normal,11.5);
        cursor+=17;
      }
      filete(pagina,margem,cursor+1,largura);cursor+=23;
    }
    cursor+=24;
  }
  for(const [i,figura] of figuras.entries()){
    progresso(i+1,figuras.length);
    const {item}=figura, {w,h}=item.bb;
    const p=pdf.addPage(w>h?[longo,curto]:[curto,longo]);
    figura.destino=p; figura.topo=0;
    await cabecalho(p,"Diagramas do projeto");
    const area=p.getWidth()-2*margem;
    await texto(p,figura.codigo+"   /   "+item.tipo,margem,72,negrito,10,verde);
    let topo=102;
    const nomeFigura=abreviar(item.nome,area*3,editorial,23);
    for(const linha of linhas(nomeFigura,area,editorial,23)){
      await texto(p,linha,margem,topo,editorial,23);topo+=26;
    }
    const detalhes=quantidadeItens(item.blocos,"bloco","blocos")+"   ·   "+quantidadeItens(item.conexoes,"conexão","conexões");
    await texto(p,detalhes,margem,topo-5,normal,10,cinza);
    topo+=12;
    const base=limite, altura=p.getHeight()-topo-base;
    const escala=Math.min((area-12)/w,(altura-12)/h);
    const img=await pdf.embedPng(await obterImagem(item));
    p.drawImage(img,{x:margem+(area-w*escala)/2,y:base+(altura-h*escala)/2,width:w*escala,height:h*escala});
    p.drawRectangle({x:margem,y:base,width:area,height:altura,borderColor:borda,borderWidth:.7});
  }

  const folhas=pdf.getPages();
  const numeros=new Map(folhas.map((p,i)=>[p,i+1]));
  for(const entrada of entradas){
    const p=entrada.origem, pos=entrada.yIndice, n=String(numeros.get(entrada.destino));
    await texto(p,n,curto-margem-medir(n,negrito,12),pos,negrito,12,verde);
    const link=pdf.context.obj({Type:"Annot",Subtype:"Link",
      Rect:[margem,longo-pos-10,curto-margem,longo-pos+15],Border:[0,0,0],
      Dest:[entrada.destino.ref,"XYZ",0,entrada.destino.getHeight()-entrada.topo,0]});
    p.node.addAnnot(pdf.context.register(link));
  }
  for(const [i,p] of folhas.entries()){
    const altura=p.getHeight(), area=p.getWidth()-2*margem;
    const numero=(i+1)+" / "+folhas.length;
    filete(p,margem,altura-43,area);
    await texto(p,abreviar(nome,area-80,normal,9),margem,altura-27,normal,9,cinza);
    await texto(p,numero,p.getWidth()-margem-medir(numero,negrito,9),altura-27,negrito,9,verde);
  }
  return pdf.save();
}
