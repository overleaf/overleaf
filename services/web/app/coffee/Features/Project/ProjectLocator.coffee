Project = require('../../models/Project').Project
ProjectGetter = require("./ProjectGetter")
Errors = require "../../errors"
_ = require('underscore')
logger = require('logger-sharelatex')
async = require('async')
ProjectGetter = require "./ProjectGetter"

module.exports = ProjectLocator =
	findElement: (options, _callback = (err, element, path, parentFolder)->)->
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		{project, project_id, element_id, type} = options
		elementType = sanitizeTypeOfElement type

		count = 0
		endOfBranch = ->
			if --count == 0
				logger.warn "element #{element_id} could not be found for project #{project_id || project._id}"
				return callback(new Errors.NotFoundError("entity not found"))

		search = (searchFolder, path)->
			count++
			element = _.find searchFolder[elementType], (el)-> el?._id+'' == element_id+'' #need to ToString both id's for robustness
			if !element? && searchFolder.folders? && searchFolder.folders.length != 0
				_.each searchFolder.folders, (folder, index)->
					newPath = {}
					newPath[key] = value for own key,value of path #make a value copy of the string
					newPath.fileSystem += "/#{folder.name}"
					newPath.mongo += ".folders.#{index}"
					search folder, newPath
				endOfBranch()
				return
			else if element?
				elementPlaceInArray = getIndexOf(searchFolder[elementType], element_id)
				path.fileSystem += "/#{element.name}"
				path.mongo +=".#{elementType}.#{elementPlaceInArray}"
				callback(null, element, path, searchFolder)
			else if !element?
				return endOfBranch()

		path = {fileSystem:'',mongo:'rootFolder.0'}

		startSearch = (project)->
			if element_id+'' == project.rootFolder[0]._id+''
				callback(null, project.rootFolder[0], path, null)
			else
				search project.rootFolder[0], path

		if project?
			startSearch(project)
		else
			ProjectGetter.getProject project_id, {rootFolder:true, rootDoc_id:true}, (err, project)->
				return callback(err) if err?
				if !project?
					return callback(new Errors.NotFoundError("project not found"))
				startSearch project

	findRootDoc : (opts, callback)->
		getRootDoc = (project)=>
			if project.rootDoc_id?
				@findElement {project:project, element_id:project.rootDoc_id, type:"docs"}, callback
			else
				callback null, null
		{project, project_id} = opts
		if project?
			getRootDoc project
		else
			ProjectGetter.getProject project_id, {rootFolder:true, rootDoc_id:true}, (err, project)->
				if err?
					logger.err err:err, "error getting project"
					return callback(err)
				else
					getRootDoc project

	findElementByPath: (project_or_id, needlePath, callback = (err, foundEntity)->)->

		getParentFolder = (haystackFolder, foldersList, level, cb)->
			if foldersList.length == 0
				return cb null, haystackFolder
			needleFolderName = foldersList[level]
			found = false
			for folder in haystackFolder.folders
				if folder.name.toLowerCase() == needleFolderName.toLowerCase()
					found = true
					if level == foldersList.length-1
						return cb null, folder
					else
						return getParentFolder(folder, foldersList, level+1, cb)
			if !found
				cb("not found project_or_id: #{project_or_id} search path: #{needlePath}, folder #{foldersList[level]} could not be found")

		getEntity = (folder, entityName, cb)->
			if !entityName?
				return cb null, folder
			enteties = _.union folder.fileRefs, folder.docs, folder.folders
			result = _.find enteties, (entity)->
				entity?.name.toLowerCase() == entityName.toLowerCase()
			if result?
				cb null, result
			else
				cb("not found project_or_id: #{project_or_id} search path: #{needlePath}, entity #{entityName} could not be found")


		Project.getProject project_or_id, "", (err, project)->
			if err?
				logger.err err:err, project_or_id:project_or_id, "error getting project for finding element"
				return callback(err)
			if !project?
				return callback("project could not be found for finding a element #{project_or_id}")
			if needlePath == '' || needlePath == '/'
				return callback(null, project.rootFolder[0])

			if needlePath.indexOf('/') == 0
				needlePath = needlePath.substring(1)
			foldersList = needlePath.split('/')
			needleName = foldersList.pop()
			rootFolder = project.rootFolder[0]

			logger.log project_id:project._id, path:needlePath, foldersList:foldersList, "looking for element by path"
			jobs = new Array()
			jobs.push(
				(cb)->
					getParentFolder rootFolder, foldersList, 0, cb
			)
			jobs.push(
				(folder, cb)->
					getEntity folder, needleName, cb
			)
			async.waterfall jobs, callback

	findUsersProjectByName: (user_id, projectName, callback)->
		ProjectGetter.findAllUsersProjects user_id, 'name archived', (err, projects, collabertions=[])->
			return callback(error) if error?
			projects = projects.concat(collabertions)
			projectName = projectName.toLowerCase()
			project = _.find projects, (project)->
				project.name.toLowerCase() == projectName and project.archived != true
			logger.log user_id:user_id, projectName:projectName, totalProjects:projects.length, project:project, "looking for project by name"
			callback(null, project)


sanitizeTypeOfElement = (elementType)->
	lastChar = elementType.slice -1
	if lastChar != "s"
		elementType +="s"
	if elementType == "files"
		elementType = "fileRefs"
	return elementType


getIndexOf = (searchEntity, id)->
	length = searchEntity.length
	count = 0
	while(count < length)
		if searchEntity[count]?._id+"" == id+""
			return count
		count++
