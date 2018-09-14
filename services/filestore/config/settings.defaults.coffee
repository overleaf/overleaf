Path = require "path"

settings =
	internal:
		filestore:
			port: 3009
			host: process.env['LISTEN_ADDRESS'] or "localhost"

	filestore:
		# Which backend persistor to use.
		# Choices are
		# s3 - Amazon S3
		# fs - local filesystem
		if process.env['AWS_KEY']? or process.env['S3_BUCKET_CREDENTIALS']?
			backend: "s3"
			s3:
				key: process.env['AWS_KEY']
				secret: process.env['AWS_SECRET']
			stores:
				user_files: process.env['AWS_S3_USER_FILES_BUCKET_NAME']
				template_files: process.env['AWS_S3_TEMPLATE_FILES_BUCKET_NAME']
				public_files: process.env['AWS_S3_PUBLIC_FILES_BUCKET_NAME']
			# if you are using S3, then fill in your S3 details below,
			# or use env var with the same structure.
			# s3:
			# 	key: ""     # default
			# 	secret: ""  # default
			#
			# s3BucketCreds:
			#   bucketname1: # secrets for bucketname1
			#     auth_key: ""
			#     auth_secret: ""
			#  bucketname2: # secrets for bucketname2...
			s3BucketCreds: JSON.parse process.env['S3_BUCKET_CREDENTIALS'] if process.env['S3_BUCKET_CREDENTIALS']?
		else
			backend: "fs"
			stores:
				#
				# For local filesystem this is the directory to store the files in.
				# Must contain full path, e.g. "/var/lib/sharelatex/data".
				# This path must exist, not be tmpfs and be writable to by the user sharelatex is run as.
				user_files: Path.resolve(__dirname + "/../user_files")
				public_files: Path.resolve(__dirname + "/../public_files")
				template_files: Path.resolve(__dirname + "/../template_files")

	path:
		uploadFolder: Path.resolve(__dirname + "/../uploads")

	commands:
		# Any commands to wrap the convert utility in, for example ["nice"], or ["firejail", "--profile=/etc/firejail/convert.profile"]
		convertCommandPrefix: []


# Filestore health check
# ----------------------
# Project and file details to check in persistor when calling /health_check
if process.env['HEALTH_CHECK_PROJECT_ID']? and process.env['HEALTH_CHECK_FILE_ID']?
	settings.health_check =
		project_id: process.env['HEALTH_CHECK_PROJECT_ID']
		file_id: process.env['HEALTH_CHECK_FILE_ID']

module.exports = settings
