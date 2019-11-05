ace.define("ace/snippets/matlab",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "matlab";

});
                (function() {
                    ace.require(["ace/snippets/matlab"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            