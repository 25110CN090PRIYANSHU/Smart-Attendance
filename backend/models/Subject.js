const mongoose = require("mongoose");
const subjectSchema = new mongoose.Schema({
  code:{type:String,required:true,trim:true,uppercase:true,maxlength:20},
  name:{type:String,required:true,trim:true,maxlength:100},
  branch:{type:String,trim:true,default:""},
  year:{type:String,trim:true,default:""},
  section:{type:String,trim:true,default:""},
  teacherId:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
  active:{type:Boolean,default:true}
},{timestamps:true});
subjectSchema.index({code:1},{unique:true});
module.exports=mongoose.model("Subject",subjectSchema);
