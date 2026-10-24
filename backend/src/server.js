import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import api from "./routes/api.js";
const app=express();
app.use(cors({origin:process.env.CLIENT_ORIGIN||"http://localhost:5173"}));
app.use(express.json({limit:"1mb"}));
app.get("/",(_,res)=>res.json({name:"HCM Lite API",status:"running"}));
app.use("/api",api);
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:"Server error"});});
const port=process.env.PORT||5000;
try{
 if(!process.env.MONGODB_URI||!process.env.JWT_SECRET)throw new Error("Set MONGODB_URI and JWT_SECRET in backend/.env");
 await mongoose.connect(process.env.MONGODB_URI);
 app.listen(port,()=>console.log(`HCM Lite API listening on ${port}`));
}catch(e){console.error("Startup failed:",e.message);process.exit(1)}
