ace.define("ace/snippets/sass",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "sass";

});
                (function() {
                    ace.require(["ace/snippets/sass"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            