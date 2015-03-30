Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
metrics = require('./Metrics')
zlib = require('zlib')

ZIP_WRITES_ENABLED = Settings.redis.zip?.writesEnabled
ZIP_MINSIZE = Settings.redis.zip?.minSize || 64*1024

module.exports = ZipManager =
	uncompressIfNeeded: (doc_id, result, callback) ->
		# result is an array of [text, version].  Each entry is a node
		# Buffer object which we need to convert to strings on output

		# first make sure the version (result[1]) is returned as a string
		if result?[1]?.toString?
			result[1] = result[1].toString()

		# now uncompress the text (result[0]) if needed
		buf = result?[0]

		# Check if we have a GZIP file
		if buf? and buf[0] == 0x1F and buf[1] == 0x8B
			zlib.gunzip buf, (err, newbuf) ->
				if err?
					logger.err doc_id:doc_id, err:err, "error uncompressing doc"
					callback(err, null)
				else
					logger.log doc_id:doc_id, fromBytes: buf.length, toChars: newbuf.length, factor: buf.length/newbuf.length, "uncompressed successfully"
					result[0] = newbuf.toString()
					callback(null, result)
		else
			# if we don't have a GZIP file it's just a buffer of text, convert it back to a string
			if buf?.toString?
				result[0] = buf.toString()
			callback(null, result)

	compressIfNeeded: (doc_id, text, callback) ->
		if ZIP_WRITES_ENABLED && ZIP_MINSIZE > 0 and text.length > ZIP_MINSIZE
			zlib.gzip text, (err, buf) ->
				if err?
					logger.err doc_id:doc_id, err:err, "error compressing doc"
					callback(err, null)
				else
					logger.log doc_id:doc_id, fromChars: text.length, toBytes: buf.length, factor: buf.length/text.length , "compressed successfully"
					callback(null, buf)
		else
			callback(null, text)
