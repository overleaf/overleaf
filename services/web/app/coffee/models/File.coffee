mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

FileSchema = new Schema
	name            :     type:String, default:''
	created     	:     type:Date, default: () -> new Date()
	rev 			:	  {type:Number, default:0}
	linkedFileData: { type: Schema.Types.Mixed }
	hash			:     type:String

mongoose.model 'File', FileSchema
exports.File = mongoose.model 'File'
exports.FileSchema = FileSchema
