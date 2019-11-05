ace.define("ace/snippets/dot",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "dot";

});
                (function() {
                    ace.require(["ace/snippets/dot"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            