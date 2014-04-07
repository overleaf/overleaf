Project = require('../models/Project').Project
Folder = require('../models/Folder').Folder
Doc = require('../models/Doc').Doc
File = require('../models/File').File
User = require('../models/User').User
logger = require('logger-sharelatex')
_ = require('underscore')
Settings = require('settings-sharelatex')
EmailHandler = require("../Features/Email/EmailHandler")
tpdsUpdateSender = require '../Features/ThirdPartyDataStore/TpdsUpdateSender'
projectCreationHandler = require '../Features/Project/ProjectCreationHandler'
projectEntityHandler = require '../Features/Project/ProjectEntityHandler'
ProjectEditorHandler = require '../Features/Project/ProjectEditorHandler'
FileStoreHandler = require "../Features/FileStore/FileStoreHandler"
projectLocator = require '../Features/Project/ProjectLocator'
mimelib = require("mimelib")
async = require('async')
tagsHandler = require('../Features/Tags/TagsHandler')

module.exports = class ProjectHandler


