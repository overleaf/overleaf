mongoose = require('mongoose')
Settings = require 'settings-sharelatex'
DocSchema = require('./Doc').DocSchema
FileSchema = require('./File').FileSchema

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

FolderSchema = new Schema
	name                         :     {type:String, default:'new folder'}

FolderSchema.add
	docs                         :     [DocSchema]
	fileRefs                     :     [FileSchema]
	folders                      :     [FolderSchema]


mongoose.model('Folder', FolderSchema)
exports.Folder = mongoose.model('Folder')
exports.FolderSchema = FolderSchema
