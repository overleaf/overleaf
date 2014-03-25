define [
	"libs/md5"
], () ->
	class AnalyticsManager
		constructor: (@ide) ->
			@ide.editor.on "update:doc", () =>
				@updateCount ||= 0
				@updateCount++
				if @updateCount == 100
					ga('send', 'event', 'editor-interaction', 'multi-doc-update')

			@ide.pdfManager.on "compile:pdf", () =>
				@compileCount ||= 0
				@compileCount++
				if @compileCount == 1
					ga('send', 'event', 'editor-interaction', 'single-compile')
				if @compileCount == 3
					ga('send', 'event', 'editor-interaction', 'multi-compile')

		getABTestBucket: (test_name, buckets = []) ->
			hash = CryptoJS.MD5("#{@ide.user.get("id")}:#{test_name}")
			bucketIndex = parseInt(hash.toString().slice(0,2), 16) % buckets.length
			return buckets[bucketIndex]

		startABTest: (test_name, buckets = []) ->
			value = @getABTestBucket(test_name, buckets)
			ga('send', 'event', 'ab_tests', test_name, "viewed-#{value}")
			return value

		endABTest: (test_name, buckets = []) ->
			value = @getABTestBucket(test_name, buckets)
			ga('send', 'event', 'ab_tests', test_name, "converted-#{value}")
			return value