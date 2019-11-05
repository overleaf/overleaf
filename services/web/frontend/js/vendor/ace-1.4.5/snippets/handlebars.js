ace.define("ace/snippets/handlebars",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "handlebars";

});
                (function() {
                    ace.require(["ace/snippets/handlebars"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            