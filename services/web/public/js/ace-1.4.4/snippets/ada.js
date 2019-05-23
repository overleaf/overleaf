ace.define("ace/snippets/ada",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "ada";

});
                (function() {
                    ace.require(["ace/snippets/ada"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            