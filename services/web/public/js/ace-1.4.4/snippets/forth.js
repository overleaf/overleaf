ace.define("ace/snippets/forth",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "forth";

});
                (function() {
                    ace.require(["ace/snippets/forth"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            