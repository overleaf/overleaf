ace.define("ace/snippets/properties",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "properties";

});
                (function() {
                    ace.require(["ace/snippets/properties"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            