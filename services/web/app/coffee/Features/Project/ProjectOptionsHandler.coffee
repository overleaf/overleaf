Project = require('../../models/Project').Project
logger = require('logger-sharelatex')
_ = require('underscore')
settings = require("settings-sharelatex")

safeCompilers = ["xelatex", "pdflatex", "latex", "lualatex"]

module.exports = 
	setCompiler : (project_id, compiler, callback = ()->)->
		logger.log project_id:project_id, compiler:compiler, "setting the compiler"
		compiler = compiler.toLowerCase()
		if !_.contains safeCompilers, compiler
			return callback()
		conditions = {_id:project_id}
		update = {compiler:compiler}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	setImageName : (project_id, imageName, callback = ()->)->
		logger.log project_id:project_id, imageName:imageName, "setting the imageName"
		imageName = imageName.toLowerCase()
		if ! _.some(settings.allowedImageNames, (allowed) -> imageName is allowed.imageName)
			return callback()
		conditions = {_id:project_id}
		update = {imageName: settings.imageRoot + '/' + imageName}
		Project.update conditions, update, {}, (err)->
			if callback?
				callback()

	setSpellCheckLanguage: (project_id, languageCode, callback = ()->)->
		logger.log project_id:project_id, languageCode:languageCode, "setting the spell check language"
		languageIsSafe = false
		settings.languages.forEach (safeLang)->
			if safeLang.code == languageCode
				languageIsSafe = true

		if languageCode == ""
			languageIsSafe = true

		if languageIsSafe 
			conditions = {_id:project_id}
			update = {spellCheckLanguage:languageCode}
			Project.update conditions, update, {}, (err)->
				callback()
		else
			logger.err project_id:project_id, languageCode:languageCode, "tryed to set unsafe language"
			callback()

	setBrandVariationId: (project_id, brandVariationId, callback = ()->)->
		logger.log project_id:project_id, brandVariationId:brandVariationId, "setting the brand variation id"
		if !brandVariationId? or brandVariationId == ""
			return callback()
		conditions = {_id:project_id}
		update = {brandVariationId}
		Project.update conditions, update, {}, (err)->
			if err?
				logger.err err:err, "error setting brandVariationId"
			callback()
