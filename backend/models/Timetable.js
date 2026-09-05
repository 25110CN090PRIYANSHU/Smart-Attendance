const mongoose = require("mongoose");
const timetableSchema = new mongoose.Schema({
  day:{type:Number,required:true,min:0,max:6},
  startTime:{type:String,required:true},
  endTime:{type:String,required:true},
  subjectId:{type:mongoose.Schema.Types.ObjectId,ref:"Subject",required:true},
  teacherId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
  classroomId:{type:mongoose.Schema.Types.ObjectId,ref:"Classroom",default:null},
  branch:{type:String,default:""},year:{type:String,default:""},section:{type:String,default:""},
  active:{type:Boolean,default:true}
},{timestamps:true});
timetableSchema.index({day:1,startTime:1});
module.exports=mongoose.model("Timetable",timetableSchema);
