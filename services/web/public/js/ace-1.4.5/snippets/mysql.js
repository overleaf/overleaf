ace.define("ace/snippets/mysql",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "mysql";

});
                (function() {
                    ace.require(["ace/snippets/mysql"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            