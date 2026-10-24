import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Company, Department, Employee, Attendance, Leave, Payroll, Announcement, AuditLog, Notification } from "../models.js";
import { auth, allow } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { dateKey, workingDays, taxForGross, distanceMeters } from "../services/rules.js";

const r=Router();
const safeUser=u=>({id:u._id,name:u.name,email:u.email,role:u.role,employeeId:u.employeeId,mustChangePassword:u.mustChangePassword});
const tokenFor=u=>jwt.sign({id:u._id},process.env.JWT_SECRET,{expiresIn:"7d"});
async function myEmployee(user){return user.role==="Employee" ? await Employee.findOne({userId:user._id}) : null}
async function empScope(req){return req.user.role==="Employee" ? await Employee.findOne({userId:req.user._id}) : null}
r.get("/health",(_,res)=>res.json({ok:true,service:"HCM Lite API"}));
r.get("/setup/status",async(_,res)=>res.json({setupRequired:!(await User.exists({role:"Admin"}))}));
r.post("/setup",async(req,res)=>{
 try{
  if(await User.exists({role:"Admin"})) return res.status(409).json({message:"Initial setup already completed"});
  const {companyName,name,email,password}=req.body;
  if(!companyName||!name||!email||!password||password.length<8) return res.status(400).json({message:"Company, name, email and password (8+ chars) are required"});
  await Company.create({name:companyName});
  const u=await User.create({name,email,passwordHash:await bcrypt.hash(password,12),role:"Admin"});
  await audit(u,"setup.create","Company",companyName,null,{companyName});
  res.status(201).json({token:tokenFor(u),user:safeUser(u)});
 }catch(e){res.status(400).json({message:e.code===11000?"Email already exists":e.message})}
});
r.post("/auth/login",async(req,res)=>{
 const {email,password}=req.body; const u=await User.findOne({email:(email||"").toLowerCase()});
 if(!u||!u.active||!(await bcrypt.compare(password||"",u.passwordHash)))return res.status(401).json({message:"Invalid email or password"});
 res.json({token:tokenFor(u),user:safeUser(u)});
});
r.get("/auth/me",auth,(req,res)=>res.json({user:safeUser(req.user)}));
r.post("/auth/change-password",auth,async(req,res)=>{
 const {currentPassword,newPassword}=req.body;
 if(!newPassword||newPassword.length<8)return res.status(400).json({message:"New password must be at least 8 characters"});
 const u=await User.findById(req.user._id);
 if(!(await bcrypt.compare(currentPassword||"",u.passwordHash)))return res.status(400).json({message:"Current password is incorrect"});
 u.passwordHash=await bcrypt.hash(newPassword,12);u.mustChangePassword=false;await u.save();await audit(u,"auth.change_password","User",u._id);
 res.json({message:"Password changed"});
});
r.get("/company",auth,allow("Admin","HR"),async(_,res)=>res.json({company:await Company.findOne()}));
r.put("/company",auth,allow("Admin"),async(req,res)=>{
 const old=await Company.findOne(); if(!old)return res.status(404).json({message:"Company not set up"});
 for(const k of ["name","officeStart","graceMinutes","weekend","officeLat","officeLng","officeRadiusM"])if(req.body[k]!==undefined)old[k]=req.body[k];
 await old.save();await audit(req.user,"company.update","Company",old._id,null,old.toObject());res.json({company:old});
});
r.get("/departments",auth,allow("Admin","HR"),async(_,res)=>res.json({departments:await Department.find().sort("name")}));
r.post("/departments",auth,allow("Admin"),async(req,res)=>{
 const name=(req.body.name||"").trim();if(!name)return res.status(400).json({message:"Department name required"});
 try{const d=await Department.create({name});await audit(req.user,"department.create","Department",d._id,null,d.toObject());res.status(201).json({department:d})}
 catch(e){res.status(400).json({message:e.code===11000?"Department already exists":e.message})}
});
r.get("/employees",auth,allow("Admin","HR"),async(req,res)=>{
 const {q="",department=""}=req.query;const filter={};if(department)filter.department=department;
 if(q)filter.$or=[{name:new RegExp(q,"i")},{email:new RegExp(q,"i")},{code:new RegExp(q,"i")}];
 const employees=await Employee.find(filter).sort({createdAt:-1}).limit(300);res.json({employees});
});
r.post("/employees",auth,allow("HR"),async(req,res)=>{
 try{
  const {code,name,email,phone,address,department,designation,joinDate,basicSalary}=req.body;
  if(!code||!name||!email||!(Number(basicSalary)>0))return res.status(400).json({message:"Code, name, email and salary > 0 are required"});
  const tempPassword=Math.random().toString(36).slice(-5)+"A9!";
  const user=await User.create({name,email,passwordHash:await bcrypt.hash(tempPassword,12),role:"Employee",mustChangePassword:true});
  const employee=await Employee.create({code,name,email,phone,address,department,designation,joinDate:joinDate||new Date(),basicSalary:Number(basicSalary),userId:user._id});
  user.employeeId=employee._id;await user.save();await audit(req.user,"employee.create","Employee",employee._id,null,employee.toObject());
  res.status(201).json({employee,login:{email,password:tempPassword,notice:"Share securely; employee must change password at first sign-in."}});
 }catch(e){res.status(400).json({message:e.code===11000?"Employee code or email already exists":e.message})}
});
r.get("/employees/me",auth,allow("Employee"),async(req,res)=>{const employee=await empScope(req);if(!employee)return res.status(404).json({message:"Employee profile not found"});res.json({employee})});
r.patch("/employees/me",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);if(!e)return res.status(404).json({message:"Employee profile not found"});
 for(const k of ["phone","address"])if(req.body[k]!==undefined)e[k]=req.body[k];await e.save();await audit(req.user,"employee.self_update","Employee",e._id);
 res.json({employee:e});
});
r.get("/attendance",auth,async(req,res)=>{
 const scope=await empScope(req);const filter={};if(scope)filter.employeeId=scope._id;if(req.query.from||req.query.to)filter.dateKey={};if(req.query.from)filter.dateKey.$gte=req.query.from;if(req.query.to)filter.dateKey.$lte=req.query.to;
 const rows=await Attendance.find(filter).populate("employeeId","name code department").sort({dateKey:-1}).limit(500);res.json({attendance:rows});
});
r.post("/attendance/check-in",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);if(!e)return res.status(404).json({message:"Employee profile not found"});
 const key=dateKey();if(await Attendance.exists({employeeId:e._id,dateKey:key}))return res.status(409).json({message:"Already checked in today"});
 const company=await Company.findOne();const now=new Date();const [hh,mm]=(company?.officeStart||"09:00").split(":").map(Number);
 const threshold=new Date(now);threshold.setHours(hh,mm+(company?.graceMinutes||15),0,0);
 const row=await Attendance.create({employeeId:e._id,dateKey:key,checkIn:now,status:now>threshold?"late":"present"});
 await audit(req.user,"attendance.check_in","Attendance",row._id,null,row.toObject());res.status(201).json({attendance:row});
});
r.post("/attendance/check-out",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);const row=await Attendance.findOne({employeeId:e?._id,dateKey:dateKey()});
 if(!row)return res.status(404).json({message:"Check in first"});if(row.checkOut)return res.status(409).json({message:"Already checked out"});
 row.checkOut=new Date();row.hours=Math.max(0,(row.checkOut-row.checkIn)/3600000);if(row.hours<5)row.status="half_day";else if(row.status!=="late")row.status="present";await row.save();
 await audit(req.user,"attendance.check_out","Attendance",row._id);res.json({attendance:row});
});
r.post("/attendance/correction",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);const {date,reason}=req.body;if(!date||!reason)return res.status(400).json({message:"Date and reason required"});
 const n=await Notification.create({userId:null,title:"Attendance correction request",body:`${e.name} (${e.code}) requests correction for ${date}: ${reason}`});
 await audit(req.user,"attendance.correction_request","Notification",n._id);res.status(201).json({message:"Correction request sent to HR"});
});
r.get("/leaves",auth,async(req,res)=>{
 const e=await empScope(req);const filter=e?{employeeId:e._id}:{};
 const leaves=await Leave.find(filter).populate("employeeId","name code department").sort({createdAt:-1}).limit(500);res.json({leaves});
});
r.get("/leaves/balance",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);if(!e)return res.status(404).json({message:"Employee profile not found"});
 const y=new Date().getFullYear();const quotas={annual:14,sick:8,casual:10,unpaid:Infinity};const balance={};
 for(const type of Object.keys(quotas)){const used=await Leave.aggregate([{$match:{employeeId:e._id,type,status:"approved",startDate:{$gte:new Date(`${y}-01-01`),$lt:new Date(`${y+1}-01-01`)}}},{$group:{_id:null,total:{$sum:"$days"}}}]);balance[type]={quota:quotas[type],used:used[0]?.total||0,left:quotas[type]===Infinity?"Unlimited":Math.max(0,quotas[type]-(used[0]?.total||0))};}
 res.json({balance});
});
r.post("/leaves",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);const {type="casual",startDate,endDate,reason=""}=req.body;
 if(!e||!startDate||!endDate||new Date(endDate)<new Date(startDate))return res.status(400).json({message:"Valid start and end dates required"});
 const start=new Date(startDate),end=new Date(endDate);const days=workingDays(start,end,[0,6]);
 if(days<1)return res.status(422).json({message:"Request must include at least one working day"});
 if(await Leave.exists({employeeId:e._id,status:{$in:["pending","approved"]},startDate:{$lte:end},endDate:{$gte:start}}))return res.status(422).json({message:"Leave dates overlap an existing request"});
 const quotas={annual:14,sick:8,casual:10};if(type!=="unpaid"){const used=await Leave.aggregate([{$match:{employeeId:e._id,type,status:{$in:["pending","approved"]},startDate:{$gte:new Date(`${new Date().getFullYear()}-01-01`)}}},{$group:{_id:null,total:{$sum:"$days"}}}]);if((used[0]?.total||0)+days>(quotas[type]||0))return res.status(422).json({message:"Insufficient leave balance"});}
 const leave=await Leave.create({employeeId:e._id,type,startDate:start,endDate:end,reason,days});await audit(req.user,"leave.create","Leave",leave._id,null,leave.toObject());res.status(201).json({leave});
});
r.patch("/leaves/:id/decision",auth,allow("HR"),async(req,res)=>{
 const leave=await Leave.findById(req.params.id);if(!leave)return res.status(404).json({message:"Leave request not found"});
 if(leave.status!=="pending")return res.status(409).json({message:"Only pending requests can be decided"});
 const {status,comment=""}=req.body;if(!["approved","rejected"].includes(status))return res.status(400).json({message:"Decision must be approved or rejected"});
 leave.status=status;leave.comment=comment;leave.reviewerId=req.user._id;await leave.save();
 const emp=await Employee.findById(leave.employeeId);if(emp?.userId)await Notification.create({userId:emp.userId,title:`Leave ${status}`,body:`Your leave request was ${status}. ${comment}`});
 await audit(req.user,`leave.${status}`,"Leave",leave._id);res.json({leave});
});
r.delete("/leaves/:id",auth,allow("Employee"),async(req,res)=>{
 const e=await empScope(req);const leave=await Leave.findOne({_id:req.params.id,employeeId:e?._id});
 if(!leave)return res.status(404).json({message:"Leave request not found"});if(leave.status!=="pending")return res.status(409).json({message:"Only pending leave can be cancelled"});
 leave.status="cancelled";await leave.save();await audit(req.user,"leave.cancel","Leave",leave._id);res.json({message:"Leave cancelled"});
});
r.get("/payroll",auth,allow("Admin","HR"),async(_,res)=>res.json({payroll:await Payroll.find().sort({month:-1})}));
r.post("/payroll/run",auth,allow("HR"),async(req,res)=>{
 const {month}=req.body;if(!/^\d{4}-\d{2}$/.test(month||""))return res.status(400).json({message:"Month must be YYYY-MM"});
 if(await Payroll.exists({month}))return res.status(409).json({message:"Payroll already exists for this month"});
 const employees=await Employee.find({status:{$in:["Active","Probation"]}});const rows=[];
 for(const e of employees){
  const basic=e.basicSalary,gross=basic*1.5;const start=new Date(`${month}-01T00:00:00`),end=new Date(start.getFullYear(),start.getMonth()+1,0,23,59,59);
  const att=await Attendance.find({employeeId:e._id,dateKey:{$gte:dateKey(start),$lte:dateKey(end)}});
  const absent=att.filter(a=>a.status==="absent").length,half=att.filter(a=>a.status==="half_day").length;
  const unpaid=await Leave.aggregate([{$match:{employeeId:e._id,type:"unpaid",status:"approved",startDate:{$lte:end},endDate:{$gte:start}}},{$group:{_id:null,total:{$sum:"$days"}}}]);
  const working=22, perDay=gross/working, deductions=Math.round((absent+(unpaid[0]?.total||0)+half*.5)*perDay);
  const tax=taxForGross(gross),net=Math.max(0,Math.round(gross-deductions-tax));
  rows.push({employeeId:e._id,employeeName:e.name,basic,gross,deductions,tax,net});
 }
 const totals=rows.reduce((a,x)=>({gross:a.gross+x.gross,deductions:a.deductions+x.deductions,tax:a.tax+x.tax,net:a.net+x.net}),{gross:0,deductions:0,tax:0,net:0});
 const p=await Payroll.create({month,rows,totals});await audit(req.user,"payroll.run","Payroll",p._id,null,{month,totals});res.status(201).json({payroll:p});
});
r.post("/payroll/:id/finalize",auth,allow("Admin"),async(req,res)=>{
 const p=await Payroll.findById(req.params.id);if(!p)return res.status(404).json({message:"Payroll not found"});
 if(p.status==="finalized")return res.status(409).json({message:"Already finalized"});p.status="finalized";p.finalizedBy=req.user._id;p.finalizedAt=new Date();await p.save();
 await audit(req.user,"payroll.finalize","Payroll",p._id,null,{month:p.month,status:p.status});res.json({payroll:p});
});
r.get("/announcements",auth,async(req,res)=>{const list=await Announcement.find().sort({createdAt:-1}).limit(100);res.json({announcements:list})});
r.post("/announcements",auth,allow("Admin","HR"),async(req,res)=>{
 const {title,body}=req.body;if(!title||!body)return res.status(400).json({message:"Title and message required"});
 const a=await Announcement.create({title,body,authorId:req.user._id});await audit(req.user,"announcement.create","Announcement",a._id);res.status(201).json({announcement:a});
});
r.get("/notifications",auth,async(req,res)=>res.json({notifications:await Notification.find({userId:req.user._id}).sort({createdAt:-1}).limit(100)}));
r.get("/audit",auth,allow("Admin"),async(_,res)=>res.json({logs:await AuditLog.find().sort({createdAt:-1}).limit(200)}));
r.get("/dashboard",auth,async(req,res)=>{
 const e=await empScope(req);const today=dateKey();const base={};if(e)base.employeeId=e._id;
 const [employees,present,late,leaves,pending,payroll,announcements]=await Promise.all([
  req.user.role==="Employee"?Promise.resolve(1):Employee.countDocuments({status:{$in:["Active","Probation"]}}),
  Attendance.countDocuments({...base,dateKey:today,status:{$in:["present","late","missing_checkout"]}}),
  Attendance.countDocuments({...base,dateKey:today,status:"late"}),
  Leave.countDocuments({...base,status:"approved",startDate:{$lte:new Date()},endDate:{$gte:new Date()}}),
  req.user.role==="HR"?Leave.countDocuments({status:"pending"}):0,
  req.user.role==="Employee"?Promise.resolve(null):Payroll.findOne().sort({month:-1}),
  Announcement.find().sort({createdAt:-1}).limit(5)
 ]);
 const ownAttendance=e?await Attendance.find({employeeId:e._id}).sort({dateKey:-1}).limit(60):[];
 const ownLeaves=e?await Leave.find({employeeId:e._id}).sort({createdAt:-1}).limit(20):[];
 const ownPayroll=e?await Payroll.findOne({"rows.employeeId":e._id,status:"finalized"}).sort({month:-1}):null;
 res.json({role:req.user.role,kpis:{employees,present,late,onLeave:leaves,pendingApprovals:pending,payrollCost:payroll?.totals?.gross||0},attendance:ownAttendance,leaves:ownLeaves,lastPayslip:ownPayroll,announcements});
});
r.post("/ai/chat",auth,async(req,res)=>{
 const question=(req.body.message||"").trim();if(!question)return res.status(400).json({message:"Enter a question"});
 const e=await empScope(req);let data={},answer="";
 const q=question.toLowerCase();
 if(q.includes("salary")&&req.user.role==="Employee"&&!q.includes("my salary")) answer="I can’t share another employee’s salary. I can help with your own payslip.";
 else if(q.includes("headcount")||q.includes("how many employees")) data={activeEmployees:await Employee.countDocuments({status:{$in:["Active","Probation"]}})};
 else if(q.includes("late")) data={lateToday:await Attendance.countDocuments({dateKey:dateKey(),status:"late"})};
 else if(q.includes("leave")&&e){const y=new Date().getFullYear();const items=await Leave.find({employeeId:e._id,type:{$in:["annual","sick","casual"]},status:"approved",startDate:{$gte:new Date(`${y}-01-01`)}});data={approvedLeaveDays:items.reduce((s,l)=>s+l.days,0),policy:{annual:14,sick:8,casual:10}}}
 else if(q.includes("on leave"))data={employeesOnLeave:await Leave.countDocuments({status:"approved",startDate:{$lte:new Date()},endDate:{$gte:new Date()}})};
 else data={policy:{officeStart:"09:00",graceMinutes:15,halfDayUnderHours:5,leaveQuotas:{annual:14,sick:8,casual:10,unpaid:"unlimited"}}};
 if(process.env.AI_API_KEY){
  try{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
   const response=await fetch(`${(process.env.AI_BASE_URL||"https://api.openai.com/v1").replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{"Authorization":`Bearer ${process.env.AI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.AI_MODEL||"gpt-4o-mini",messages:[{role:"system",content:`You are HCM Lite assistant. Answer only using provided JSON facts and policy. Never disclose other employees' personal data to an Employee. If unknown say you do not know. Label AI-generated. Facts: ${JSON.stringify(data)}`},{role:"user",content:question}],temperature:0.2}),signal:controller.signal});clearTimeout(timer);
   const out=await response.json();if(response.ok)answer=out.choices?.[0]?.message?.content||"I couldn't generate an answer.";
  }catch{answer=""}
 }
 if(!answer)answer=`Based on available HCM Lite data: ${JSON.stringify(data)}. This is an AI-assisted answer; connect AI_API_KEY for natural-language responses.`;
 await audit(req.user,"ai.chat","AI",req.user._id,null,{question});res.json({answer,aiGenerated:true});
});
export default r;
