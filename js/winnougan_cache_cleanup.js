import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPE = "WinnouganCacheCleanup";

const NEON_COLORS = [
    "#ff00ff","#00ffff","#ff3300","#00ff88",
    "#ff9900","#ff0066","#33ff00","#aa00ff","#00ccff","#ffcc00",
];
function randomNeon() { return NEON_COLORS[Math.floor(Math.random()*NEON_COLORS.length)]; }

class SparkleSystem {
    constructor(max=12){this.particles=[];this.max=max;}
    _spawn(w,h,yOff){
        const perim=2*(w+h);let d=Math.random()*perim,x,y;
        if(d<w){x=d;y=yOff;}else if(d<w+h){x=w;y=yOff+(d-w);}
        else if(d<2*w+h){x=w-(d-w-h);y=yOff+h;}else{x=0;y=yOff+h-(d-2*w-h);}
        this.particles.push({x,y,vx:(Math.random()-0.5)*0.6,vy:(Math.random()-0.5)*0.6,
            life:1.0,decay:0.008+Math.random()*0.012,size:1.2+Math.random()*2.0});
    }
    update(w,h,yOff){
        while(this.particles.length<this.max)this._spawn(w,h,yOff);
        for(let i=this.particles.length-1;i>=0;i--){
            const p=this.particles[i];p.x+=p.vx;p.y+=p.vy;p.life-=p.decay;
            if(p.life<=0)this.particles.splice(i,1);
        }
    }
    draw(ctx,color){
        for(const p of this.particles){
            ctx.save();ctx.globalAlpha=p.life*0.9;
            ctx.shadowColor=color;ctx.shadowBlur=6+p.size*2;ctx.fillStyle=color;
            const s=p.size;
            ctx.beginPath();ctx.moveTo(p.x,p.y-s);ctx.lineTo(p.x+s*0.3,p.y);
            ctx.lineTo(p.x,p.y+s);ctx.lineTo(p.x-s*0.3,p.y);ctx.closePath();ctx.fill();
            ctx.restore();
        }
    }
}

const SEG_ON={
    "0":[1,1,1,1,1,1,0],"1":[0,1,1,0,0,0,0],"2":[1,1,0,1,1,0,1],
    "3":[1,1,1,1,0,0,1],"4":[0,1,1,0,0,1,1],"5":[1,0,1,1,0,1,1],
    "6":[1,0,1,1,1,1,1],"7":[1,1,1,0,0,0,0],"8":[1,1,1,1,1,1,1],"9":[1,1,1,1,0,1,1],
};

function drawSeg(ctx,digit,x,y,sz,color){
    const w=sz*0.62,h=sz,t=sz*0.13,g=sz*0.04;
    const segs=SEG_ON[digit]||[0,0,0,0,0,0,0];
    const dH=(sx,sy)=>{ctx.beginPath();ctx.moveTo(sx+g,sy);ctx.lineTo(sx+w-g,sy);ctx.lineTo(sx+w-g-t,sy+t);ctx.lineTo(sx+g+t,sy+t);ctx.closePath();ctx.fill();};
    const dV=(sx,sy,top)=>{ctx.beginPath();if(top){ctx.moveTo(sx,sy+g);ctx.lineTo(sx+t,sy+g+t);ctx.lineTo(sx+t,sy+h/2-g);ctx.lineTo(sx,sy+h/2-g);}else{ctx.moveTo(sx,sy+h/2+g);ctx.lineTo(sx+t,sy+h/2+g);ctx.lineTo(sx+t,sy+h-g-t);ctx.lineTo(sx,sy+h-g);}ctx.closePath();ctx.fill();};
    // dim ghost segments
    ctx.globalAlpha=0.1;ctx.fillStyle=color;
    dH(x,y);dH(x,y+h/2-t/2);dH(x,y+h-t);
    dV(x+w-t,y,true);dV(x+w-t,y,false);dV(x,y,false);dV(x,y,true);
    // lit segments
    ctx.globalAlpha=1;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=14;
    if(segs[0])dH(x,y);if(segs[1])dV(x+w-t,y,true);if(segs[2])dV(x+w-t,y,false);
    if(segs[3])dH(x,y+h-t);if(segs[4])dV(x,y,false);if(segs[5])dV(x,y,true);if(segs[6])dH(x,y+h/2-t/2);
    ctx.shadowBlur=0;
}

