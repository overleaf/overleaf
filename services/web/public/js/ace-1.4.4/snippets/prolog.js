ace.define("ace/snippets/prolog",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "prolog";

});
                (function() {
                    ace.require(["ace/snippets/prolog"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            