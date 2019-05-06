ace.define("ace/snippets/typescript",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "typescript";

});
                (function() {
                    ace.require(["ace/snippets/typescript"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            