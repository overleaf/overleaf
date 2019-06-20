ace.define("ace/snippets/swift",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "swift";

});
                (function() {
                    ace.require(["ace/snippets/swift"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            