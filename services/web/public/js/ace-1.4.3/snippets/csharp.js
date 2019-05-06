ace.define("ace/snippets/csharp",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "csharp";

});
                (function() {
                    ace.require(["ace/snippets/csharp"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            