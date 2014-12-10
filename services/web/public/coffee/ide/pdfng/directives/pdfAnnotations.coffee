define [
	"base"
], (App) ->
	# App = angular.module 'pdfAnnotations', []
	App.factory 'pdfAnnotations', [ () ->
		class pdfAnnotations

			@EXTERNAL_LINK_TARGET = "_blank";

			constructor: (options) ->
				@annotationsLayerDiv = options.annotations;
				@viewport = options.viewport
				@navigateFn = options.navigateFn

			setAnnotations: (annotations) ->
				for annotation in annotations
					switch annotation.subtype
						when 'Link' then @addLink(annotation);
						when 'Text' then continue

			addLink: (link) ->
				element = @buildLinkElementFromRect(link.rect);
				@setLinkTarget(element, link);
				@annotationsLayerDiv.appendChild(element);

			buildLinkElementFromRect: (rect) ->
				rect = @viewport.convertToViewportRectangle(rect);
				rect = PDFJS.Util.normalizeRect(rect);
				element = document.createElement("a");
				element.style.left = Math.floor(rect[0]) + 'px';
				element.style.top = Math.floor(rect[1]) + 'px';
				element.style.width = Math.ceil(rect[2] - rect[0]) + 'px';
				element.style.height = Math.ceil(rect[3] - rect[1]) + 'px';
				element

			setLinkTarget: (element, link) ->
				if link.url
					element.href = link.url;
					element.target = @EXTERNAL_LINK_TARGET;
				else if (link.dest)
					element.href = "#" + link.dest;
					element.onclick = (e) =>
						@navigateFn link
						return false
	]
