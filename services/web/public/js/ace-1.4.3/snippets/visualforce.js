ace.define("ace/snippets/visualforce",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "visualforce";

});
                (function() {
                    ace.require(["ace/snippets/visualforce"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            