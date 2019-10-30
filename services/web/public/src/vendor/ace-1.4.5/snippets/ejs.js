ace.define("ace/snippets/ejs",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "ejs";

});
                (function() {
                    ace.require(["ace/snippets/ejs"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            