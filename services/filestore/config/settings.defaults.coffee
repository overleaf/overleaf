Path = require "path"

# environment variables renamed for consistency
# use AWS_ACCESS_KEY_ID-style going forward
if process.env['AWS_KEY'] && !process.env['AWS_ACCESS_KEY_ID']
	process.env['AWS_ACCESS_KEY_ID'] = process.env['AWS_KEY']
if process.env['AWS_SECRET'] && !process.env['AWS_SECRET_ACCESS_KEY']
	process.env['AWS_SECRET_ACCESS_KEY'] = process.env['AWS_SECRET']

# pre-backend setting, fall back to old behaviour
unless process.env['BACKEND']?
	if process.env['AWS_ACCESS_KEY_ID']? or process.env['S3_BUCKET_CREDENTIALS']?
		process.env['BACKEND'] = "s3"
		process.env['USER_FILES_BUCKET_NAME'] = process.env['AWS_S3_USER_FILES_BUCKET_NAME']
		process.env['TEMPLATE_FILES_BUCKET_NAME'] = process.env['AWS_S3_TEMPLATE_FILES_BUCKET_NAME']
		process.env['PUBLIC_FILES_BUCKET_NAME'] = process.env['AWS_S3_PUBLIC_FILES_BUCKET_NAME']
	else
		process.env['BACKEND'] = "fs"
		process.env['USER_FILES_BUCKET_NAME'] = Path.resolve(__dirname + "/../user_files")
		process.env['TEMPLATE_FILES_BUCKET_NAME'] = Path.resolve(__dirname + "/../template_files")
		process.env['PUBLIC_FILES_BUCKET_NAME'] = Path.resolve(__dirname + "/../public_files")

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
		backend: process.env['BACKEND']

		s3:
			if process.env['AWS_ACCESS_KEY_ID']? or process.env['S3_BUCKET_CREDENTIALS']?
				key: process.env['AWS_ACCESS_KEY_ID']
				secret: process.env['AWS_SECRET_ACCESS_KEY']
				endpoint: process.env['AWS_S3_ENDPOINT']
				partSize: process.env['S3_PARTSIZE'] or (100 * 1024 * 1024)

		stores:
			user_files: process.env['USER_FILES_BUCKET_NAME']
			template_files: process.env['TEMPLATE_FILES_BUCKET_NAME']
			public_files: process.env['PUBLIC_FILES_BUCKET_NAME']

		s3BucketCreds: JSON.parse process.env['S3_BUCKET_CREDENTIALS'] if process.env['S3_BUCKET_CREDENTIALS']?

		fallback:
			if process.env['FALLBACK_BACKEND']?
				backend: process.env['FALLBACK_BACKEND']
				# mapping of bucket names on the fallback, to bucket names on the primary.
				# e.g. { myS3UserFilesBucketName: 'myGoogleUserFilesBucketName' }
				buckets: JSON.parse(process.env['FALLBACK_BUCKET_MAPPING'] || '{}')
				copyOnMiss: process.env['COPY_ON_MISS'] == 'true'

	path:
		uploadFolder: Path.resolve(__dirname + "/../uploads")

	commands:
		# Any commands to wrap the convert utility in, for example ["nice"], or ["firejail", "--profile=/etc/firejail/convert.profile"]
		convertCommandPrefix: []

	enableConversions: if process.env['ENABLE_CONVERSIONS'] == 'true' then true else false

	sentry:
		dsn: process.env.SENTRY_DSN
		
# Filestore health check
# ----------------------
# Project and file details to check in persistor when calling /health_check
if process.env['HEALTH_CHECK_PROJECT_ID']? and process.env['HEALTH_CHECK_FILE_ID']?
	settings.health_check =
		project_id: process.env['HEALTH_CHECK_PROJECT_ID']
		file_id: process.env['HEALTH_CHECK_FILE_ID']

module.exports = settings
