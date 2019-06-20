ace.define("ace/snippets/space",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "space";

});
                (function() {
                    ace.require(["ace/snippets/space"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            