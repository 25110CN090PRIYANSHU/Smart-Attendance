const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  title:{type:String,required:true,maxlength:120},
  message:{type:String,required:true,maxlength:500},
  type:{type:String,default:"info",enum:["info","success","warning","danger"]},
  read:{type:Boolean,default:false},
  createdAt:{type:Date,default:Date.now}
});
notificationSchema.index({userId:1,createdAt:-1});
module.exports=mongoose.model("Notification",notificationSchema);
