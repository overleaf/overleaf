mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

QuoteSchema = new Schema
	author          :     {type:String, default:'new quote'}
	quote           :     {type:String}

mongoose.model 'Quote', QuoteSchema
exports.Quote = mongoose.model 'Quote'
exports.QuoteSchema = QuoteSchema
