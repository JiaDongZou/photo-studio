/* 拾光本地像素引擎，无远程服务、无依赖。 */
'use strict';
window.PhotoEngine = (() => {
  const clamp = (x, a = 0, b = 255) => Math.max(a, Math.min(b, x));
  const defaults = () => ({ exposure:0, brightness:0, contrast:0, highlights:0, shadows:0, saturation:0, vibrance:0, warmth:0, tint:0, sharpness:0, vignette:0, fade:0, whiten:0, smooth:0, skinOnly:true, preset:'original', filterAmount:100 });
  const presets = [
    ['original','原片','none'],['fresh','清透','saturate(.85) brightness(1.15)'],['warm','暖阳','sepia(.45) saturate(1.15)'],['film','胶片','sepia(.3) contrast(.85)'],['cool','冷调','hue-rotate(20deg) saturate(.7)'],['mono','黑白','grayscale(1)'],['rose','玫瑰','sepia(.2) hue-rotate(310deg)'],['cinema','电影','contrast(1.3) saturate(.7)'],['vintage','复古','sepia(.8) saturate(.6)'],['soft','柔雾','contrast(.7) brightness(1.1)'],['sunset','落日','sepia(.5) saturate(1.6)'],['emerald','森系','hue-rotate(35deg) saturate(.75)']
  ];
  function canvas(w,h) { const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
  function copy(src) { const c=canvas(src.width,src.height); c.getContext('2d').drawImage(src,0,0); return c; }
  function skin(r,g,b) {
    const cb=128-.168736*r-.331264*g+.5*b, cr=128+.5*r-.418688*g-.081312*b;
    if(r<40 || r<g*.92 || r<b*1.02) return 0;
    return clamp(Math.min((cb-70)/12,(132-cb)/12,(cr-130)/12,(181-cr)/12),0,1);
  }
  function blur(src,radius) {
    const c=canvas(src.width,src.height),x=c.getContext('2d');
    // Expand the image around each edge before blurring, to preserve opaque borders.
    const pad=Math.ceil(radius*3),p=canvas(src.width+pad*2,src.height+pad*2),px=p.getContext('2d');
    px.drawImage(src,pad,pad); px.drawImage(src,0,0,src.width,1,pad,0,src.width,pad); px.drawImage(src,0,src.height-1,src.width,1,pad,src.height+pad,src.width,pad);
    px.drawImage(src,0,0,1,src.height,0,pad,pad,src.height); px.drawImage(src,src.width-1,0,1,src.height,src.width+pad,pad,pad,src.height);
    for(const [sx,sy,dx,dy] of [[0,0,0,0],[src.width-1,0,src.width+pad,0],[0,src.height-1,0,src.height+pad],[src.width-1,src.height-1,src.width+pad,src.height+pad]]) px.drawImage(src,sx,sy,1,1,dx,dy,pad,pad);
    x.filter=`blur(${radius}px)`; x.drawImage(p,-pad,-pad); x.filter='none'; return c;
  }
  function render(src,a) {
    const initial=defaults();if(Object.keys(initial).every(k=>a[k]===initial[k])) return src;
    const c=copy(src),ctx=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height;
    const im=ctx.getImageData(0,0,w,h),d=im.data;
    const bd=a.smooth>0?blur(src,Math.max(1.2,Math.min(w,h)/240)).getContext('2d').getImageData(0,0,w,h).data:null;
    const sd=a.sharpness>0?blur(src,1.2).getContext('2d').getImageData(0,0,w,h).data:null;
    const exp=Math.pow(2,a.exposure/50),con=Math.pow((100+a.contrast)/100,1.5),sat=1+a.saturation/100,filter=a.filterAmount/100;
    for(let i=0;i<d.length;i+=4) {
      let r=d[i],g=d[i+1],b=d[i+2]; const lum=(r*.2126+g*.7152+b*.0722)/255;
      if(bd) { const s=(a.skinOnly?skin(r,g,b):1)*a.smooth/100*.85; const detail=Math.max(Math.abs(r-bd[i]),Math.abs(g-bd[i+1]),Math.abs(b-bd[i+2])); const m=s*Math.max(.08,1-detail/48); r+=(bd[i]-r)*m;g+=(bd[i+1]-g)*m;b+=(bd[i+2]-b)*m; }
      if(a.whiten) {const v=(a.skinOnly?skin(r,g,b):1)*a.whiten/100*.48;r+=(255-r)*v;g+=(255-g)*v;b+=(255-b)*v;}
      const tone=a.shadows*.7*Math.pow(1-lum,2)+a.highlights*.7*Math.pow(lum,2)+a.brightness*.8;
      r=(r*exp+tone-127.5)*con+127.5+a.warmth*.55+a.tint*.22; g=(g*exp+tone-127.5)*con+127.5-a.tint*.35; b=(b*exp+tone-127.5)*con+127.5-a.warmth*.55+a.tint*.22;
      const gray=r*.2126+g*.7152+b*.0722,spread=(Math.max(r,g,b)-Math.min(r,g,b))/255,s=sat*(1+a.vibrance/100*(1-spread));
      r=gray+(r-gray)*s;g=gray+(g-gray)*s;b=gray+(b-gray)*s;
      let fr=r,fg=g,fb=b;
      switch(a.preset) {
        case 'fresh': fr=r*1.03+5;fg=g*1.04+8;fb=b*1.02+7;break;
        case 'warm':fr=r*1.07+7;fg=g*1.01+3;fb=b*.91;break;
        case 'film':fr=r*.88+21;fg=g*.91+16;fb=b*.84+18;break;
        case 'cool':fr=r*.94;fg=g*1.02+2;fb=b*1.06+7;break;
        case 'mono':fr=fg=fb=gray;break;
        case 'rose':fr=r*1.05+8;fg=g*.96+3;fb=b*1.02+7;break;
        case 'cinema':fr=(r-128)*1.15+127;fg=(g-128)*1.09+130;fb=(b-128)*1.05+132;break;
        case 'vintage':fr=.393*r+.769*g+.189*b;fg=.349*r+.686*g+.168*b;fb=.272*r+.534*g+.131*b;break;
        case 'soft':fr=r*.82+28;fg=g*.83+28;fb=b*.84+28;break;
        case 'sunset':fr=r*1.1+10;fg=g*.97+4;fb=b*.84+4;break;
        case 'emerald':fr=r*.91+2;fg=g*1.03+5;fb=b*.93+3;break;
      }
      r+=(fr-r)*filter;g+=(fg-g)*filter;b+=(fb-b)*filter;
      if(sd){const k=a.sharpness/100*1.4;r+=(d[i]-sd[i])*k;g+=(d[i+1]-sd[i+1])*k;b+=(d[i+2]-sd[i+2])*k;}
      if(a.fade){const k=a.fade/100*.5;r=r*(1-k)+128*k;g=g*(1-k)+128*k;b=b*(1-k)+128*k;}
      if(a.vignette){const px=(i/4)%w,py=Math.floor(i/4/w),dist=Math.pow((px-w/2)/(w*.7),2)+Math.pow((py-h/2)/(h*.7),2),v=1-clamp(dist-.1,0,1)*a.vignette/100*.85;r*=v;g*=v;b*=v;}
      d[i]=clamp(r);d[i+1]=clamp(g);d[i+2]=clamp(b);
    }
    ctx.putImageData(im,0,0);return c;
  }
  function drawLayer(ctx,l) {
    if(l.visible===false) return;
    ctx.save(); ctx.translate(l.x,l.y); ctx.rotate((l.rotation||0)*Math.PI/180); ctx.scale(l.flipX?-1:1,l.flipY?-1:1); ctx.globalAlpha=(l.opacity??100)/100;
    if(l.type==='image' && l.image) ctx.drawImage(l.image,-l.w/2,-l.h/2,l.w,l.h);
    else {
      ctx.font=`${l.bold?'700':'400'} ${l.size}px ${l.font||'"Microsoft YaHei",sans-serif'}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=l.color||'#ffffff';
      const lines=l.text.split('\n'),lh=l.size*1.3;
      if(l.shadow){ctx.shadowColor='#0009';ctx.shadowBlur=l.size*.12;ctx.shadowOffsetY=l.size*.06;}
      lines.forEach((line,i)=>{const y=(i-(lines.length-1)/2)*lh;if(l.outline){ctx.strokeStyle=l.outlineColor||'#242424';ctx.lineWidth=Math.max(1,l.size*.045);ctx.strokeText(line,0,y);}ctx.fillText(line,0,y);});
    }
    ctx.restore();
  }
  function bounds(l,ctx) {
    if(l.type==='image') return {w:l.w,h:l.h};
    ctx.font=`${l.bold?'700':'400'} ${l.size}px ${l.font||'"Microsoft YaHei",sans-serif'}`;
    return {w:Math.max(20,...l.text.split('\n').map(s=>ctx.measureText(s).width)),h:l.text.split('\n').length*l.size*1.3};
  }
  function sample(d,w,h,x,y,c) {
    x=clamp(x,0,w-1);y=clamp(y,0,h-1);const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1),tx=x-x0,ty=y-y0;
    return d[(y0*w+x0)*4+c]*(1-tx)*(1-ty)+d[(y0*w+x1)*4+c]*tx*(1-ty)+d[(y1*w+x0)*4+c]*(1-tx)*ty+d[(y1*w+x1)*4+c]*tx*ty;
  }
  function warp(src,cx,cy,rx,ry,amount,mode,dx=0,dy=0) {
    const w=src.width,h=src.height,ctx=src.getContext('2d',{willReadFrequently:true});
    const x0=Math.max(0,Math.floor(cx-rx-Math.abs(dx)-2)),y0=Math.max(0,Math.floor(cy-ry-Math.abs(dy)-2)),ww=Math.min(w-x0,Math.ceil(rx*2+Math.abs(dx)*2+4)),hh=Math.min(h-y0,Math.ceil(ry*2+Math.abs(dy)*2+4));
    if(ww<=0||hh<=0)return;const im=ctx.getImageData(x0,y0,ww,hh),out=new ImageData(new Uint8ClampedArray(im.data),ww,hh),d=im.data;
    for(let y=0;y<hh;y++)for(let x=0;x<ww;x++) {
      const ax=x+x0-cx,ay=y+y0-cy,dist=ax*ax/(rx*rx)+ay*ay/(ry*ry);if(dist>=1)continue;
      const f=Math.pow(1-dist,2)*amount;let sx=x,sy=y;
      if(mode==='push'){sx-=dx*f;sy-=dy*f;}else if(mode==='slim'){sx+=ax*f*.42;}else if(mode==='bulge'){sx-=ax*f*.45;sy-=ay*f*.45;}else if(mode==='pinch'){sx+=ax*f*.45;sy+=ay*f*.45;}
      const i=(y*ww+x)*4;for(let c=0;c<4;c++)out.data[i+c]=sample(d,ww,hh,sx,sy,c);
    }
    ctx.putImageData(out,x0,y0);
  }
  function brushStamp(target,source,blurred,p,opts,anchor) {
    const r=opts.radius,w=target.width,h=target.height,x0=Math.max(0,Math.floor(p.x-r)),y0=Math.max(0,Math.floor(p.y-r)),ww=Math.min(w-x0,Math.ceil(r*2+1)),hh=Math.min(h-y0,Math.ceil(r*2+1));if(ww<1||hh<1)return;
    const ctx=target.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(x0,y0,ww,hh),d=im.data,sd=source.data,bd=blurred?.data;
    const rgb=opts.color.match(/\w\w/g).map(v=>parseInt(v,16));
    for(let y=0;y<hh;y++)for(let x=0;x<ww;x++) {
      const gx=x+x0,gy=y+y0,dist=Math.hypot(gx-p.x,gy-p.y)/r;if(dist>1)continue;
      const a=opts.strength/100*Math.pow(1-dist,Math.max(.15,2-opts.hardness/60)),i=(y*ww+x)*4,si=(gy*w+gx)*4;let v=[d[i],d[i+1],d[i+2],d[i+3]];
      switch(opts.mode) {
        case 'draw':v=[...rgb,255];break;
        case 'erase':v[3]=0;break;
        case 'smooth':case 'blur':if(bd)v=[bd[si],bd[si+1],bd[si+2],d[i+3]];break;
        case 'whiten':v=[d[i]+(255-d[i])*.55,d[i+1]+(255-d[i+1])*.55,d[i+2]+(255-d[i+2])*.55,d[i+3]];break;
        case 'mosaic':{const block=Math.max(4,Math.round(r/4)),xx=Math.min(w-1,Math.floor(gx/block)*block+Math.floor(block/2)),yy=Math.min(h-1,Math.floor(gy/block)*block+Math.floor(block/2)),j=(yy*w+xx)*4;v=[sd[j],sd[j+1],sd[j+2],sd[j+3]];break;}
        case 'clone':{if(!anchor)continue;const xx=Math.round(gx+anchor.dx),yy=Math.round(gy+anchor.dy);if(xx<0||xx>=w||yy<0||yy>=h)continue;const j=(yy*w+xx)*4;v=[sd[j],sd[j+1],sd[j+2],sd[j+3]];break;}
        case 'heal':{v=[0,0,0,d[i+3]];for(let k=0;k<8;k++){const angle=k*Math.PI/4,xx=clamp(Math.round(p.x+Math.cos(angle)*r*1.22),0,w-1),yy=clamp(Math.round(p.y+Math.sin(angle)*r*1.22),0,h-1),j=(yy*w+xx)*4;for(let c=0;c<3;c++)v[c]+=sd[j+c]/8;}break;}
        default:continue;
      }
      for(let c=0;c<4;c++)d[i+c]=d[i+c]*(1-a)+v[c]*a;
    }
    ctx.putImageData(im,x0,y0);
  }
  function removeColor(src,p,tolerance,feather,contiguous) {
    const ctx=src.getContext('2d'),w=src.width,h=src.height,im=ctx.getImageData(0,0,w,h),d=im.data,idx=(clamp(Math.floor(p.y),0,h-1)*w+clamp(Math.floor(p.x),0,w-1))*4,key=[d[idx],d[idx+1],d[idx+2]],threshold=tolerance*4.42,edge=feather*2.55;
    function weight(i){const dist=Math.hypot(d[i]-key[0],d[i+1]-key[1],d[i+2]-key[2]);return dist<=threshold?1:edge?clamp(1-(dist-threshold)/edge,0,1):0;}
    if(!contiguous){for(let i=0;i<d.length;i+=4)d[i+3]*=1-weight(i);}
    else {const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0,start=Math.floor(idx/4);queue[tail++]=start;visited[start]=1;while(head<tail){const j=queue[head++],i=j*4,a=weight(i);if(!a)continue;d[i+3]*=1-a;const xx=j%w;for(const n of [xx>0?j-1:-1,xx<w-1?j+1:-1,j-w,j+w])if(n>=0&&n<w*h&&!visited[n]){visited[n]=1;queue[tail++]=n;}}}
    ctx.putImageData(im,0,0);return key;
  }
  function demo() {
    const c=canvas(1000,1250),x=c.getContext('2d');let g=x.createLinearGradient(0,0,1000,1250);g.addColorStop(0,'#bdd4cb');g.addColorStop(1,'#f0d5b5');x.fillStyle=g;x.fillRect(0,0,1000,1250);
    x.fillStyle='#dbe3cb';x.beginPath();x.arc(780,210,106,0,7);x.fill();
    function leaf(px,py,s,rot){x.save();x.translate(px,py);x.rotate(rot);x.fillStyle='#667d61';x.beginPath();x.ellipse(0,0,s*.35,s,0,0,7);x.fill();x.restore();}
    x.strokeStyle='#6b805c';x.lineWidth=8;x.beginPath();x.moveTo(40,1250);x.quadraticCurveTo(200,550,100,300);x.stroke();for(let i=0;i<7;i++){leaf(100+i*7,390+i*100,75,i%2?-.9:.8);}
    x.fillStyle='#3d4236';x.beginPath();x.ellipse(517,576,230,335,0,0,7);x.fill();
    x.fillStyle='#e2b08e';x.fillRect(445,704,135,218);
    x.fillStyle='#e9c6a5';x.beginPath();x.ellipse(513,568,174,233,0,0,7);x.fill();
    g=x.createLinearGradient(350,480,690,660);g.addColorStop(0,'#edc9a8');g.addColorStop(.6,'#f4d5ba');g.addColorStop(1,'#dab18f');x.fillStyle=g;x.beginPath();x.ellipse(513,568,174,233,0,0,7);x.fill();
    x.fillStyle='#444436';x.beginPath();x.moveTo(300,501);x.bezierCurveTo(275,245,661,172,735,525);x.bezierCurveTo(614,413,568,403,529,335);x.bezierCurveTo(492,430,386,465,300,501);x.fill();
    x.strokeStyle='#645646';x.lineWidth=7;for(const cx of [441,585]){x.beginPath();x.moveTo(cx-35,538);x.quadraticCurveTo(cx,518,cx+29,535);x.stroke();x.lineWidth=4;x.beginPath();x.ellipse(cx,562,29,12,0,0,7);x.stroke();x.fillStyle='#414536';x.beginPath();x.ellipse(cx+3,561,8,11,0,0,7);x.fill();x.lineWidth=7;}
    x.strokeStyle='#bb8b71';x.lineWidth=4;x.beginPath();x.moveTo(518,572);x.lineTo(502,625);x.quadraticCurveTo(517,637,533,623);x.stroke();
    x.fillStyle='#bc7f71';x.beginPath();x.moveTo(471,677);x.quadraticCurveTo(514,663,552,677);x.quadraticCurveTo(511,711,471,677);x.fill();
    for(const [px,py] of [[405,635],[625,635]]){const r=x.createRadialGradient(px,py,3,px,py,42);r.addColorStop(0,'#d38e7866');r.addColorStop(1,'#d38e7800');x.fillStyle=r;x.fillRect(px-44,py-44,88,88);}
    x.fillStyle='#e4e2c6';x.beginPath();x.moveTo(445,845);x.quadraticCurveTo(222,825,185,1250);x.lineTo(875,1250);x.quadraticCurveTo(837,844,580,845);x.quadraticCurveTo(512,958,445,845);x.fill();
    x.strokeStyle='#959d7c';x.lineWidth=3;x.beginPath();x.moveTo(446,845);x.lineTo(391,944);x.lineTo(480,1006);x.moveTo(580,845);x.lineTo(637,944);x.lineTo(549,1006);x.stroke();
    x.fillStyle='#f8f2df';x.font='17px sans-serif';x.fillText('SHIGUANG / LOCAL STUDIO',55,70);x.fillStyle='#52664a';x.font='14px "Microsoft YaHei",sans-serif';x.fillText('示例插画 · 非真实人像',55,1195);return c;
  }
  return {clamp,defaults,presets,canvas,copy,blur,render,drawLayer,bounds,warp,brushStamp,removeColor,demo};
})();
