(function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else context[name] = definition()
})('AnnotationsLayerBuilder', this, function (name, context) {

function AnnotationsLayerBuilder(pageView, annotationsLayerDiv) {
    this.annotationsLayerDiv = annotationsLayerDiv;
    this.pageView = pageView;
};

AnnotationsLayerBuilder.EXTERNAL_LINK_TARGET = "_blank";

AnnotationsLayerBuilder.prototype = {
    setAnnotations: function(annotations) {
        for (var i = 0; i < annotations.length; i++) {
            var annotation = annotations[i];
            switch (annotation.subtype) {
                case 'Link':
                    this.addLink(annotation);
                    break;
                case 'Text':
                    // TODO
                    break;
            }
        }
    },

    addLink: function(link) {
        var element = this.buildLinkElementFromRect(link.rect);
        this.setLinkTarget(element, link);
        this.annotationsLayerDiv.appendChild(element);
    },

    buildLinkElementFromRect: function(rect) {
        rect = this.pageView.viewport.convertToViewportRectangle(rect);
        rect = PDFJS.Util.normalizeRect(rect);
        var element = document.createElement("a");
        element.style.left = Math.floor(rect[0]) + 'px';
        element.style.top = Math.floor(rect[1]) + 'px';
        element.style.width = Math.ceil(rect[2] - rect[0]) + 'px';
        element.style.height = Math.ceil(rect[3] - rect[1]) + 'px';
        return element;
    },

    setLinkTarget: function(element, link) {
        if (link.url) {
            element.href = link.url;
            element.target = this.EXTERNAL_LINK_TARGET;
        } else if (link.dest) {
            element.href = "#" + link.dest;
            var listView = this.pageView.listView;
            element.onclick = function(e) {
                e.preventDefault()
                listView.navigateTo(link.dest);
            }
            // TODO
        }
    }
}

return AnnotationsLayerBuilder;

});
