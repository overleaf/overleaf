(function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else context[name] = definition()
})('HighlightsLayerBuilder', this, function (name, context) {

function HighlightsLayerBuilder(pageView, highlightsLayerDiv) {
    this.highlightsLayerDiv = highlightsLayerDiv;
    this.pageView = pageView;
    this.highlightElements = [];
};

HighlightsLayerBuilder.EXTERNAL_LINK_TARGET = "_blank";

HighlightsLayerBuilder.prototype = {
    addHighlight: function(left, top, width, height) {
        rect = this.pageView.viewport.convertToViewportRectangle([left, top, left + width, top + height]);
        rect = PDFJS.Util.normalizeRect(rect);
        var element = document.createElement("div");
        element.style.left = Math.floor(rect[0]) + 'px';
        element.style.top = Math.floor(rect[1]) + 'px';
        element.style.width = Math.ceil(rect[2] - rect[0]) + 'px';
        element.style.height = Math.ceil(rect[3] - rect[1]) + 'px';
        this.highlightElements.push(element);
        this.highlightsLayerDiv.appendChild(element);
        return element;
    },

    clearHighlights: function() {
        for (var i = 0; i < this.highlightElements.length; i++) {
            this.highlightElements[i].remove();
        }
        this.highlightElements = [];
    }
}

return HighlightsLayerBuilder;

});
