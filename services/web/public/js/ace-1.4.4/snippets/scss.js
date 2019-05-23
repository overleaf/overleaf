ace.define("ace/snippets/scss",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "scss";

});
                (function() {
                    ace.require(["ace/snippets/scss"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            