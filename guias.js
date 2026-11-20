"use strict";

// Projeta a geometria em um eixo para usar as mesmas regras na horizontal e na vertical.
function projetarGuia(caixa,eixo,dx=0,dy=0){
  if(eixo==="x") return {inicio:caixa.x1+dx,fim:caixa.x2+dx,min:caixa.y1+dy,max:caixa.y2+dy};
  return {inicio:caixa.y1+dy,fim:caixa.y2+dy,min:caixa.x1+dx,max:caixa.x2+dx};
}

function encontrarEncaixe(movel,referencias,tolerancia){
  let melhor=null;
  function considerar(delta,distancia,prioridade,detalhes){
    if(Math.abs(delta)>tolerancia) return;
    if(melhor){
      const diferenca=Math.abs(delta)-Math.abs(melhor.delta);
      if(diferenca>0 || (diferenca===0 && (distancia>melhor.distancia ||
          (distancia===melhor.distancia && prioridade>=melhor.prioridade)))) return;
    }
    melhor={delta,distancia,prioridade,...detalhes};
  }
  const centro=(movel.inicio+movel.fim)/2;
  const antes=[], depois=[];
  for(const r of referencias){
    const distancia=Math.max(0,r.min-movel.max,movel.min-r.max);
    const pares=[
      [centro,(r.inicio+r.fim)/2],[movel.inicio,r.inicio],[movel.fim,r.fim],
      [movel.fim,r.inicio],[movel.inicio,r.fim]
    ];
    for(const [i,[origem,linha]] of pares.entries()){
      considerar(linha-origem,distancia,i,{linha,min:r.min,max:r.max});
    }
    if(distancia>0) continue;
    if(r.fim<=movel.inicio+tolerancia) antes.push(r);
    else if(r.inicio>=movel.fim-tolerancia) depois.push(r);
  }

  // Vizinhos na mesma faixa: centralizar no vão ou repetir o intervalo ao lado.
  // As referências já estão ordenadas pelo início. À esquerda interessa o fim mais próximo.
  antes.sort((a,b)=>b.fim-a.fim);
  const [a,b]=antes, [c,d]=depois;
  const largura=movel.fim-movel.inicio;
  function espacar(inicio,intervalo,pares){
    if(intervalo<=tolerancia) return;
    considerar(inicio-movel.inicio,0,5,{intervalos:pares});
  }
  if(a && c){
    const intervalo=(c.inicio-a.fim-largura)/2;
    espacar(a.fim+intervalo,intervalo,[[a.fim,a.fim+intervalo],[c.inicio-intervalo,c.inicio]]);
  }
  if(a && b){
    const intervalo=a.inicio-b.fim;
    espacar(a.fim+intervalo,intervalo,[[b.fim,a.inicio],[a.fim,a.fim+intervalo]]);
  }
  if(c && d){
    const intervalo=d.inicio-c.fim;
    espacar(c.inicio-intervalo-largura,intervalo,[[c.inicio-intervalo,c.inicio],[c.fim,d.inicio]]);
  }
  return melhor;
}

function capturarGuias(ancoras,selecionados,vista){
  const grupo={x1:Infinity,y1:Infinity,x2:-Infinity,y2:-Infinity};
  const referencias={x:[],y:[]};
  for(const [id,a] of ancoras){
    const caixa={x1:a.esquerda.x,x2:a.direita.x,y1:a.topo.y,y2:a.inferior.y};
    if(selecionados.has(id)){
      grupo.x1=Math.min(grupo.x1,caixa.x1);grupo.y1=Math.min(grupo.y1,caixa.y1);
      grupo.x2=Math.max(grupo.x2,caixa.x2);grupo.y2=Math.max(grupo.y2,caixa.y2);
    }else if(caixa.x2>=vista.x && caixa.x1<=vista.x+vista.width &&
             caixa.y2>=vista.y && caixa.y1<=vista.y+vista.height){
      for(const eixo of ["x","y"]) referencias[eixo].push(projetarGuia(caixa,eixo));
    }
  }
  for(const lista of Object.values(referencias)) lista.sort((a,b)=>a.inicio-b.inicio);
  return {grupo,referencias};
}

function aplicarGuias(geometria,dx,dy,zoom,livre,camada){
  camada.replaceChildren();
  if(livre) return {dx,dy};
  const {grupo,referencias}=geometria;
  const achados={};
  for(const eixo of ["x","y"]){
    const movel=projetarGuia(grupo,eixo,dx,dy);
    achados[eixo]=encontrarEncaixe(movel,referencias[eixo],6/zoom);
  }
  dx+=achados.x?.delta??0;
  dy+=achados.y?.delta??0;
  for(const eixo of ["x","y"]){
    const guia=achados[eixo];
    if(!guia) continue;
    const movel=projetarGuia(grupo,eixo,dx,dy);
    function segmento(a,b,c,d,tracejado=false){
      const linha=document.createElementNS("http://www.w3.org/2000/svg","line");
      const pontos=eixo==="x"?[a,b,c,d]:[b,a,d,c];
      for(const [i,atributo] of ["x1","y1","x2","y2"].entries()) linha.setAttribute(atributo,pontos[i]);
      linha.setAttribute("vector-effect","non-scaling-stroke");
      if(tracejado) linha.setAttribute("stroke-dasharray","4 3");
      camada.appendChild(linha);
    }
    if(guia.intervalos){
      const margem=movel.min-9/zoom, marca=3/zoom;
      for(const [a,b] of guia.intervalos){
        segmento(a,margem,b,margem);
        segmento(a,margem-marca,a,margem+marca);
        segmento(b,margem-marca,b,margem+marca);
      }
    }else{
      segmento(guia.linha,Math.min(movel.min,guia.min)-8/zoom,
               guia.linha,Math.max(movel.max,guia.max)+8/zoom,true);
    }
  }
  return {dx,dy};
}
