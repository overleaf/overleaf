ace.define("ace/snippets/plain_text",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "plain_text";

});
                (function() {
                    ace.require(["ace/snippets/plain_text"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            