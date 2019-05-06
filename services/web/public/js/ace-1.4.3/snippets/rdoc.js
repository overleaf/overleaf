ace.define("ace/snippets/rdoc",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "rdoc";

});
                (function() {
                    ace.require(["ace/snippets/rdoc"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            