ace.define("ace/snippets/sjs",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "sjs";

});
                (function() {
                    ace.require(["ace/snippets/sjs"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            