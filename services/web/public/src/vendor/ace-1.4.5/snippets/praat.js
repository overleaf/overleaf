ace.define("ace/snippets/praat",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "praat";

});
                (function() {
                    ace.require(["ace/snippets/praat"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            