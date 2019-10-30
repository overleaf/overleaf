ace.define("ace/snippets/jade",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "jade";

});
                (function() {
                    ace.require(["ace/snippets/jade"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            