ace.define("ace/snippets/pgsql",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "pgsql";

});
                (function() {
                    ace.require(["ace/snippets/pgsql"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            