ace.define("ace/snippets/groovy",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "groovy";

});
                (function() {
                    ace.require(["ace/snippets/groovy"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            