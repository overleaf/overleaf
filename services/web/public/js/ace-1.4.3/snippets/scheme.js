ace.define("ace/snippets/scheme",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "scheme";

});
                (function() {
                    ace.require(["ace/snippets/scheme"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            