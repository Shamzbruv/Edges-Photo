export type WheelColour={h:number;s:number;v:number;a:number};
const clamp=(n:number,min=0,max=1)=>Math.min(max,Math.max(min,n));
export function rgbToWheel(r:number,g:number,b:number,a=1):WheelColour{
 r=clamp(r/255);g=clamp(g/255);b=clamp(b/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;
 return {h,s:max===0?0:d/max,v:max,a:clamp(a)};
}
export function wheelRgb(c:WheelColour):[number,number,number]{
 const h=((c.h%360)+360)%360/60,s=clamp(c.s),v=clamp(c.v),x=v*(1-s),y=v*(1-(h%1)*s),z=v*(1-(1-h%1)*s);
 const rgb=[[v,z,x],[y,v,x],[x,v,z],[x,y,v],[z,x,v],[v,x,y]][Math.floor(h)%6];return rgb.map(n=>Math.round(n*255)) as [number,number,number];
}
export function colourCss(c:WheelColour){const [r,g,b]=wheelRgb(c);return c.a>=.999?'#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''):`rgba(${r}, ${g}, ${b}, ${Math.round(clamp(c.a)*100)/100})`}
export function parseColour(input:string):WheelColour|null{
 const s=input.trim().toLowerCase();if(s==='transparent')return rgbToWheel(0,0,0,0);
 const hex=s.match(/^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i);
 if(hex){let v=hex[1];if(v.length<5)v=v.split('').map(x=>x+x).join('');return rgbToWheel(parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16),v.length===8?parseInt(v.slice(6,8),16)/255:1)}
 const rgb=s.match(/^rgba?\(([^)]+)\)$/);if(!rgb)return null;
 const p=rgb[1].replace(/\s*\/\s*/,',').trim().split(/[\s,]+/);if(p.length<3||p.length>4||p.some(n=>!/^[-+]?(?:\d*\.)?\d+%?$/.test(n)))return null;
 const channel=(n:string)=>clamp(parseFloat(n)/(n.endsWith('%')?100:255))*255;
 return rgbToWheel(channel(p[0]),channel(p[1]),channel(p[2]),p[3]===undefined?1:parseFloat(p[3])/(p[3].endsWith('%')?100:1));
}