function drawTimer(ctx,text,x,y,sz,color){
    ctx.save();
    let cx=x;
    for(const ch of text){
        if(ch==="."||ch===":"){
            ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.globalAlpha=1;
            if(ch===":"){
                ctx.beginPath();ctx.arc(cx+sz*0.15,y+sz*0.28,sz*0.09,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(cx+sz*0.15,y+sz*0.68,sz*0.09,0,Math.PI*2);ctx.fill();
            }else{
                ctx.beginPath();ctx.arc(cx+sz*0.15,y+sz*0.88,sz*0.09,0,Math.PI*2);ctx.fill();
            }
            cx+=sz*0.36;
        }else{
            drawSeg(ctx,ch,cx,y,sz,color);
            cx+=sz*0.76;
        }
    }
    ctx.restore();
}

// ── Global timer state ────────────────────────────────────────────────────────
let _promptStartTime = null;
let _promptRunning   = false;
let _promptElapsedMs = null;
let _globalTick      = null;

function startGlobalTimer(){
    _promptStartTime = performance.now();
    _promptRunning   = true;
    _promptElapsedMs = null;
    if(_globalTick) clearInterval(_globalTick);
    _globalTick = setInterval(()=>{
        if(!_promptRunning){clearInterval(_globalTick);_globalTick=null;return;}
        // Force redraw on all cleanup nodes
        const nodes=app.graph?.nodes??[];
        nodes.filter(n=>n.type===NODE_TYPE).forEach(n=>n.setDirtyCanvas(true,false));
    },50);
}

function stopGlobalTimer(){
    if(_promptStartTime!==null) _promptElapsedMs=performance.now()-_promptStartTime;
    _promptRunning=false;
    if(_globalTick){clearInterval(_globalTick);_globalTick=null;}
    const nodes=app.graph?.nodes??[];
    nodes.filter(n=>n.type===NODE_TYPE).forEach(n=>n.setDirtyCanvas(true));
}

app.registerExtension({
    name:"Winnougan.CacheCleanup",
    async setup(){
        // Hook API events once at setup time — more reliable than beforeRegisterNodeDef
        api.addEventListener("execution_start",       ()=>startGlobalTimer());
        api.addEventListener("execution_end",         ()=>stopGlobalTimer());
        api.addEventListener("execution_interrupted", ()=>stopGlobalTimer());
        api.addEventListener("execution_error",       ()=>stopGlobalTimer());
    },
    async beforeRegisterNodeDef(nodeType,nodeData){
        if(nodeData.name!==NODE_TYPE)return;

        const origCreated=nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated=function(){
            origCreated?.call(this);
            this.color  ="#0a1a0a";
            this.bgcolor="#050f05";
            this.title  ="🧹 Winnougan Cache Cleanup";
            this._sparkles =new SparkleSystem(12);
            this._neonColor=randomNeon();
            this._vramFree =null;
            this._vramTotal=null;
        };

        nodeType.prototype.onExecuted=function(data){
            if(data?.vram_free_gb!==undefined){
                this._vramFree =data.vram_free_gb[0];
                this._vramTotal=data.vram_total_gb[0];
            }
            this._neonColor=randomNeon();
            this.setDirtyCanvas(true);
        };

        const origBg=nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground=function(ctx){
            origBg?.call(this,ctx);
            if(this.flags?.collapsed)return;
            if(!this._sparkles)this._sparkles=new SparkleSystem(12);
            const w=this.size[0],h=this.size[1]+LiteGraph.NODE_TITLE_HEIGHT;
            const yOff=-LiteGraph.NODE_TITLE_HEIGHT,r=8;
            const t=Date.now()/1000;
            const pulse=0.5+0.5*Math.sin(t*(2*Math.PI/3));
            const pulse2=0.5+0.5*Math.sin(t*(2*Math.PI/5)+1.0);
            const neon=this._neonColor??"#00ff88";
            app.graph.setDirtyCanvas(true,false);
            ctx.save();
            ctx.shadowColor="#22dd66";ctx.shadowBlur=28+pulse*30;ctx.strokeStyle="#22dd66";ctx.lineWidth=1;ctx.globalAlpha=0.12+pulse*0.15;
            ctx.beginPath();ctx.roundRect(-2,yOff-2,w+4,h+4,r+2);ctx.stroke();
            ctx.shadowColor=neon;ctx.shadowBlur=18+pulse*22;ctx.strokeStyle=neon;ctx.lineWidth=2;ctx.globalAlpha=0.28+pulse*0.35;
            ctx.beginPath();ctx.roundRect(0,yOff,w,h,r);ctx.stroke();
            ctx.shadowBlur=8+pulse2*10;ctx.globalAlpha=0.5+pulse2*0.3;ctx.lineWidth=1.5;ctx.strokeStyle="#6aefa0";
            ctx.beginPath();ctx.roundRect(1,yOff+1,w-2,h-2,r);ctx.stroke();
            ctx.shadowColor="#a0ffc0";ctx.shadowBlur=8;ctx.globalAlpha=0.3+pulse*0.5;ctx.fillStyle="#a0ffc0";
            const dotR=2+pulse*1.5;
            for(const[cx,cy]of[[2,yOff+2],[w-2,yOff+2],[2,yOff+h-2],[w-2,yOff+h-2]]){ctx.beginPath();ctx.arc(cx,cy,dotR,0,Math.PI*2);ctx.fill();}
            ctx.restore();
            this._sparkles.update(w,h,yOff);
            this._sparkles.draw(ctx,neon);
        };

        const origFg=nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground=function(ctx){
            origFg?.call(this,ctx);
            if(this.flags?.collapsed)return;
            const W=this.size[0],H=this.size[1];
            const TH=LiteGraph.NODE_TITLE_HEIGHT,wH=LiteGraph.NODE_WIDGET_HEIGHT??20;
            const color=this._neonColor??"#00ff88";

            const vis=(this.widgets??[]).filter(w=>!w.hidden&&w.type!=="hidden").length;
            const widgetsEnd=TH+4+vis*(wH+4)+6;
            const panelY=widgetsEnd+6;
            const panelH=H-panelY-6;
            if(panelH<30)return;

            ctx.save();

            // Badge
            ctx.font="bold 10px sans-serif";ctx.textAlign="right";ctx.textBaseline="alphabetic";
            ctx.fillStyle="#4ade80";ctx.shadowColor="#4ade80";
            ctx.shadowBlur=6+(0.5+0.5*Math.sin(Date.now()/1000*(2*Math.PI/3)))*4;
            ctx.fillText("⚡ WINNOUGAN",W-8,14);ctx.shadowBlur=0;

            // Black gradient panel
            const grad=ctx.createLinearGradient(10,panelY,10,panelY+panelH);
            grad.addColorStop(0,"rgba(0,0,0,0.98)");
            grad.addColorStop(0.5,"rgba(2,8,4,0.95)");
            grad.addColorStop(1,"rgba(0,15,8,0.80)");
            ctx.fillStyle=grad;ctx.globalAlpha=1;
            ctx.beginPath();ctx.roundRect(10,panelY,W-20,panelH,8);ctx.fill();
            ctx.strokeStyle=color;ctx.lineWidth=0.8;ctx.globalAlpha=0.35;
            ctx.beginPath();ctx.roundRect(10,panelY,W-20,panelH,8);ctx.stroke();ctx.globalAlpha=1;

            // Scanlines
            ctx.strokeStyle=color;ctx.lineWidth=0.3;ctx.globalAlpha=0.04;
            for(let sy=panelY+3;sy<panelY+panelH-2;sy+=4){ctx.beginPath();ctx.moveTo(12,sy);ctx.lineTo(W-12,sy);ctx.stroke();}
            ctx.globalAlpha=1;

            // Get display value from global timer state
            let displayMs=null,isLive=false;
            if(_promptRunning&&_promptStartTime!==null){
                displayMs=performance.now()-_promptStartTime;isLive=true;
            }else if(_promptElapsedMs!==null){
                displayMs=_promptElapsedMs;
            }

            const centerY=panelY+panelH/2;

            if(displayMs!==null){
                const totalSec=Math.floor(displayMs/1000);
                const mins=Math.floor(totalSec/60);
                const secs=totalSec%60;
                const ms3=Math.floor(displayMs%1000);
                const dStr=totalSec>=60
                    ?mins.toString().padStart(2,"0")+":"+secs.toString().padStart(2,"0")
                    :secs.toString().padStart(2,"0")+"."+ms3.toString().padStart(3,"0");

                const sz=Math.min(panelH*0.55,34);
                // measure total width
                const charW=sz*0.76;
                const sepW=sz*0.36;
                const nDigits=dStr.replace(/[:.]/g,"").length;
                const nSeps=dStr.split("").filter(c=>c===":"||c===".").length;
                const totalW=nDigits*charW+nSeps*sepW;
                const startX=W/2-totalW/2;
                const startY=centerY-sz/2-2;

                drawTimer(ctx,dStr,startX,startY,sz,color);

                // LIVE pulse
                if(isLive){
                    const p=0.5+0.5*Math.sin(Date.now()/160);
                    ctx.font="bold 9px monospace";ctx.textAlign="left";ctx.textBaseline="middle";
                    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=5;ctx.globalAlpha=0.4+p*0.6;
                    ctx.fillText("● LIVE",16,panelY+10);ctx.shadowBlur=0;ctx.globalAlpha=1;
                }

                // Unit label
                const unitLabel=totalSec>=60?"min : sec":"sec . ms";
                ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
                ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=3;ctx.globalAlpha=0.55;
                ctx.fillText(unitLabel,W/2,panelY+panelH-9);ctx.shadowBlur=0;ctx.globalAlpha=1;

                // VRAM
                if(!isLive&&this._vramFree!==null){
                    ctx.font="9px monospace";ctx.textAlign="left";ctx.textBaseline="middle";
                    ctx.fillStyle=color;ctx.globalAlpha=0.45;
                    ctx.fillText(`VRAM ${this._vramFree}/${this._vramTotal}GB`,16,panelY+10);
                    ctx.globalAlpha=1;
                }
            }else{
                // Idle
                ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
                ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=4;ctx.globalAlpha=0.15;
                ctx.fillText("00.000",W/2,centerY-2);ctx.shadowBlur=0;
                ctx.font="9px monospace";ctx.globalAlpha=0.25;
                ctx.fillText("sec . ms",W/2,panelY+panelH-9);ctx.globalAlpha=1;
            }

            ctx.restore();
        };

        nodeType.prototype.computeSize=function(){
            const TH=LiteGraph.NODE_TITLE_HEIGHT,wH=LiteGraph.NODE_WIDGET_HEIGHT??20;
            const vis=(this.widgets??[]).filter(w=>!w.hidden&&w.type!=="hidden").length;
            return[300,TH+4+vis*(wH+4)+6+6+90+6];
        };
    },
});
