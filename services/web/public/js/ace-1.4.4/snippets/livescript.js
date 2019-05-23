ace.define("ace/snippets/livescript",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "livescript";

});
                (function() {
                    ace.require(["ace/snippets/livescript"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            