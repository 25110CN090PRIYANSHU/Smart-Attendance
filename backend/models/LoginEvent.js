const mongoose=require("mongoose");
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},email:String,success:Boolean,ip:String,userAgent:String,createdAt:{type:Date,default:Date.now}},{timestamps:false});
schema.index({createdAt:-1});
module.exports=mongoose.model("LoginEvent",schema);
