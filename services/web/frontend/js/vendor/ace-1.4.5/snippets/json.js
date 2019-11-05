ace.define("ace/snippets/json",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "json";

});
                (function() {
                    ace.require(["ace/snippets/json"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            