#!/usr/bin/env python3
"""Vídeo editorial continuo de Atlas, inspirado en presentacion-desktop."""
from __future__ import annotations
import math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT=Path(__file__).resolve().parent; sys.path.insert(0,str(ROOT/"_vendor")); import imageio_ffmpeg
OUT=ROOT/"atlas-biblioteca-ia-oracion.mp4"; POSTER=ROOT/"atlas-video-poster.png"
W,H,FPS,DURATION=1920,1080,20,28
INK,GREEN,PAPER,GOLD,VIOLET="#09100c","#17362a","#f4efe5","#e1bc62","#5d4779"

def font(size,family="sans",bold=False,italic=False):
    base=Path("C:/Windows/Fonts")
    if family=="serif": name="georgiaz.ttf" if bold and italic else "georgiab.ttf" if bold else "georgiai.ttf" if italic else "georgia.ttf"
    else: name="segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(base/name),size)
F={"micro":font(18,bold=True),"small":font(24),"label":font(25,bold=True),"body":font(36),"card_small":font(30,"serif",True),"card":font(42,"serif",True),"title":font(102,"serif",True),"display":font(154,"serif",True),"italic":font(112,"serif",True,True)}
def clamp(x): return max(0.,min(1.,x))
def smooth(x): x=clamp(x); return x*x*(3-2*x)
def ease(x): return 1-(1-clamp(x))**4
def local(t,a,b): return clamp((t-a)/(b-a))
def opacity(t,a,b,edge=.65): return min(clamp((t-a)/edge),clamp((b-t)/edge))
def mix(a,b,p): return a+(b-a)*smooth(p)
def rgba(c,a=255): c=c.lstrip("#"); return tuple(int(c[i:i+2],16) for i in (0,2,4))+(int(a),)
def txt(d,xy,value,f,color,anchor="la",spacing=4,align="left"): d.multiline_text(xy,value,font=f,fill=color,anchor=anchor,spacing=spacing,align=align)
def rr(d,box,r,fill,outline=None,width=1): d.rounded_rectangle(tuple(int(v) for v in box),r,fill=fill,outline=outline,width=width)
def gradient(top,bottom):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im); a=rgba(top)[:3]; b=rgba(bottom)[:3]
    for y in range(H):
        p=y/(H-1); d.line((0,y,W,y),fill=tuple(int(a[i]*(1-p)+b[i]*p) for i in range(3)))
    return im
BASE_DARK=gradient("#0a1712","#080d12"); BASE_PAPER=gradient("#f7f2e8","#e9e1d2")
def background(t,paper=False):
    im=(BASE_PAPER if paper else BASE_DARK).copy().convert("RGBA"); glow=Image.new("RGBA",(W,H)); d=ImageDraw.Draw(glow,"RGBA")
    specs=[("#d9a646",.19,160+55*math.sin(t*.24),180),("#7254aa",.20,1680+60*math.cos(t*.19),250),("#41957b",.16,1080,940+45*math.sin(t*.16))]
    for c,a,x,y in specs: d.ellipse((x-430,y-430,x+430,y+430),fill=rgba(c,255*a))
    return Image.alpha_composite(im,glow.filter(ImageFilter.GaussianBlur(115)))
def header(d,section,page,light=True):
    color="#f1d06f" if light else "#7c6435"
    d.ellipse((72,61,86,75),fill=color); d.ellipse((95,61,109,75),fill="#6db9a7"); d.ellipse((118,61,132,75),fill="#9b7fbd")
    txt(d,(153,69),f"ATLAS · {section}",F["micro"],color,"lm"); txt(d,(1845,69),page,F["micro"],color,"rm")
def source_card(x,y,title,sub,p,angle=0):
    layer=Image.new("RGBA",(350,180)); d=ImageDraw.Draw(layer,"RGBA"); rr(d,(20,20,320,145),24,(248,244,234,int(242*p)),(255,255,255,int(100*p)),2); d.rectangle((20,20,28,145),fill=rgba(GOLD,230*p)); txt(d,(48,50),title,F["label"],rgba(GREEN,255*p)); txt(d,(48,91),sub,F["small"],(72,83,76,int(210*p))); layer=layer.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True); return layer,(int(x-layer.width/2),int(y-layer.height/2))
def shelves(d,x,y,s,a):
    colors=[GOLD,"#72a995","#886ba5","#d4865f","#d7ded5"]
    for row in range(3):
        for col in range(11):
            w=38*s; h=(126+(col%4)*15)*s; bx=x+col*48*s; by=y+row*174*s+(155*s-h); rr(d,(bx,by,bx+w,by+h),max(2,int(7*s)),rgba(colors[(col+row)%5],a),rgba("#ffffff",60),1)

