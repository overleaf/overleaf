module.exports =
	internal:
		filestore:
			port: 3009
			host: "localhost"

	filestore:
		# which backend persistor to use.
		# choices are
		# s3 - Amazon S3
		# fs - local filesystem
		backend: "s3"
		stores:
		  # where to store user and template binary files
			#
			# For Amazon S3 this is the bucket name to store binary files in
			# Must contain full url like: <bucketname>.s3.amazonaws.com
			#
			# For local filesystem this is the directory to store the files in.
			# Must contain full path, e.g. "/var/lib/sharelatex/data"
			# This path must exist, not be tmpfs and be writable to by the user sharelatex is run as.
			user_files: ""
		s3:
			# if you are using S3, then fill in your S3 details below
			key: ""
			secret: ""

	# ShareLaTeX stores binary files like images in S3.
	# Fill in your Amazon S3 credentials below.
	s3:
		key: ''
		secret: ''
		buckets:
			user_files: ""
			template_files: ""

	# Filestore health check
	# ----------------------
	# Project and file details to check in persistor when calling /health_check
	# health_check:
	# 	project_id: ""
	# 	file_id: ""
