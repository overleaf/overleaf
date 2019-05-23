ace.define("ace/snippets/luapage",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "luapage";

});
                (function() {
                    ace.require(["ace/snippets/luapage"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            