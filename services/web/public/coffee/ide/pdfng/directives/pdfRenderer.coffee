define [
	"base"
	"pdfjs-dist/build/pdf"
], (App, PDFJS) ->
	# App = angular.module 'PDFRenderer', ['pdfAnnotations', 'pdfTextLayer']

	App.factory 'PDFRenderer', ['$q', '$timeout', 'pdfAnnotations', 'pdfTextLayer', 'pdfSpinner', ($q, $timeout, pdfAnnotations, pdfTextLayer, pdfSpinner) ->

		# Have a single worker used by all rendering, to avoid reloading
		RenderThread = { worker: null, count: 0}

		getRenderThread = () ->
			if RenderThread.count > 16 # recycle the worker periodically to avoid leaks
				RenderThread.readyToDestroy = true
				RenderThread = { worker: null, count: 0 }
			RenderThread.worker ||= new PDFJS.PDFWorker('pdfjsworker')
			RenderThread.count++
			return RenderThread

		resetWorker = (thread) ->
			thread.worker.destroy() if thread.readyToDestroy

		# The PDF page renderer

		class PDFRenderer
			JOB_QUEUE_INTERVAL: 25
			PAGE_LOAD_TIMEOUT: 60*1000
			INDICATOR_DELAY1: 100  # time to delay before showing the indicator
			INDICATOR_DELAY2: 250  # time until the indicator starts animating
			TEXTLAYER_TIMEOUT: 100

			constructor: (@url, @options) ->
				# set up external character mappings - needed for Japanese etc
				window.PDFJS.cMapUrl = './bcmaps/'
				window.PDFJS.cMapPacked = true

				if window.location?.search?.indexOf("disable-font-face=true") >= 0
					window.PDFJS.disableFontFace = true
				else
					window.PDFJS.disableFontFace = false
				if @options.disableAutoFetch
					window.PDFJS.disableAutoFetch = true # prevent loading whole file
				# PDFJS.disableStream
				# PDFJS.disableRange
				@scale = @options.scale || 1
				@thread = getRenderThread()
				@pdfjs = PDFJS.getDocument {url: @url, rangeChunkSize: 2*65536, worker: @thread.worker}
				@pdfjs.onProgress = @options.progressCallback
				@document = $q.when(@pdfjs)
				@navigateFn = @options.navigateFn
				@spinner = new pdfSpinner
				@resetState()
				@document.then (pdfDocument) =>
					pdfDocument.getDownloadInfo().then () =>
						@options.loadedCallback()
				@errorCallback = @options.errorCallback
				@pageSizeChangeCallback = @options.pageSizeChangeCallback
				@pdfjs.promise.catch (exception) =>
					# error getting document
					@errorCallback(exception)

			resetState: () ->
				@renderQueue = []
				clearTimeout @queueTimer if @queueTimer?
				# clear any existing timers, render tasks
				for timer in @spinTimer or []
					clearTimeout timer
				for page in @pageState or []
					page?.loadTask?.cancel()
					page?.renderTask?.cancel()
				# initialise/reset the state
				@pageState = []
				@spinTimer = []     # timers for starting the spinners (to avoid jitter)
				@spinTimerDone = [] # array of pages where the spinner has activated
				@jobs = 0

			getNumPages: () ->
				@document.then (pdfDocument) ->
					pdfDocument.numPages

			getPage: (pageNum) ->
				@document.then (pdfDocument) ->
					pdfDocument.getPage(pageNum)

			getPdfViewport: (pageNum, scale) ->
				scale ?= @scale
				@document.then (pdfDocument) =>
					pdfDocument.getPage(pageNum).then (page) ->
						viewport = page.getViewport scale
					, (error) =>
						@errorCallback?(error)

			getDestinations: () ->
				@document.then (pdfDocument) ->
					pdfDocument.getDestinations()

			getDestination: (dest) ->
				@document.then (pdfDocument) ->
					pdfDocument.getDestination(dest)
				, (error) =>
					@errorCallback?(error)

			getPageIndex: (ref) ->
				@document.then (pdfDocument) =>
					pdfDocument.getPageIndex(ref).then (idx) ->
						idx
					, (error) =>
						@errorCallback?(error)

			getScale: () ->
				@scale

			setScale: (@scale) ->
				@resetState()

			triggerRenderQueue: (interval = @JOB_QUEUE_INTERVAL) ->
				if @queueTimer?
					clearTimeout @queueTimer
				@queueTimer = setTimeout () =>
					@queueTimer = null
					@processRenderQueue()
				, interval

			removeCompletedJob: (pagenum) ->
				@jobs = @jobs - 1
				@triggerRenderQueue(0)

			renderPages: (pages) ->
				return if @shuttingDown
				@renderQueue = for page in pages
					{
						'element': page.elementChildren
						'pagenum': page.pageNum
					}
				@triggerRenderQueue()

			renderPage: (page) ->
				return if @shuttingDown
				current =		{
					'element': page.elementChildren
					'pagenum': page.pageNum
				}
				@renderQueue.push current
				@processRenderQueue()

			getPageDetails: (page) ->
				return [page.element.canvas, page.pagenum]

			# handle the loading indicators for each page

			startIndicators: () ->
				# make an array of the pages in the queue
				@queuedPages = []
				@queuedPages[page.pagenum] = true for page in @renderQueue
				# clear any unfinished spinner timers on pages that aren't in the queue any more
				for pagenum of @spinTimer when not @queuedPages[pagenum]
					clearTimeout @spinTimer[pagenum]
					delete @spinTimer[pagenum]
				# add indicators for any new pages in the current queue
				for page in @renderQueue when not @spinTimer[page.pagenum] and not @spinTimerDone[page.pagenum]
					@startIndicator page

			startIndicator: (page) ->
				[canvas, pagenum] = @getPageDetails page
				canvas.addClass('pdfng-loading')
				@spinTimer[pagenum] = setTimeout () =>
					for queuedPage in @renderQueue
						if pagenum == queuedPage.pagenum
							@spinner.add(canvas, {static:true})
							@spinTimerDone[pagenum] = true
							break
					delete @spinTimer[pagenum]
				, @INDICATOR_DELAY1

			updateIndicator: (page) ->
				[canvas, pagenum] = @getPageDetails page
				# did the spinner insert itself already?
				if @spinTimerDone[pagenum]
					@spinTimer[pagenum] = setTimeout () =>
						@spinner.start(canvas)
						delete @spinTimer[pagenum]
					, @INDICATOR_DELAY2
				else
					# stop the existing spin timer
					clearTimeout @spinTimer[pagenum]
					# start a new one which will also start spinning
					@spinTimer[pagenum] = setTimeout () =>
						@spinner.add(canvas, {static:true})
						@spinTimerDone[pagenum] = true
						@spinTimer[pagenum] = setTimeout () =>
							@spinner.start(canvas)
							delete @spinTimer[pagenum]
						, @INDICATOR_DELAY2
					, @INDICATOR_DELAY1

			clearIndicator: (page) ->
				[canvas, pagenum] = @getPageDetails page
				@spinner.stop(canvas)
				clearTimeout @spinTimer[pagenum]
				delete @spinTimer[pagenum]
				@spinTimerDone[pagenum] = true

			# handle the queue of pages to be rendered

			processRenderQueue: () ->
				return if @shuttingDown
				# mark all pages in the queue as loading
				@startIndicators()
				# bail out if there is already a render job running
				return if @jobs > 0
				# take the first page in the queue
				page = @renderQueue.shift()
				# check if it is in action already
				while page? and @pageState[page.pagenum]?
					page = @renderQueue.shift()
				return unless page?
				[element, pagenum] = [page.element, page.pagenum]
				@jobs = @jobs + 1

				# update the spinner to make it spinning (signifies loading has begun)
				@updateIndicator page

				timedOut = false
				timer = $timeout () => # page load timed out
					return if loadTask.cancelled # return from cancelled page load
					Raven?.captureMessage?('pdfng page load timed out after ' + @PAGE_LOAD_TIMEOUT + 'ms')
					timedOut = true
					@clearIndicator page
					# @jobs = @jobs - 1
					# @triggerRenderQueue(0)
					@errorCallback?('timeout')
				, @PAGE_LOAD_TIMEOUT

				loadTask = @getPage(pagenum)

				loadTask.cancel = () ->
					@cancelled = true

				@pageState[pagenum] = pageState = { loadTask: loadTask }

				loadTask.then (pageObject) =>
					# page load success
					$timeout.cancel(timer)
					return if loadTask.cancelled # return from cancelled page load
					pageState.renderTask = @doRender element, pagenum, pageObject
					pageState.renderTask.then () =>
						# render task success
						@clearIndicator page
						pageState.complete = true
						delete pageState.renderTask
						@removeCompletedJob pagenum
					, () =>
						# render task failed
						# could display an error icon
						pageState.complete = false
						delete pageState.renderTask
						@removeCompletedJob pagenum
				.catch (error) =>
					# page load error
					$timeout.cancel(timer)
					@clearIndicator page

			doRender: (element, pagenum, page) ->
				self = this
				scale = @scale

				if (not scale?)
					# scale is undefined, returning
					return

				canvas = $('<canvas class="pdf-canvas pdfng-rendering"></canvas>')
				# In Windows+IE we must have the canvas in the DOM during
				# rendering to see the fonts defined in the DOM. If we try to
				# render 'offscreen' then all the text will be sans-serif.
				# Previously we rendered offscreen and added in the canvas
				# when rendering was complete.
				element.canvas.replaceWith(canvas)

				viewport = page.getViewport (scale)

				devicePixelRatio = window.devicePixelRatio || 1

				ctx = canvas[0].getContext '2d'
				backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
					ctx.mozBackingStorePixelRatio ||
					ctx.msBackingStorePixelRatio ||
					ctx.oBackingStorePixelRatio ||
					ctx.backingStorePixelRatio || 1
				pixelRatio = devicePixelRatio / backingStoreRatio

				scaledWidth = (Math.floor(viewport.width) * pixelRatio) | 0
				scaledHeight = (Math.floor(viewport.height) * pixelRatio) | 0

				newWidth = Math.floor(viewport.width)
				newHeight = Math.floor(viewport.height)

				canvas[0].height = scaledHeight
				canvas[0].width = scaledWidth

				canvas.height(newHeight + 'px')
				canvas.width(newWidth + 'px')

				oldHeight = element.canvas.height()
				oldWidth = element.canvas.width()
				if newHeight != oldHeight  or  newWidth != oldWidth
					element.canvas.height(newHeight + 'px')
					element.canvas.width(newWidth + 'px')
					element.container.height(newHeight + 'px')
					element.container.width(newWidth + 'px')
					@pageSizeChangeCallback?(pagenum, newHeight - oldHeight)

				textLayer = new pdfTextLayer({
					textLayerDiv: element.text[0]
					viewport: viewport
					renderer: PDFJS.renderTextLayer
				})

				annotationsLayer = new pdfAnnotations({
					annotations: element.annotations[0]
					viewport: viewport
					navigateFn: @navigateFn
				})

				result = page.render {
					canvasContext: ctx
					viewport: viewport
					transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
				}

				textLayerTimeout = @TEXTLAYER_TIMEOUT

				result.then () ->
					# page render success
					canvas.removeClass('pdfng-rendering')
					page.getTextContent({normalizeWhitespace: true}).then (textContent) ->
						textLayer.setTextContent textContent
						textLayer.render(textLayerTimeout)
					, (error) ->
						self.errorCallback?(error)
					page.getAnnotations().then (annotations) ->
						annotationsLayer.setAnnotations annotations
					, (error) ->
						self.errorCallback?(error)
				.catch (error) ->
					# page render failed
					if error is 'cancelled'
						return # do nothing when cancelled
					else
						self.errorCallback?(error)

				return result

			destroy: () ->
				@shuttingDown = true
				@resetState()
				@pdfjs.then (document) =>
					document.cleanup()
					document.destroy()
					resetWorker(@thread)

		]
