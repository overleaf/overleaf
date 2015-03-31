define [
	"base"
], (App) ->
	# App = angular.module 'pdfTextLayer', []

	App.factory 'pdfTextLayer', [ () ->

	# TRANSLATED FROM pdf.js-1.0.712
	# pdf.js-1.0.712/web/ui_utils.js
	# pdf.js-1.0.712/web/text_layer_builder.js

	# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-

	# Copyright 2012 Mozilla Foundation
	# *
	# * Licensed under the Apache License, Version 2.0 (the "License");
	# * you may not use this file except in compliance with the License.
	# * You may obtain a copy of the License at
	# *
	# *     http://www.apache.org/licenses/LICENSE-2.0
	# *
	# * Unless required by applicable law or agreed to in writing, software
	# * distributed under the License is distributed on an "AS IS" BASIS,
	# * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	# * See the License for the specific language governing permissions and
	# * limitations under the License.
	#

	# globals CustomStyle, scrollIntoView, PDFJS
	# ms

	# optimised CSS custom property getter/setter

		CustomStyle = (CustomStyleClosure = ->

			# As noted on: http://www.zachstronaut.com/posts/2009/02/17/
			#              animate-css-transforms-firefox-webkit.html
			# in some versions of IE9 it is critical that ms appear in this list
			# before Moz
			CustomStyle = ->
			prefixes = [
				'ms'
				'Moz'
				'Webkit'
				'O'
			]
			_cache = {}
			CustomStyle.getProp = get = (propName, element) ->

				# check cache only when no element is given
				return _cache[propName]	if arguments.length is 1 and typeof _cache[propName] is 'string'
				element = element or document.documentElement
				style = element.style
				prefixed = undefined
				uPropName = undefined

				# test standard property first
				return (_cache[propName] = propName)	if typeof style[propName] is 'string'

				# capitalize
				uPropName = propName.charAt(0).toUpperCase() + propName.slice(1)

				# test vendor specific properties
				i = 0
				l = prefixes.length

				while i < l
					prefixed = prefixes[i] + uPropName
					return (_cache[propName] = prefixed)	if typeof style[prefixed] is 'string'
					i++

				#if all fails then set to undefined
				_cache[propName] = 'undefined'

			CustomStyle.setProp = set = (propName, element, str) ->
				prop = @getProp(propName)
				element.style[prop] = str	if prop isnt 'undefined'
				return

			CustomStyle
		)()

		#################################

		isAllWhitespace = (str) ->
			not NonWhitespaceRegexp.test(str)
		'use strict'
		FIND_SCROLL_OFFSET_TOP = -50
		FIND_SCROLL_OFFSET_LEFT = -400
		MAX_TEXT_DIVS_TO_RENDER = 100000
		RENDER_DELAY = 200
		NonWhitespaceRegexp = /\S/

		###*
		TextLayerBuilder provides text-selection functionality for the PDF.
		It does this by creating overlay divs over the PDF text. These divs
		contain text that matches the PDF text they are overlaying. This object
		also provides a way to highlight text that is being searched for.
		###

		class pdfTextLayer

			constructor: (options) ->
				@textLayerDiv = options.textLayerDiv
				@layoutDone = false
				@divContentDone = false
				@pageIdx = options.pageIndex
				@matches = []
				@lastScrollSource = options.lastScrollSource or null
				@viewport = options.viewport
				@isViewerInPresentationMode = options.isViewerInPresentationMode
				@textDivs = []
				@findController = options.findController or null

			renderLayer: () ->
				textLayerFrag = document.createDocumentFragment()
				textDivs = @textDivs
				textDivsLength = textDivs.length
				canvas = document.createElement('canvas')
				ctx = canvas.getContext('2d')

				# No point in rendering many divs as it would make the browser
				# unusable even after the divs are rendered.
				return	if textDivsLength > MAX_TEXT_DIVS_TO_RENDER
				lastFontSize = undefined
				lastFontFamily = undefined
				i = 0
				while i < textDivsLength
					textDiv = textDivs[i]
					if textDiv.dataset.isWhitespace
						i++
						continue
					fontSize = textDiv.style.fontSize
					fontFamily = textDiv.style.fontFamily

					# Only build font string and set to context if different from last.
					if fontSize isnt lastFontSize or fontFamily isnt lastFontFamily
						ctx.font = fontSize + ' ' + fontFamily
						lastFontSize = fontSize
						lastFontFamily = fontFamily
					width = ctx.measureText(textDiv.textContent).width
					if width > 0
						textLayerFrag.appendChild textDiv

						if textDiv.dataset.canvasWidth?
							# Dataset values come of type string.
							textScale = textDiv.dataset.canvasWidth / width;
							transform = 'scaleX(' + textScale + ')'
						else
							transform = ''
						rotation = textDiv.dataset.angle
						if rotation
							transform = 'rotate(' + rotation + 'deg) ' + transform
						if transform
							CustomStyle.setProp 'transform', textDiv, transform
					i++
				@textLayerDiv.appendChild textLayerFrag
				return

			appendText: (geom, styles) ->
				style = styles[geom.fontName]
				textDiv = document.createElement('div')
				@textDivs.push textDiv
				if isAllWhitespace(geom.str)
					textDiv.dataset.isWhitespace = true
					return
				tx = PDFJS.Util.transform(@viewport.transform, geom.transform)
				angle = Math.atan2(tx[1], tx[0])
				angle += Math.PI / 2	if style.vertical
				fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]))
				fontAscent = fontHeight
				if style.ascent
					fontAscent = style.ascent * fontAscent
				else fontAscent = (1 + style.descent) * fontAscent	if style.descent
				left = undefined
				top = undefined
				if angle is 0
					left = tx[4]
					top = tx[5] - fontAscent
				else
					left = tx[4] + (fontAscent * Math.sin(angle))
					top = tx[5] - (fontAscent * Math.cos(angle))
				textDiv.style.left = left + 'px'
				textDiv.style.top = top + 'px'
				textDiv.style.fontSize = fontHeight + 'px'
				textDiv.style.fontFamily = style.fontFamily
				textDiv.textContent = geom.str

				textDiv.ondblclick = (e) ->
					if (window.getSelection)
						window.getSelection().removeAllRanges();
					else if (document.selection)
						document.selection.empty();

				# |fontName| is only used by the Font Inspector. This test will succeed
				# when e.g. the Font Inspector is off but the Stepper is on, but it's
				# not worth the effort to do a more accurate test.
				textDiv.dataset.fontName = geom.fontName	if PDFJS.pdfBug

				# Storing into dataset will convert number into string.
				textDiv.dataset.angle = angle * (180 / Math.PI)	if angle isnt 0
				# We don't bother scaling single-char text divs, because it has very
				# little effect on text highlighting. This makes scrolling on docs with
				# lots of such divs a lot faster.
				if textDiv.textContent.length > 1
					if style.vertical
						textDiv.dataset.canvasWidth = geom.height * @viewport.scale
					else
						textDiv.dataset.canvasWidth = geom.width * @viewport.scale
					return

			setTextContent: (textContent) ->
				@textContent = textContent
				textItems = textContent.items
				i = 0
				len = textItems.length

				while i < len
					@appendText textItems[i], textContent.styles
					i++
				@divContentDone = true
				@renderLayer()
				return

	]
