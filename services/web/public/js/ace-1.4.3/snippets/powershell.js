ace.define("ace/snippets/powershell",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "powershell";

});
                (function() {
                    ace.require(["ace/snippets/powershell"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            