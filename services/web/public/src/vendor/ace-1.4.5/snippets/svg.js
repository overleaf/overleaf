ace.define("ace/snippets/svg",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "svg";

});
                (function() {
                    ace.require(["ace/snippets/svg"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            