Path = require "path"

module.exports =
	internal:
		filestore:
			port: 3009
			host: "localhost"

	filestore:
		# Which backend persistor to use.
		# Choices are
		# s3 - Amazon S3
		# fs - local filesystem
		backend: "fs"
		stores:
		  	# where to store user and template binary files
			#
			# For Amazon S3 this is the bucket name to store binary files in.
			#
			# For local filesystem this is the directory to store the files in.
			# Must contain full path, e.g. "/var/lib/sharelatex/data".
			# This path must exist, not be tmpfs and be writable to by the user sharelatex is run as.
			user_files: Path.resolve(__dirname + "/../user_files")
		# if you are using S3, then fill in your S3 details below
		# s3:
		# 	key: ""
		# 	secret: ""

	path:
		uploadFolder: Path.resolve(__dirname + "/../uploads")

	# Filestore health check
	# ----------------------
	# Project and file details to check in persistor when calling /health_check
	# health_check:
	# 	project_id: ""
	# 	file_id: ""
