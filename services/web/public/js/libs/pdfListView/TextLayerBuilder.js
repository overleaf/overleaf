(function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else context[name] = definition()
})('TextLayerBuilder', this, function (name, context) {

// optimised CSS custom property getter/setter
var CustomStyle = (function CustomStyleClosure() {

  // As noted on: http://www.zachstronaut.com/posts/2009/02/17/
  //              animate-css-transforms-firefox-webkit.html
  // in some versions of IE9 it is critical that ms appear in this list
  // before Moz
  var prefixes = ['ms', 'Moz', 'Webkit', 'O'];
  var _cache = { };

  function CustomStyle() {
  }

  CustomStyle.getProp = function get(propName, element) {
    // check cache only when no element is given
    if (arguments.length == 1 && typeof _cache[propName] == 'string') {
      return _cache[propName];
    }

    element = element || document.documentElement;
    var style = element.style, prefixed, uPropName;

    // test standard property first
    if (typeof style[propName] == 'string') {
      return (_cache[propName] = propName);
    }

    // capitalize
    uPropName = propName.charAt(0).toUpperCase() + propName.slice(1);

    // test vendor specific properties
    for (var i = 0, l = prefixes.length; i < l; i++) {
      prefixed = prefixes[i] + uPropName;
      if (typeof style[prefixed] == 'string') {
        return (_cache[propName] = prefixed);
      }
    }

    //if all fails then set to undefined
    return (_cache[propName] = 'undefined');
  };

  CustomStyle.setProp = function set(propName, element, str) {
    var prop = this.getProp(propName);
    if (prop != 'undefined')
      element.style[prop] = str;
  };

  return CustomStyle;
})();

function TextLayerBuilder(textLayerDiv) {
    this.textLayerDiv = textLayerDiv;
};

TextLayerBuilder.prototype = {
    beginLayout: function() {
        this.textDivs = [];
        this.textLayerQueue = [];
        this.renderingDone = false;
    },

    endLayout: function() {
        this.layoutDone = true;
        this.insertDivContent();
    },

    appendText: function(geom) {
        var textDiv = document.createElement('div');

        // vScale and hScale already contain the scaling to pixel units
        var fontHeight = geom.fontSize * Math.abs(geom.vScale);
        textDiv.dataset.canvasWidth = geom.canvasWidth * geom.hScale;
        textDiv.dataset.fontName = geom.fontName;

        textDiv.style.fontSize = fontHeight + 'px';
        textDiv.style.fontFamily = geom.fontFamily;
        textDiv.style.left = geom.x + 'px';
        textDiv.style.top = (geom.y - fontHeight) + 'px';

        textDiv.ondblclick = function(e) {
            if (window.getSelection)
                window.getSelection().removeAllRanges();
            else if (document.selection)
                document.selection.empty();
        }

        // The content of the div is set in the `setTextContent` function.

        this.textDivs.push(textDiv);
    },

    setTextContent: function(textContent) {
        this.textContent = textContent;
        this.insertDivContent();
    },

    insertDivContent: function() {
        // Only set the content of the divs once layout has finished, the content
        // for the divs is available and content is not yet set on the divs.
        if (!this.layoutDone || this.divContentDone || !this.textContent)
            return;

        this.divContentDone = true;

        var textDivs = this.textDivs;
        var bidiTexts = this.textContent.bidiTexts;

        for (var i = 0; i < bidiTexts.length; i++) {
            var bidiText = bidiTexts[i];
            var textDiv = textDivs[i];
            if (!/\S/.test(bidiText.str)) {
                textDiv.dataset.isWhitespace = true;
                continue;
            }

            textDiv.textContent = bidiText.str;
            // bidiText.dir may be 'ttb' for vertical texts.
            textDiv.dir = bidiText.dir === 'rtl' ? 'rtl' : 'ltr';
        }

        this.renderLayer();
    },

    renderLayer: function() {
        var self = this;
        var textDivs = this.textDivs;
        var bidiTexts = this.textContent.bidiTexts;
        var textLayerDiv = this.textLayerDiv;
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var textLayerFrag = document.createDocumentFragment();

        // No point in rendering so many divs as it'd make the browser unusable
        // even after the divs are rendered
        var MAX_TEXT_DIVS_TO_RENDER = 100000;
        if (textDivs.length > MAX_TEXT_DIVS_TO_RENDER)
            return;

        for (var i = 0, ii = textDivs.length; i < ii; i++) {
            var textDiv = textDivs[i];
            if ('isWhitespace' in textDiv.dataset) {
                continue;
            }
            textLayerFrag.appendChild(textDiv);

            ctx.font = textDiv.style.fontSize + ' ' + textDiv.style.fontFamily;
            var width = ctx.measureText(textDiv.textContent).width;

            if (width > 0) {
                var textScale = textDiv.dataset.canvasWidth / width;

                var transform = 'scale(' + textScale + ', 1)';
                if (bidiTexts[i].dir === 'ttb') {
                    transform = 'rotate(90deg) ' + transform;
                }
                CustomStyle.setProp('transform' , textDiv, transform);
                CustomStyle.setProp('transformOrigin' , textDiv, '0% 0%');

                textLayerDiv.appendChild(textDiv);
            }
        }

        this.renderingDone = true;
        //this.updateMatches();

        textLayerDiv.appendChild(textLayerFrag);
    },

    /*setupRenderLayoutTimer: function() {
        // Schedule renderLayout() if user has been scrolling, otherwise
        // run it right away
        var RENDER_DELAY = 200; // in ms
        var self = this;
        if (Date.now() - PDFView.lastScroll > RENDER_DELAY) {
            // Render right away
            this.renderLayer();
        } else {
            // Schedule
            if (this.renderTimer)
                clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(function() {
                self.setupRenderLayoutTimer();
            }, RENDER_DELAY);
        }
    }*/
};

return TextLayerBuilder;

});
