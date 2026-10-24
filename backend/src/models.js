import mongoose from "mongoose";

const schema = (definition, options={}) => new mongoose.Schema(definition, {timestamps:true, ...options});
export const User = mongoose.model("User", schema({
  name:{type:String,required:true,trim:true}, email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  passwordHash:{type:String,required:true}, role:{type:String,enum:["Admin","HR","Employee"],required:true},
  employeeId:{type:mongoose.Schema.Types.ObjectId,ref:"Employee",default:null}, active:{type:Boolean,default:true}, mustChangePassword:{type:Boolean,default:false}
}));
export const Company = mongoose.model("Company", schema({
  name:{type:String,required:true}, officeStart:{type:String,default:"09:00"}, graceMinutes:{type:Number,default:15},
  weekend:{type:[Number],default:[0,6]}, officeLat:{type:Number,default:null}, officeLng:{type:Number,default:null}, officeRadiusM:{type:Number,default:150}
}));
export const Department = mongoose.model("Department", schema({name:{type:String,required:true,unique:true}}));
export const Employee = mongoose.model("Employee", schema({
  code:{type:String,required:true,unique:true}, name:{type:String,required:true}, email:{type:String,required:true,unique:true,lowercase:true},
  phone:{type:String,default:""}, address:{type:String,default:""}, department:{type:String,default:"General"}, designation:{type:String,default:"Employee"},
  joinDate:{type:Date,default:Date.now}, status:{type:String,enum:["Active","Probation","Exited"],default:"Active"},
  basicSalary:{type:Number,required:true,min:1}, userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null}
}));
export const Attendance = mongoose.model("Attendance", schema({
  employeeId:{type:mongoose.Schema.Types.ObjectId,ref:"Employee",required:true,index:true}, dateKey:{type:String,required:true},
  checkIn:{type:Date,default:null}, checkOut:{type:Date,default:null}, status:{type:String,enum:["present","late","half_day","absent","missing_checkout","on_leave"],default:"present"}, hours:{type:Number,default:0}
},{}));
Attendance.schema.index({employeeId:1,dateKey:1},{unique:true});
export const Leave = mongoose.model("Leave", schema({
  employeeId:{type:mongoose.Schema.Types.ObjectId,ref:"Employee",required:true}, type:{type:String,enum:["casual","sick","annual","unpaid"],default:"casual"},
  startDate:{type:Date,required:true}, endDate:{type:Date,required:true}, reason:{type:String,default:""}, status:{type:String,enum:["pending","approved","rejected","cancelled"],default:"pending"},
  reviewerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null}, comment:{type:String,default:""}, days:{type:Number,default:1}
}));
export const Payroll = mongoose.model("Payroll", schema({
  month:{type:String,required:true,unique:true}, status:{type:String,enum:["draft","finalized"],default:"draft"},
  rows:[{employeeId:mongoose.Schema.Types.ObjectId,employeeName:String,basic:Number,gross:Number,deductions:Number,tax:Number,net:Number}],
  totals:{gross:{type:Number,default:0},deductions:{type:Number,default:0},tax:{type:Number,default:0},net:{type:Number,default:0}}, finalizedBy:{type:mongoose.Schema.Types.ObjectId,default:null}, finalizedAt:{type:Date,default:null}
}));
export const Announcement = mongoose.model("Announcement", schema({title:{type:String,required:true},body:{type:String,required:true},authorId:mongoose.Schema.Types.ObjectId}));
export const AuditLog = mongoose.model("AuditLog", schema({actorId:mongoose.Schema.Types.ObjectId,actorName:String,action:String,entity:String,entityId:String,before:mongoose.Schema.Types.Mixed,after:mongoose.Schema.Types.Mixed}));
export const Notification = mongoose.model("Notification", schema({userId:mongoose.Schema.Types.ObjectId,title:String,body:String,read:{type:Boolean,default:false}}));
export const Settings = mongoose.model("Settings", schema({key:{type:String,unique:true},value:mongoose.Schema.Types.Mixed}));
