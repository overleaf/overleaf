ace.define("ace/snippets/nginx",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "nginx";

});
                (function() {
                    ace.require(["ace/snippets/nginx"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            