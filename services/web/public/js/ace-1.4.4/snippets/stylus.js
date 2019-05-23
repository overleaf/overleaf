ace.define("ace/snippets/stylus",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "stylus";

});
                (function() {
                    ace.require(["ace/snippets/stylus"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            