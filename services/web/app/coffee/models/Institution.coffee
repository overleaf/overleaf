mongoose = require 'mongoose'
Schema = mongoose.Schema
ObjectId = Schema.ObjectId

InstitutionSchema = new Schema
	v1Id: { type: Number, required: true }
	managerIds: [ type:ObjectId, ref:'User' ]

mongoose.model 'Institution', InstitutionSchema
exports.Institution = mongoose.model 'Institution'
exports.InstitutionSchema = InstitutionSchema
