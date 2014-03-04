module.exports = DiffManager =
	getDiff: (doc_id, fromDate, toDate, callback = (error, diff) ->) ->
		# Flush diff
		# Get doc content and version
		# Get updates from Mongo
		# Check version matches
		# Build diff
		# Return diff