def problem(im,t,a):
    d=ImageDraw.Draw(im,"RGBA"); p=local(t,0,4.2); header(d,"LO QUE ESTABA DISPERSO","01")
    title_a=a*clamp((4.05-t)/.55); txt(d,(110,mix(560,280,ease(p))),"Todo estaba.\nPero disperso.",F["display"],rgba(PAPER,255*title_a),"lm",-3)
    labels=[("Biblia","pasajes"),("Catecismo","doctrina"),("Romana","estudios"),("Opusdei.org","recursos"),("Dante","obra completa"),("San Agustín","textos"),("Cartas","formación"),("Meditaciones","oración")]
    targets=[(310,780),(650,745),(980,805),(1310,735),(1575,795),(440,940),(930,945),(1450,930)]; starts=[(-120,930),(560,1180),(1010,-120),(2050,820),(1740,-160),(-180,350),(1050,1260),(2100,310)]
    for i,((title,sub),(tx,ty),(sx,sy)) in enumerate(zip(labels,targets,starts)):
        q=ease(local(p,.18+i*.025,.78+i*.018)); card,pos=source_card(mix(sx,tx,q),mix(sy,ty,q),title,sub,a,[-5,4,-2,5,-4,3,-3,4][i]*(1-q)); im.alpha_composite(card,pos)
def library(im,t,a):
    d=ImageDraw.Draw(im,"RGBA"); p=local(t,3.4,9.2); header(d,"LA BIBLIOTECA","02"); zoom=1+ease(p)*.13; x=1080-(zoom-1)*700; y=250-(zoom-1)*180
    txt(d,(95,222),"Lo disperso\nse vuelve",F["title"],rgba(PAPER,255*a),spacing=-2); txt(d,(95,458),"Biblioteca.",F["italic"],rgba(GOLD,255*a)); txt(d,(100,600),"Textos completos para",F["body"],rgba("#d8e2da",225*a))
    for i,w in enumerate(("buscar","abrir","leer")): rr(d,(100+i*150,662,232+i*150,710),24,rgba("#ffffff",22*a),rgba("#ffffff",50*a)); txt(d,(166+i*150,686),w.upper(),F["micro"],rgba(PAPER,230*a),"mm")
    rr(d,(x,y,x+700*zoom,y+675*zoom),45,rgba(GREEN,238*a),rgba("#f3e8cf",145*a),3); shelves(d,x+78*zoom,y+125*zoom,zoom,255*a); txt(d,(x+350*zoom,y+54*zoom),"ATLAS · ARCHIVO VIVO",F["micro"],rgba(GOLD,255*a),"ma")
    if p>.52:
        q=ease(local(p,.52,.9)); rr(d,(115,820,760,990),32,rgba(PAPER,242*q*a)); txt(d,(155,870),"131 MILLONES",F["title"],rgba(GREEN,255*q*a)); txt(d,(158,952),"de palabras · 1.385 documentos",F["small"],rgba("#47534c",230*q*a))
def specialists(im,t,a):
    d=ImageDraw.Draw(im,"RGBA"); p=local(t,8.3,15.1); header(d,"IA SOBRE LA BIBLIOTECA","03"); txt(d,(92,200),"No preguntas\na una IA cualquiera.",F["title"],rgba(PAPER,255*a),spacing=-3); txt(d,(96,454),"Eliges quién conoce esas estanterías.",F["body"],rgba("#d8e2da",225*a))
    names=[("D","Doctrina"),("C","CanonIA"),("H","HistorIA"),("L","LiturgIA"),("O","OrtodoxIA"),("B","BibliotecarIA"),("SJ","San JosemarIA"),("PC","Círculos"),("S","Santos")]
    for i,(mark,name) in enumerate(names):
        col=i%3; row=i//3; q=ease(local(p,.08+i*.035,.52+i*.025)); x=950+col*285; y=190+row*240+(1-q)*95; fill=["#244f41","#584371","#a96b45"][col]; rr(d,(x,y,x+250,y+205),27,rgba(fill,240*q*a),rgba("#ffffff",65*q*a),2); rr(d,(x+20,y+20,x+66,y+66),14,rgba("#ffffff",35*q*a)); txt(d,(x+43,y+43),mark,F["micro"],rgba(PAPER,255*q*a),"mm"); txt(d,(x+21,y+139),name,F["card"],rgba(PAPER,255*q*a)); txt(d,(x+21,y+177),"FUENTES PROPIAS",F["micro"],rgba(GOLD,230*q*a))
    if p>.62:
        q=ease(local(p,.62,.94)); rr(d,(80,790,790,996),36,rgba(PAPER,245*q*a)); txt(d,(124,833),"EL RECORRIDO",F["micro"],rgba(VIOLET,255*q*a)); txt(d,(124,885),"1  ELIGE LA IA",F["label"],rgba(GREEN,255*q*a)); txt(d,(124,937),"2  PREGUNTA  ·  3  COMPRUEBA",F["label"],rgba(GREEN,255*q*a))
