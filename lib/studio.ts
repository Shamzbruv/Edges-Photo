export const packages = [
{id:'portrait',name:'The Portrait',category:'Portraits',duration:60,images:8,price:18000,usd:120,description:'A little direction. A lot of you. Studio or on location, with space to be yourself.'},
{id:'milestone',name:'The Milestone',category:'Birthdays',duration:120,images:15,price:28000,usd:185,description:'Another chapter, beautifully celebrated. Creative portraits with your own kind of energy.'},
{id:'wedding',name:'The Forever',category:'Weddings',duration:480,images:150,price:150000,usd:1000,description:'From the quiet anticipation to the last dance. Your story, told with feeling.'},
{id:'maternity',name:'The Beginning',category:'Maternity',duration:120,images:12,price:24000,usd:160,description:'The beautiful in-between. An unhurried session celebrating a brand-new chapter.'},
{id:'event',name:'The Gathering',category:'Events',duration:120,images:40,price:35000,usd:235,description:'The people, the atmosphere, the fleeting little moments. Nothing forced.'}
];
export const defaults={depositPercent:30,leadHours:48,horizonDays:180,closedDays:[0],blockedDates:[] as string[],bankInstructions:'',lynkInstructions:'',wipayMeUrl:'',fygaroUrl:'',bankCardUrl:'',pricingApproved:false,prices:Object.fromEntries(packages.map(p=>[p.id,{jmd:p.price,usd:p.usd}]))};
export type StudioSettings=typeof defaults;
export const money=(n:number,currency='JMD')=>(currency==='JMD'?'J$':'US$')+new Intl.NumberFormat('en-JM',{minimumFractionDigits:currency==='JMD'?0:2,maximumFractionDigits:currency==='JMD'?0:2}).format(n);
export const timeLabel=(s:string)=>{const h=Number(s.slice(0,2));return `${h>12?h-12:h}:00 ${h>=12?'PM':'AM'}`};
export const sessionTimes=['09:00','11:00','13:00','15:00'];
export function occupiedSlots(service:string,date:string,time:string){return (service==='wedding'?sessionTimes:[time]).map(t=>`${date}_${t}`)}
