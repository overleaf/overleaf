ace.define("ace/snippets/red",[], function(require, exports, module) {
"use strict";

exports.snippetText = " ";
exports.scope = "red";

});
                (function() {
                    ace.require(["ace/snippets/red"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            