ace.define("ace/snippets/ftl",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "ftl";

});
                (function() {
                    ace.require(["ace/snippets/ftl"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            