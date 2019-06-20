ace.define("ace/snippets/nix",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "nix";

});
                (function() {
                    ace.require(["ace/snippets/nix"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            