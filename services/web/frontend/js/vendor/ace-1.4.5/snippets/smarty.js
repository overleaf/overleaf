ace.define("ace/snippets/smarty",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "smarty";

});
                (function() {
                    ace.require(["ace/snippets/smarty"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            