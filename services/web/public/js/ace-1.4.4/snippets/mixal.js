ace.define("ace/snippets/mixal",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "mixal";

});
                (function() {
                    ace.require(["ace/snippets/mixal"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            