def answer(im,t,a):
    d=ImageDraw.Draw(im,"RGBA"); p=local(t,14.2,20.5); header(d,"UNA RESPUESTA QUE SE PUEDE COMPROBAR","04",False); txt(d,(92,200),"Pregunta.",F["display"],rgba(GREEN,255*a)); txt(d,(100,410),"¿Cómo explicar esto\ncon claridad?",F["card"],rgba("#5c665f",235*a),spacing=9)
    lp=ease(local(p,.12,.58)); d.line((610,515,mix(610,1180,lp),515),fill=rgba(VIOLET,210*a),width=5)
    for i,label in enumerate(("Catecismo","Documento","Autor")):
        q=ease(local(p,.30+i*.07,.72+i*.05)); x=1260+i*170; y=330+i*160; rr(d,(x-110,y-48,x+110,y+48),25,rgba(GREEN,245*q*a)); txt(d,(x,y),label,F["micro"],rgba(PAPER,255*q*a),"mm"); d.line((1180,515,x-110,y),fill=rgba("#5b9f8d",130*q*a),width=3)
    q=ease(local(p,.53,.92)); rr(d,(760,665,1775,955),38,rgba("#ffffff",245*q*a),rgba("#c9bda8",180*q*a),2); txt(d,(810,716),"ORTODOXIA · RESPUESTA",F["micro"],rgba(VIOLET,255*q*a)); txt(d,(810,780),"Una respuesta clara,",F["card"],rgba(GREEN,255*q*a)); txt(d,(810,838),"apoyada en los textos.",F["card"],rgba(GREEN,255*q*a))
    for i in range(3): rr(d,(810+i*230,890,1015+i*230,925),17,rgba("#ebe4d7",255*q*a)); txt(d,(912+i*230,908),f"FUENTE {i+1}",F["micro"],rgba("#665b49",255*q*a),"mm")
def life(im,t,a):
    d=ImageDraw.Draw(im,"RGBA"); p=local(t,19.5,25.1); header(d,"RECURSOS PARA REZAR Y FORMARSE","05"); txt(d,(90,188),"Y después,\nvivirlo.",F["title"],rgba(PAPER,255*a),spacing=-3)
    cards=[("EVANGELIO","Rezar","#315f50"),("10 MINUTOS","Escuchar","#735787"),("EXAMEN","Mirar el día","#a56c44"),("FORMACIÓN","Aprender","#315b72"),("OPUS DEI","Todo cerca","#78534b")]
    for i,(tag,title,color) in enumerate(cards):
        q=ease(local(p,.06+i*.055,.58+i*.04)); x=700+i*225; y=250+(i%2)*250+(1-q)*120; rr(d,(x,y,x+205,y+390),32,rgba(color,245*q*a),rgba("#ffffff",70*q*a),2); txt(d,(x+22,y+38),tag,F["micro"],rgba(GOLD,255*q*a)); txt(d,(x+22,y+310),title,F["card_small"],rgba(PAPER,255*q*a)); d.arc((x+58,y+90,x+260,y+292),185,500,fill=rgba("#ffffff",55*q*a),width=3)
    q=ease(local(p,.64,.94)); txt(d,(94,835),"Leer  →  comprender  →",F["body"],rgba("#dce5de",230*q*a)); txt(d,(94,910),"rezar · preparar · vivir",F["italic"],rgba(GOLD,255*q*a))
def final(im,t,a):
    d=ImageDraw.Draw(im,"RGBA"); p=local(t,24.2,28); header(d,"UNA SOLA IDEA","06"); y=mix(610,435,ease(p)); txt(d,(W/2,y),"Biblioteca.",F["display"],rgba(PAPER,255*a),"mm"); txt(d,(W/2,y+150),"IA sobre la Biblioteca.",F["italic"],rgba(GOLD,255*a),"mm"); txt(d,(W/2,y+285),"Recursos para rezar y formarse.",F["card"],rgba("#d9e3db",245*a),"mm"); q=ease(local(p,.42,.82)); rr(d,(735,835,1185,910),38,rgba(PAPER,245*q*a)); txt(d,(960,873),"ATLAS · TODO JUNTO",F["label"],rgba(GREEN,255*q*a),"mm")
SCENES=[(0,4.8,problem,False),(3.7,9.8,library,False),(8.8,15.8,specialists,False),(14.8,21.1,answer,True),(20.1,25.8,life,False),(24.8,28.1,final,False)]
def frame(i):
    t=i/FPS; active=[s for s in SCENES if s[0]<=t<=s[1]]; im=background(t,bool(active and active[-1][3]))
    for start,end,fn,_ in active:
        layer=Image.new("RGBA",(W,H)); fn(layer,t,opacity(t,start,end)); im=Image.alpha_composite(im,layer)
    return im.convert("RGB")
def main():
    writer=imageio_ffmpeg.write_frames(str(OUT),(W,H),fps=FPS,codec="libx264",pix_fmt_in="rgb24",pix_fmt_out="yuv420p",quality=7,macro_block_size=8,output_params=["-movflags","+faststart"]); writer.send(None)
    for i in range(FPS*DURATION): writer.send(frame(i).tobytes())
    writer.close(); frame(FPS*26).save(POSTER); print(OUT)
if __name__=="__main__": main()
