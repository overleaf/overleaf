MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
thirtySeconds = 30 * 1000

module.exports = DocArchiveManager =

	buildS3Options: (content, key)->
		return {
				aws:
					key: settings.filestore.s3.key
					secret: settings.filestore.s3.secret
					bucket: settings.filestore.stores.user_files
				timeout: thirtySeconds
				json: content
				#headers:
				#	'content-md5': crypto.createHash("md5").update(JSON.stringify(content)).digest("hex")
				uri:"https://#{settings.filestore.stores.user_files}.s3.amazonaws.com/#{key}"
		}