ace.define("ace/snippets/apex",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "apex";

});
                (function() {
                    ace.require(["ace/snippets/apex"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            