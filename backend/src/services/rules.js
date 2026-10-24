export const dateKey = (d=new Date()) => {
  const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};
export function workingDays(start,end,weekend=[0,6],holidays=[]){
  let n=0; const d=new Date(start); d.setHours(12,0,0,0); const e=new Date(end); e.setHours(12,0,0,0);
  while(d<=e){ if(!weekend.includes(d.getDay())&&!holidays.includes(dateKey(d))) n++; d.setDate(d.getDate()+1); } return n;
}
export function taxForGross(gross){
  const annual=gross*12;
  if(annual<=600000)return 0;
  if(annual<=1200000)return Math.round((annual-600000)*.05/12);
  if(annual<=2400000)return Math.round((30000+(annual-1200000)*.15)/12);
  if(annual<=3600000)return Math.round((210000+(annual-2400000)*.25)/12);
  return Math.round((510000+(annual-3600000)*.35)/12);
}
export function distanceMeters(lat1,lon1,lat2,lon2){
 const R=6371000, rad=x=>x*Math.PI/180, dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
 return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
