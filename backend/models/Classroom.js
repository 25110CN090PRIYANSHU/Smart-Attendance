const mongoose = require("mongoose");
const classroomSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:100},
  building:{type:String,trim:true,default:""},
  floor:{type:String,trim:true,default:""},
  capacity:{type:Number,default:60,min:1,max:1000},
  location:{lat:Number,lng:Number,radiusMeters:{type:Number,default:100,min:10,max:1000}},
  active:{type:Boolean,default:true}
},{timestamps:true});
classroomSchema.index({name:1},{unique:true});
module.exports=mongoose.model("Classroom",classroomSchema);
