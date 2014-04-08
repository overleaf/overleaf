(function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else context[name] = definition()
})('PDFListView', this, function (name, context) {

//#expand __BUNDLE__

function Logger() {
    this.logLevel = Logger.INFO;
    var self = this;
    if (typeof(console) == "object" && typeof(console.log) == "function") {
        this.debug = function() {
            if (self.logLevel <= Logger.DEBUG) {
                console.log.apply(console, arguments);
            }
        };
        this.info = function() {
            if (self.logLevel <= Logger.INFO) {
                console.log.apply(console, arguments);
            }
        };
        this.error = function() {
            if (self.logLevel <= Logger.ERROR) {
                console.log.apply(console, arguments);
            }
        };
    } else {
        this.debug = this.info = this.error = function nop() {};
    }
}

Logger.DEBUG = 0;
Logger.INFO  = 1;
Logger.ERROR = 2;

var logger = new Logger();

function _flat(arr) {
    var res = arr.reduce(function(a, b) {
        return a.concat(b);
    });
    return res;
}

function failDumper(err) {
    logger.error(err);
}

if (typeof(PDFJS) === "undefined") {
    logger.error("PDF.js is not yet loaded.");
}

// -----------------------------------------------------------------------------

/**
 * Wrapper around the raw PDF.JS document.
 */
function Document(url, password, onProgress) {
    this.pdfDocument = null;
    this.pages = null;

    var parameters = {password: password};
    if (typeof url === 'string') { // URL
      parameters.url = url;
    } else if (url && 'byteLength' in url) { // ArrayBuffer
      parameters.data = url;
    }

    this.initialized = new PDFJS.LegacyPromise();
    PDFJS.getDocument(parameters, null, null, onProgress).then(this.loadPages.bind(this), failDumper);
}

Document.prototype.loadPages = function(pdfDocument) {
    this.pdfDocument = pdfDocument;
    var pagesCount = this.pagesCount = pdfDocument.numPages;

    var pagePromises = [];
    for (var i = 1; i <= pagesCount; i++) {
        pagePromises.push(pdfDocument.getPage(i));
    }

    this.pageRefMap = pageRefMap = {};
    var pagesPromise = Promise.all(pagePromises);
    var doc = this
    pagesPromise.then(function(promisedPages) {
        doc.pages = promisedPages.map(function(pdfPage, i) {
            var pageRef = pdfPage.ref
            pageRefMap[pageRef.num + ' ' + pageRef.gen] = i;
            return new Page(pdfPage);
        });
    });

    var destinationsPromise = pdfDocument.getDestinations();
    destinationsPromise.then(function(destinations) {
        doc.destinations = destinations;
    });

    Promise.all([pagesPromise, destinationsPromise]).then(function() {
        doc.initialized.resolve();
    }, failDumper);
};

/**
 * Handles the rendering. Multiple ListViews can be bound to a RenderController.
 * In that case, the RenderController figures out what's page has the highest
 * priority to render
 */
function RenderController() {
    this.listViews = [];
    this.renderList = [];
}

RenderController.prototype = {
    addListView: function(listView) {
        // TODO: assert listView not already in list of this.listView
        this.listViews.push(listView);
    },

    updateRenderList: function() {
        this.renderList = _flat(this.listViews.map(function(listView) {
            return listView.getPagesToRender();
        }));

        // TODO: Some "highest-priority" sorting algorithm on the renderList.

        this.doRender();
    },

    pageToRender: function() {
        if (this.renderList.length === 0) return null;

        return this.renderList[0];
    },

    doRender: function() {
        var pageToRender = this.pageToRender();

        if (!pageToRender) return;

        pageToRender.render(this);
    },

    finishedRendering: function(pageView) {
        var idx = this.renderList.indexOf(pageView);

        // If the finished pageView is in the list of pages to render,
        // then remove it from the list and render start rendering the
        // next page.
        if (idx !== -1) {
            this.renderList.splice(idx, 1);
            this.doRender();
        }
    },

    onResize: function() {
        var renderAgain = false
        this.listViews.map(function(listView) {
            if (listView.calculateScale()) {
                listView.layout();
                renderAgain = true;
            }
        });
        if (renderAgain) {
            this.updateRenderList();
        }
    }
};

var LAYOUT_SINGLE = 'layout_single';
var SCALE_MODE_AUTO = 'scale_mode_auto';
var SCALE_MODE_VALUE = 'scale_mode_value';
var SCALE_MODE_FIT_WIDTH = 'scale_mode_fit_width';
var SCALE_MODE_FIT_HEIGHT = 'scale_mode_fit_height';

/**
 * Main view that holds the single pageContainer/pageViews of the pdfDoc.
 */
function ListView(dom, options) {
    this.dom = dom;
    this.options = options;

    this.pageLayout = LAYOUT_SINGLE;
    this.scaleMode = SCALE_MODE_VALUE;
    this.scale = 1.0;

    this.pageWidthOffset = 0;
    this.pageHeightOffset = 0;

    this.pageViews = [];
    this.containerViews = [];
}

ListView.prototype = {
    setDocument: function(pdfDoc) {
        this.clearPages();

        this.pdfDoc = pdfDoc;

        this.assignPagesToContainer();
        this.layout();
    },

    clearPages: function() {
        var self = this;
        this.containerViews.map(function(container) {
            self.dom.removeChild(container.dom);
        });
        this.pageViews = [];
        this.containerViews = [];
    },

    assignPagesToContainer: function() {
        // TODO: Handle multiple layout types here. For now, assume to have one page
        // per pageContainer.
        this.pdfDoc.pages.map(function(page) {
            var pageView = new PageView(page, this);

            // TODO: Switch over to a proper event handler
            var that = this;
            var index = that.pageViews.length;
            pageView.ondblclick = function(e) {
                e.page = index;
                if (that.ondblclick) {
                    that.ondblclick.call(that, e);
                }
            }
            this.pageViews.push(pageView);

            var container = new PageContainerView(this);
            container.setPageView(pageView, 0);
            this.containerViews.push(container);

            this.dom.appendChild(container.dom);
        }, this);
    },

    layout: function() {
        this.savePdfPosition();
        this.containerViews.forEach(function(containerView) {
            containerView.layout();
        });
        this.restorePdfPosition();
    },

    getScale: function() {
        return this.scale;
    },

    getScaleMode: function() {
        return this.scaleMode;
    },

    setScaleMode: function(scaleMode, scale) {
        this.scaleMode = scaleMode;
        if (scaleMode == SCALE_MODE_VALUE) {
            this.scale = scale;
        }
        this.calculateScale();
        this.layout();
    },

    setScale: function(scale) {
        this.setScaleMode(SCALE_MODE_VALUE, scale);
    },

    setToAutoScale: function() {
        this.setScaleMode(SCALE_MODE_AUTO);
    },

    setToFitWidth: function() {
        this.setScaleMode(SCALE_MODE_FIT_WIDTH);
    },

    setToFitHeight: function() {
        this.setScaleMode(SCALE_MODE_FIT_HEIGHT);
    },

    // Calculates the new scale. Returns `true` if the scale changed.
    calculateScale: function() {
        var newScale = this.scale;
        var oldScale = newScale;
        var scaleMode = this.scaleMode;
        if (scaleMode === SCALE_MODE_FIT_WIDTH || scaleMode === SCALE_MODE_AUTO) {
            var clientWidth = this.dom.clientWidth;
            if (clientWidth == 0) {
                logger.debug("LIST VIEW NOT VISIBLE")
                return false;
            }
            var maxNormalWidth = 0;
            this.containerViews.forEach(function(containerView) {
                maxNormalWidth = Math.max(maxNormalWidth, containerView.normalWidth);
            });
            var scale = (clientWidth - this.pageWidthOffset)/maxNormalWidth;
            if (scaleMode === SCALE_MODE_AUTO) {
                scale = Math.min(1.0, scale);
            }
            newScale = scale;
        } else if (scaleMode === SCALE_MODE_FIT_HEIGHT) {
            var clientHeight = this.dom.clientHeight;
            if (clientHeight == 0) {
                logger.debug("LIST VIEW NOT VISIBLE")
                return false;
            }
            var maxNormalHeight = 0;
            this.containerViews.forEach(function(containerView) {
                maxNormalHeight = Math.max(maxNormalHeight, containerView.normalHeight);
            });
            newScale = (clientHeight - this.pageHeightOffset)/maxNormalHeight;
        }
        this.scale = newScale;
        return newScale !== oldScale;
    },

    getPagesToRender: function() {
        // Cache these results to avoid dom access.
        this.scrollTop = this.dom.scrollTop;
        this.scrollBottom = this.scrollTop + this.dom.clientHeight;

        // TODO: For now, this only returns the visible pages and not
        // +1/-1 one to render in advance.
        return this.pageViews.filter(function(pageView) {
            var isVisible = pageView.isVisible();

            if (isVisible && !pageView.isRendered) {
                return true;
            }
        });
    },

    navigateTo: function(destRef) {
        var destination = this.pdfDoc.destinations[destRef]
        if (typeof destination !== "object") {
            return;
        }
        logger.debug("NAVIGATING TO", destination);

        var pageRef = destination[0];
        var pageNumber = this.pdfDoc.pageRefMap[pageRef.num + ' ' + pageRef.gen];
        if (typeof pageNumber !== "number") {
            return;
        }
        logger.debug("PAGE NUMBER", pageNumber);

        var pageView = this.pageViews[pageNumber];

        var destinationType = destination[1].name;
        switch(destinationType) {
            case "XYZ":
                var x = destination[2];
                var y = destination[3];
                break;
            default:
                // TODO
                return;
        }
        var position = pageView.getPdfPositionInViewer(x,y);
        this.dom.scrollTop = position.top;
        this.dom.scrollLeft = position.left;
    },

    savePdfPosition: function() {
        this.pdfPosition = this.getPdfPosition();
        logger.debug("SAVED PDF POSITION", this.pdfPosition);
    },

    restorePdfPosition: function() {
        logger.debug("RESTORING PDF POSITION", this.pdfPosition);
        this.setPdfPosition(this.pdfPosition);
    },

    getPdfPosition: function() {
        var pdfPosition = null;
        for (var i = 0; i < this.pageViews.length; i++) {
            var pageView = this.pageViews[i];
            var pdfOffset = pageView.getUppermostVisiblePdfOffset();
            if (pdfOffset !== null) {
                pdfPosition = {
                    page: i,
                    offset: {
                        top: pdfOffset,
                        left: 0 // TODO
                    }
                }
                break;
            }
        }
        return pdfPosition;
    },

    setPdfPosition: function(pdfPosition, fromTop) {
        if (typeof pdfPosition !== "undefined" && pdfPosition != null) {
            var offset = pdfPosition.offset;
            var page_index = pdfPosition.page;
            var pageView = this.pageViews[page_index];
            if (fromTop) {
                offset.top = pageView.normalHeight - offset.top;
            }
            var position = pageView.getPdfPositionInViewer(offset.left, offset.top);
            this.dom.scrollTop = position.top;
        }
    },

    setHighlights: function(highlights, fromTop) {
        for (i = 0; i < highlights.length; i++) {
            var pageIndex = highlights[i].page;
            var pageView = this.pageViews[pageIndex];
            pageView.addHighlight(highlights[i].highlight, fromTop);
        }
    },

    clearHighlights: function() {
        for (var i = 0; i < this.pageViews.length; i++) {
            var pageView = this.pageViews[i].clearHighlights();
        }
    }
};

/*
 * A PageContainerView holds multiple PageViews. E.g. in a two-page layout,
 * every pageContainerView holds two PageViews and is responsible to layout
 * them.
 */
function PageContainerView(listView) {
    this.listView = listView;

    var dom = this.dom = document.createElement('div');
    dom.className = 'plv-page-container page-container';
    this.pages = [];
}

PageContainerView.prototype = {
    setPageView: function(pageView, idx) {
        // TODO: handle case if there is already a page here
        this.pages[idx] = pageView;

        // TODO: handle page idx properly
        this.dom.appendChild(pageView.dom);
    },

    removePageView: function(idx) {
        // TODO: check if idx is set on page[]
        this.dom.removeChild(this.pages[idx].dom);
    },

    layout: function() {
        var scale = this.listView.scale;

        var normalWidth = 0;
        var normalHeight = 0;

        this.pages.forEach(function(pageView) {
            pageView.layout();
            normalWidth += pageView.normalWidth;
            normalHeight = Math.max(pageView.normalHeight, normalHeight);
        });

        this.normalWidth = normalWidth;
        this.normalHeight = normalHeight;

        this.dom.style.width = (normalWidth * scale) + 'px';
        this.dom.style.height = (normalHeight * scale) + 'px';
    }
};

var RenderingStates = {
  INITIAL: 0,
  RUNNING: 1,
  PAUSED: 2,
  FINISHED: 3
};

var idCounter = 0;


/**
 * The view for a single page.
 */
function PageView(page, listView) {
    this.page = page;
    this.listView = listView;
    this.id = idCounter++;
    this.number = this.page.number;

    this.rotation = 0;

    this.isRendered = false;
    this.renderState = RenderingStates.INITIAL;

    var dom = this.dom = document.createElement('div');
    dom.className = "plv-page-view page-view";
    var that = this;
    dom.ondblclick = function(e) {
        var layerX = e.layerX;
        var layerY = e.layerY;
        var element = e.target;
        while (element.offsetParent && element.offsetParent !== dom) {
            layerX = layerX + element.offsetLeft;
            layerY = layerY + element.offsetTop;
            element = element.offsetParent;
        }

        var pdfPoint = that.viewport.convertToPdfPoint(layerX, layerY);
        var event = {
            x: pdfPoint[0],
            y: that.normalHeight - pdfPoint[1]
        };

        if (that.ondblclick) {
            that.ondblclick.call(that.listView, event)
        }
    }
    this.createNewCanvas();
}

PageView.prototype = {
    layout: function() {
        var scale = this.listView.scale;

        var viewport = this.viewport =
            this.page.pdfPage.getViewport(scale, this.rotation);

        this.normalWidth = viewport.width / scale;
        this.normalHeight = viewport.height / scale;

        // Only change the width/height property of the canvas if it really
        // changed. Every assignment to the width/height property clears the
        // content of the canvas.

        var outputScale = this.getOutputScale();

        var scaledWidth = (Math.floor(viewport.width) * outputScale.sx) | 0;
        var scaledHeight = (Math.floor(viewport.height) * outputScale.sy) | 0;

        var newWidth = Math.floor(viewport.width);
        var newHeight = Math.floor(viewport.height);

        if (this.canvas.width !== newWidth) {
            this.canvas.width = scaledWidth;
            this.canvas.style.width = newWidth + 'px';
            this.resetRenderState();
        }
        if (this.canvas.height !== newHeight) {
            this.canvas.height = scaledHeight;
            this.canvas.style.height = newHeight + 'px';
            this.resetRenderState();
        }
        
        if(outputScale.scaled){
            var ctx = this.getCanvasContext()
            ctx.scale(outputScale.sx, outputScale.sy)
        }

        this.width = viewport.width;
        this.height = viewport.height;
    },

    isVisible: function() {
        var listView = this.listView;
        var dom = this.dom;
        var offsetTop = dom.offsetTop;
        var offsetBottom = offsetTop + this.height;

        return offsetBottom >= listView.scrollTop &&
                offsetTop <= listView.scrollBottom;
    },

    resetRenderState: function() {
        this.renderState = RenderingStates.INITIAL;
        this.isRendered = false;
        if (this.textLayerDiv) {
            this.dom.removeChild(this.textLayerDiv);
            delete this.textLayerDiv;
        }
        if (this.annotationsLayerDiv) {
            this.dom.removeChild(this.annotationsLayerDiv);
            delete this.annotationsLayerDiv;
        }
    },

    render: function(renderController) {
        return this.page.render(this, renderController);
    },

    getCanvasContext: function() {
        return this.canvas.getContext('2d');
    },

    /**
     * Returns scale factor for the canvas. It makes sense for the HiDPI displays.
     * @return {Object} The object with horizontal (sx) and vertical (sy)
                        scales. The scaled property is set to false if scaling is
                        not required, true otherwise.
     */

    getOutputScale: function(){
        var ctx = this.getCanvasContext()
        var devicePixelRatio = window.devicePixelRatio || 1;
        var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
                              ctx.mozBackingStorePixelRatio ||
                              ctx.msBackingStorePixelRatio ||
                              ctx.oBackingStorePixelRatio ||
                              ctx.backingStorePixelRatio || 1;
        var pixelRatio = devicePixelRatio / backingStoreRatio;
        return {
            sx: pixelRatio,
            sy: pixelRatio,
            scaled: pixelRatio != 1
        };
    },

    createNewCanvas: function() {
        if (this.canvas) {
            this.dom.removeChild(this.canvas);
        }
        var canvas = this.canvas = document.createElement('canvas');
        this.dom.appendChild(canvas);
        this.layout();
    },

    pdfPositionToPixels: function(x, y) {
        return this.viewport.convertToViewportPoint(x, y);
    },

    getCanvasPositionInViewer: function() {
        return {
            left: this.canvas.offsetLeft + this.dom.offsetLeft,
            top: this.canvas.offsetTop + this.dom.offsetTop
        }
    },

    getPdfPositionInViewer: function(x, y) {
        pageOffset = this.pdfPositionToPixels(x, y);
        canvasOffset = this.getCanvasPositionInViewer();
        return {
            left: canvasOffset.left + pageOffset[0],
            top: canvasOffset.top + pageOffset[1]
        }
    },

    getUppermostVisibleCanvasOffset: function() {
        var pagePosition = this.getCanvasPositionInViewer();
        var pageHeight = this.canvas.height;
        var viewportTop = this.listView.dom.scrollTop;
        var viewportHeight = this.listView.dom.clientHeight;
        // Check if the top of the page is showing, i.e:
        // _______________
        // |             |
        // |   ........  |
        // |   .      .  |
        // ----.------.---
        //     .      .
        //     ........
        var topVisible = (pagePosition.top > viewportTop && pagePosition.top < viewportTop + viewportHeight);
        // Check if at least some of the page is showing, i.e:
        //     ........                 ........
        // ____.______.___           ---.------.---
        // |   .      .  |     or    |  .      .  |
        // |   .      .  |           |  .      .  |
        // |   ........  |           |  .      .  |
        // ---------------           ---.------.---
        //                              ........
        var someContentVisible = (pagePosition.top < viewportTop && pagePosition.top + pageHeight > viewportTop);
        if (topVisible) {
            return 0;
        } else if (someContentVisible) {
            return viewportTop - pagePosition.top;
        } else {
            return null;
        }
    },

    getUppermostVisiblePdfOffset: function() {
        var canvasOffset = this.getUppermostVisibleCanvasOffset();
        if (canvasOffset === null) {
            return null;
        }
        var pdfOffset = this.viewport.convertToPdfPoint(0, canvasOffset);
        return pdfOffset[1];
    },

    clearHighlights: function() {
        if (this.highlightsLayer) {
            this.highlightsLayer.clearHighlights();
        }
    },

    addHighlight: function(highlight, fromTop) {
        if (this.highlightsLayer) {
            var top = highlight.top;
            var left = highlight.left;
            var width = highlight.width;
            var height = highlight.height;
            if (fromTop) {
                top = this.normalHeight - top;
            }
            this.highlightsLayer.addHighlight(left, top, width, height);
        }
    }
};

/**
 * An abstraction around the raw page object of PDF.JS, that also handles the
 * rendering logic of (maybe multiple) pageView(s) that are based on this page.
 */
function Page(pdfPage, number) {
    this.number = number;
    this.pdfPage = pdfPage;

    this.renderContextList = {};
}

Page.prototype = {
    render: function(pageView, renderController) {
        var renderContext;

        // FEATURE: If the page was rendered already once, then use the old
        // version as a placeholder until the new version is rendered at the
        // expected quality.

        // FEATURE: If the page can be rendered at low quality (thumbnail) and
        // there is already a higher resolution rendering, then use this one
        // instead of rerendering from scratch again.

        // PageView is not layouted.
        if (!pageView.viewport) return;

        // Nothing todo.
        if (pageView.isRendered) return;

        // Not most important page to render ATM.
        if (renderController.pageToRender() !== pageView) return;

        var self = this;
        var viewport;
        if (renderContext = this.renderContextList[pageView.id]) {
            viewport = renderContext.viewport;

            // TODO: handle rotation
            if (viewport.height !== pageView.viewport.height ||
                viewport.height !== pageView.viewport.height)
            {
                // The viewport changed -> need to rerender.
                renderContext.abandon = true;
                delete self.renderContextList[pageView.id];
                pageView.createNewCanvas();
                self.render(pageView, renderController);
            } else if (renderContext.state === RenderingStates.PAUSED) {
                // There is already a not finished renderState ->
                logger.debug('RESUME', pageView.id);
                renderContext.resume();
            }
        }

        if (!renderContext) {
            viewport = pageView.viewport;
            // No rendering data yet -> create a new renderContext and start
            // the rendering process.

            var textLayer;
            var textLayerBuilder = pageView.listView.options.textLayerBuilder;
            if (textLayerBuilder) {
                var textLayerDiv = pageView.textLayerDiv = document.createElement("div");
                textLayerDiv.className = 'plv-text-layer text-layer';
                pageView.dom.appendChild(textLayerDiv);
                textLayer = new textLayerBuilder(textLayerDiv);
                this.pdfPage.getTextContent().then(
                  function(textContent) {
                    textLayer.setTextContent(textContent);
                  }
                );
            }

            var annotationsLayerBuilder = pageView.listView.options.annotationsLayerBuilder;
            if (annotationsLayerBuilder) {
                var annotationsLayerDiv = pageView.annotationsLayerDiv = document.createElement("div");
                annotationsLayerDiv.className = 'plv-annotations-layer annotations-layer';
                pageView.dom.appendChild(annotationsLayerDiv);
                var annotationsLayer = new annotationsLayerBuilder(pageView, annotationsLayerDiv);
                this.pdfPage.getAnnotations().then(
                    function(annotations) {
                        annotationsLayer.setAnnotations(annotations)
                    }
                );
            }

            var highlightsLayerBuilder = pageView.listView.options.highlightsLayerBuilder;
            if (highlightsLayerBuilder) {
                var highlightsLayerDiv = pageView.highlightsLayerDiv = document.createElement("div");
                highlightsLayerDiv.className = 'plv-highlights-layer highlights-layer';
                pageView.dom.appendChild(highlightsLayerDiv);
                pageView.highlightsLayer = new highlightsLayerBuilder(pageView, highlightsLayerDiv);
            }

            renderContext = {
              canvasContext: pageView.getCanvasContext(),
              viewport: viewport,
              textLayer: textLayer,
              continueCallback: function pdfViewContinueCallback(cont) {
                if (renderContext.abandon) {
                  logger.debug("ABANDON", pageView.id);
                  return;
                }

                if (renderController.pageToRender() !== pageView) {
                  logger.debug('PAUSE', pageView.id);
                  renderContext.state = RenderingStates.PAUSED;
                  renderContext.resume = function resumeCallback() {
                    renderContext.state = RenderingStates.RUNNING;
                    cont();
                  };
                  return;
                }
                logger.debug('CONT', pageView.id);
                cont();
              }
            };
            this.renderContextList[pageView.id] = renderContext;

            logger.debug("BEGIN", pageView.id);
            renderContext.renderPromise = this.pdfPage.render(renderContext).promise;
            renderContext.renderPromise.then(
              function pdfPageRenderCallback() {
                logger.debug('DONE', pageView.id);
                pageView.isRendered = true;
                renderController.finishedRendering(pageView);
              },
              failDumper
            );
        }

        return renderContext.renderPromise;
    }
};

function PDFListView(mainDiv, options) {
    if (typeof(options) != "object") {
        options = {};
    }
    if (typeof(options.logLevel) != "number") {
        options.logLevel = Logger.INFO;
    }
    logger.logLevel = options.logLevel;

    var self = this;

    this.listView = new ListView(mainDiv, options);
    this.listView.ondblclick = function(e) {
        if (options.ondblclick) {
            options.ondblclick.call(self, e);
        }
    }

    this.renderController = new RenderController();
    this.renderController.addListView(this.listView);
    this.renderController.updateRenderList();


    mainDiv.addEventListener('scroll', function() {
        // This will update the list AND start rendering if needed.
        self.renderController.updateRenderList();
    });

    window.addEventListener('resize', function() {
        // Check if the scale changed due to the resizing.
        if (self.listView.calculateScale()) {
            // Update the layout and start rendering. Changing the layout
            // of the PageView makes it rendering stop.
            self.listView.layout();
            self.renderController.updateRenderList();
        }
    });
}

PDFListView.prototype = {
    loadPdf: function(url, onProgress) {
        this.doc = new Document(url, null, onProgress);
        var self = this;
        var promise = this.doc.initialized;
        promise.then(function() {
            logger.debug('LOADED');
            self.listView.setDocument(self.doc);
            self.renderController.updateRenderList();
        }, failDumper);
        return promise;
    },

    getScale: function() {
        return this.listView.getScale();
    },

    getScaleMode: function() {
        return this.listView.getScaleMode()
    },

    setScaleMode: function(scaleMode, scale) {
        this.listView.setScaleMode(scaleMode, scale);
        this.renderController.updateRenderList();
    },

    setScale: function(scale) {
        this.listView.setScale(scale);
        this.renderController.updateRenderList();
    },

    setToAutoScale: function() {
        this.listView.setToAutoScale();
        this.renderController.updateRenderList();
    },

    setToFitWidth: function() {
        this.listView.setToFitWidth();
        this.renderController.updateRenderList();
    },

    setToFitHeight: function() {
        this.listView.setToFitHeight();
        this.renderController.updateRenderList();
    },

    onResize: function() {
        this.renderController.onResize();
    },

    getPdfPosition: function() {
        return this.listView.getPdfPosition();
    },

    setPdfPosition: function(pdfPosition, fromTop) {
        this.listView.setPdfPosition(pdfPosition, fromTop);
    },

    setHighlights: function(highlights, fromTop) {
        this.listView.setHighlights(highlights, fromTop);
    },

    clearHighlights: function() {
        this.listView.clearHighlights();
    }
};
PDFListView.Logger = Logger;

return PDFListView;

});

