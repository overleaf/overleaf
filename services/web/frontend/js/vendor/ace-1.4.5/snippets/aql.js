ace.define("ace/snippets/aql",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "aql";

});
                (function() {
                    ace.require(["ace/snippets/aql"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            