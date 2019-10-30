ace.define("ace/snippets/gitignore",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "gitignore";

});
                (function() {
                    ace.require(["ace/snippets/gitignore"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            