ace.define("ace/snippets/rhtml",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "rhtml";

});
                (function() {
                    ace.require(["ace/snippets/rhtml"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            