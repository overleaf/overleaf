ace.define("ace/snippets/xml",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "xml";

});
                (function() {
                    ace.require(["ace/snippets/xml"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            