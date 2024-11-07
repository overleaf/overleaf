"use strict";

// Grammar implemented here:
//  bibtex -> (string | entry)*;
//  string -> '@STRING' kv_left key_equals_value kv_right;
//  entry -> '@' key kv_left key ',' key_value_list kv_right;
//  key_value_list -> key_equals_value (',' key_equals_value)* ','?;
//  key_equals_value -> key '=' value;
//  value -> value_quotes | value_braces | key;
//  value_quotes -> '"' .*? '"'; // not quite
//  value_braces -> '{' .*? '"'; // not quite
//  kv_left -> '(' | '{'
//  kv_right -> ')' | '}'
function BibtexParser() {
  this._entries = {};
  this._comments = [];
  this._strings = {};
  this.input = '';
  this.config = {
    upperKeys: false
  };
  this._pos = 0;
  var pairs = {
    '{': '}',
    '(': ')',
    '"': '"'
  };
  var regs = {
    atKey: /@([a-zA-Z0-9_:\\./-]+)\s*/,
    enLeft: /^([\{\(])\s*/,
    enRight: function enRight(left) {
      return new RegExp("^(\\".concat(pairs[left], ")\\s*"));
    },
    entryId: /^\s*([^@={}",\s]+)\s*,\s*/,
    key: /^([a-zA-Z0-9_:\\./-]+)\s*=\s*/,
    vLeft: /^([\{"])\s*/,
    vRight: function vRight(left) {
      return new RegExp("^(\\".concat(pairs[left], ")\\s*"));
    },
    inVLeft: /^(\{)\s*/,
    inVRight: function inVRight(left) {
      return new RegExp("^(\\".concat(pairs[left], ")\\s*"));
    },
    value: /^[\{"]((?:[^\{\}]|\n)*?(?:(?:[^\{\}]|\n)*?\{(?:[^\{\}]|\n)*?\})*?(?:[^\{\}]|\n)*?)[\}"]\s*,?\s*/,
    word: /^([^\{\}"\s]+)\s*/,
    comma: /^(,)\s*/,
    quota: /^(")\s*/
  };

  this.setInput = function (t) {
    this.input = t;
  };

  this.matchFirst = function (reg) {
    var notMove = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var result = this.input.slice(this._pos).match(reg);

    if (result) {
      if (!notMove) {
        // console.log("!@#!@#", result[1]);
        this._pos += result.index + result[0].length;
      }

      return {
        success: true,
        text: result[1],
        index: result.index,
        step: result[0].length
      };
    } else {
      return {
        success: false
      };
    }
  };

  this.assert = function (obj) {
    for (var key in obj) {
      if (obj[key] === undefined) {
        throw "[BibParser:ERROR] ".concat(key, " not found at ").concat(this._pos);
      }
    }
  };

  this.getValue = function () {
    var stack = [];
    var values = [];

    var _this$matchFirst = this.matchFirst(regs.vLeft),
        vLeft = _this$matchFirst.text;

    this.assert({
      vLeft: vLeft
    });
    stack.push(vLeft);

    while (stack.length > 0) {
      if (this.matchFirst(regs.inVLeft, true).success) {
        var _this$matchFirst2 = this.matchFirst(regs.inVLeft),
            inVLeft = _this$matchFirst2.text;

        stack.push(inVLeft);
        values.push(inVLeft);
      } else if (this.matchFirst(regs.inVRight(stack[stack.length - 1]), true).success) {
        values.push(this.matchFirst(regs.inVRight(stack[stack.length - 1])).text);
        stack.pop();
      } else if (this.matchFirst(regs.word, true).success) {
        values.push(this.matchFirst(regs.word).text);
      } else if (this.matchFirst(regs.quota, true).success) {
        values.push(this.matchFirst(regs.quota).text);
      } else {
        throw "[BibParser:ERROR] stack overflow at ".concat(this._pos);
      }
    }

    values.pop();
    this.matchFirst(regs.comma);
    return values;
  };

  this.string = function () {
    var _this$matchFirst3 = this.matchFirst(regs.key),
        key = _this$matchFirst3.text;

    this.assert({
      key: key
    });

    var _this$matchFirst4 = this.matchFirst(regs.value),
        value = _this$matchFirst4.text;

    this.assert({
      value: value
    });
    this._strings[key] = value;
  };

  this.preamble = function () {};

  this.comment = function () {};

  this.entry = function (head) {
    var _this$matchFirst5 = this.matchFirst(regs.entryId),
        entryId = _this$matchFirst5.text;

    this.assert({
      entryId: entryId
    });
    var entry = {};

    while (this.matchFirst(regs.key, true).success) {
      var _this$matchFirst6 = this.matchFirst(regs.key),
          key = _this$matchFirst6.text;

      var value = this.getValue();
      entry[key] = value.join(' '); // if(key === 'author'){
      //   const {text:value} = this.matchFirst(regs.value);
      //   this.assert({value});
      //   entry[key] = value;
      // } else {
      //   const {text:value} = this.matchFirst(regs.value);
      //   this.assert({value});
      //   entry[key] = value;
      // }
    }

    entry.$type = head;
    this._entries[entryId] = entry;
  };

  this.parse = function () {
    while (this.matchFirst(regs.atKey, true).success) {
      var _this$matchFirst7 = this.matchFirst(regs.atKey),
          head = _this$matchFirst7.text;

      var _this$matchFirst8 = this.matchFirst(regs.enLeft),
          enLeft = _this$matchFirst8.text;

      this.assert({
        enLeft: enLeft
      });

      if (head.toUpperCase() == 'STRING') {
        this.string();
      } else if (head.toUpperCase() == 'PREAMBLE') {
        this.preamble();
      } else if (head.toUpperCase() == 'COMMENT') {
        this.comment();
      } else {
        this.entry(head);
      }

      var _this$matchFirst9 = this.matchFirst(regs.enRight(enLeft)),
          enRight = _this$matchFirst9.text;

      this.assert({
        enRight: enRight
      });
    }
  };
} //Runs the parser


export function bibParse(input) {
  var b = new BibtexParser();
  b.setInput(input);
  b.parse();
  return b._entries;
}
