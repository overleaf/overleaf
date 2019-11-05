ace.define("ace/snippets/scala",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "scala";

});
                (function() {
                    ace.require(["ace/snippets/scala"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            