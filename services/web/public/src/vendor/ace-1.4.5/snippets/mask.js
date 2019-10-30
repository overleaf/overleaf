ace.define("ace/snippets/mask",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "mask";

});
                (function() {
                    ace.require(["ace/snippets/mask"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            