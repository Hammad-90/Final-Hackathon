const BASE=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
export function getToken(){return localStorage.getItem("hcm_token")}
export async function api(path,options={}){const headers={"Content-Type":"application/json",...(options.headers||{})};if(getToken())headers.Authorization=`Bearer ${getToken()}`;const res=await fetch(`${BASE}${path}`,{...options,headers});const data=await res.json().catch(()=>({message:"Unexpected server response"}));if(!res.ok)throw new Error(data.message||"Request failed");return data}
export const post=(path,body)=>api(path,{method:"POST",body:JSON.stringify(body)});
export const patch=(path,body)=>api(path,{method:"PATCH",body:JSON.stringify(body)});
export const put=(path,body)=>api(path,{method:"PUT",body:JSON.stringify(body)});
