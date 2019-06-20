ace.define("ace/snippets/jack",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "jack";

});
                (function() {
                    ace.require(["ace/snippets/jack"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            