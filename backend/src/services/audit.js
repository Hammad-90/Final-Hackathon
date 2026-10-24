import { AuditLog } from "../models.js";
export async function audit(user,action,entity,entityId="",before=null,after=null){
  await AuditLog.create({actorId:user?._id,actorName:user?.name||"System",action,entity,entityId:String(entityId||""),before,after});
}
