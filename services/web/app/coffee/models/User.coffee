Project = require('./Project').Project
Settings = require 'settings-sharelatex'
_ = require('underscore')
mongoose = require('mongoose')
uuid = require('node-uuid')
Schema = mongoose.Schema
ObjectId = Schema.ObjectId

UserSchema = new Schema
	email             : {type : String, default : ''}
	first_name        : {type : String, default : ''}
	last_name         : {type : String, default : ''}
	role  	          : {type : String, default : ''}
	institution       : {type : String, default : ''}
	hashedPassword    : String
	isAdmin           : {type : Boolean, default : false}
	confirmed         : {type : Boolean, default : false}
	signUpDate        : {type : Date, default: () -> new Date() }
	lastLoggedIn      : {type : Date}
	loginCount        : {type : Number, default: 0}
	holdingAccount    : {type : Boolean, default: false}
	ace               : {
							mode        :   {type : String, default: 'none'}
							theme       :   {type : String, default: 'textmate'}
							fontSize    :   {type : Number, default:'12'}
							autoComplete:   {type : Boolean, default: true}
							spellCheckLanguage :   {type : String, default: "en"}
							pdfViewer   :   {type : String, default: "pdfjs"}
						}
	features		  : {
							collaborators: { type:Number,  default: Settings.defaultFeatures.collaborators }
							versioning:    { type:Boolean, default: Settings.defaultFeatures.versioning }
							dropbox:       { type:Boolean, default: Settings.defaultFeatures.dropbox }
							compileTimeout: { type:Number, default: Settings.defaultFeatures.compileTimeout }
							compileGroup:  { type:String,  default: Settings.defaultFeatures.compileGroup }
						}
	featureSwitches	  : {
							github: {type: Boolean}
						}
	referal_id : {type:String, default:() -> uuid.v4().split("-")[0]}
	refered_users: [ type:ObjectId, ref:'User' ]
	refered_user_count: { type:Number, default: 0 }
	subscription:
					recurlyToken : String
					freeTrialExpiresAt: Date
					freeTrialDowngraded: Boolean
					freeTrialPlanCode: String
					# This is poorly named. It does not directly correspond
					# to whether the user has has a free trial, but rather
					# whether they should be allowed one in the future.
					# For example, a user signing up directly for a paid plan
					# has this set to true, despite never having had a free trial
					hadFreeTrial: {type: Boolean, default: false}


UserSchema.statics.getAllIds = (callback)->
	this.find {}, ["first_name"], callback


UserSchema.statics.findReadOnlyProjects = (user_id, callback)->
	@find({'projects.readOnly_refs':user_id}).populate('projects.readOnly_refs').run (err, users)->
		projects = []
		_.each users, (user)->
			_.each user.projects, (project)->
				_.each project.readOnly_refs, (subUser)->
					if(subUser._id == user_id)
						projects.push(project)
		callback(projects)

UserSchema.statics.findCollaborationProjects = (user_id, callback)->
	@find({'projects.collaberator_refs':user_id}).populate('projects.collaberator_refs').run (err, users)->
		projects = []
		_.each users, (user)->
			_.each user.projects, (project)->
				_.each project.collaberator_refs, (subUser)->
					if(subUser._id == user_id)
						projects.push(project)
		callback(projects)



conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: 10)

User = conn.model('User', UserSchema)

model = mongoose.model 'User', UserSchema
exports.User = User
