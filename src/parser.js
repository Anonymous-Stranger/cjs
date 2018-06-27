"use strict";

var parse = require('bennu').parse;
var text = require('bennu').text;
var lang = require('bennu').lang;
var nu = require('nu-stream').stream;
var ast = require('./ast');

var ws = (p) => lang.between(
  parse.many(text.space),
  parse.many(text.space),
  p);

var bind_list = (...args) => {
  var parsers = args.slice(0, -1);
  var f = args[args.length - 1];
  return parse.bind(parse.eager(
    parse.enumerationa(parsers)),
    (results) => parse.always(f.apply(null, results)));
}

var step_point = (p) => {
  return bind_list(
    parse.getPosition, p, parse.getPosition,
    (start, result, end) => new ast.Steppoint({start: start.index, end: end.index}, result))
  };

var semi = parse.expected('semicolon', text.character(';'))

var letter_or_under = parse.either(text.letter, text.character('_'))
var ident = ws(parse.bind(parse.cons(
  letter_or_under, parse.many(parse.either(letter_or_under, text.digit))),
  (chars) => parse.always(nu.foldl(
    (acc, c) => acc + c,
    '',
    chars
  ))));

var typ = bind_list(
  ident,
  parse.eager(parse.many(ws(text.character('*')))),
  (typ, ptrs) => new ast.Typ(typ, ptrs.length-1));
// var typ = parse.expected(
//   'type',
//   parse.bind(parse.eager(parse.cons(ident, parse.many(ws(text.character('*'))))),
//     // (typ) => parse.always(typ)))
//     (x) => parse.bind(parse.getState,
//       (state) => {
//         var typ = x[0];
//         var ptrs = x.length-1;
//         if (state.types.indexOf(typ) != -1) {
//           return parse.always(new ast.Typ(typ, ptrs));
//         }
//         else {
//           return parse.fail('Expected type, got ' + typ)
//         }
//       })));

var var_name = ident;
// var var_name = parse.next(
//   parse.expected('variable name, not type', parse.not(parse.look(typ))),
//   ident)

var number = parse.bind(
  parse.many1(text.digit),
  (ds) => parse.always(new ast.Lit('int', Number(nu.reduce(
    (d, acc) => d + acc,
    ds)))));

// parse.late used to revolve cyclical reference
var atom = parse.late(() => ws(parse.expected(
  'Expected atom',
  parse.choice(
    number,
    parse.bind(ident, (n) => parse.always(new ast.Var(n))),
    lang.between(text.character('('),
                 text.character(')'),
                 expr)))));

var prefxs = (ops, next) => parse.bind(
  parse.many(ops),
  (ops) => parse.bind(
    next,
    (e) => parse.always(nu.foldr(
      (acc, op) => new ast.Uop(op, acc),
      e,
      ops
  ))));

var sufxs = (ops, next) => parse.bind(
  next,
  (e) => parse.bind(
    parse.many(ops),
    (ops) => parse.always(nu.foldl(
      (acc, op) => new ast.Uop(op, acc),
      e,
      ops
  ))));

var bopsl = (ops, next) => lang.chainl1(
  parse.bind(
    ws(ops),
    (op) => parse.always((e1, e2) => new ast.Bop(op, e1, e2))),
  next);

var bopsr = (ops, next) => lang.chainr1(
  parse.bind(
    ws(ops),
    (op) => parse.always((e1, e2) => new ast.Bop(op, e1, e2))),
  next);

// https://msdn.microsoft.com/en-us/library/126fe14k.aspx
var group1 = bopsl(text.string('::'), atom);
var group2 = group1; // TODO(alex): Postfixes
// TODO(alex): Add casting
var group3 = prefxs(text.trie(['sizeof', '++', '--', '~', '!', '-', '+', '&',
    '*', 'new', 'delete']), group2);
// var group3 = group2;
var group4 = bopsl(text.trie(['.', '->']), group3);
var group5 = bopsl(text.oneOf('*/%'), group4);
var group6 = bopsl(text.oneOf('+-'), group5);
var group7 = bopsl(text.trie(['<<', '>>']), group6);
var group8 = bopsl(text.trie(['<', '>', '<=', '>=']), group7);
var group9 = bopsl(text.trie(['==', '!=']), group8);
var group10 = bopsl(text.character('&'), group9);
var group11 = bopsl(text.character('^'), group10);
var group12 = bopsl(text.character('|'), group11);
var group13 = bopsl(text.string('&&'), group12);
var group14 = bopsl(text.string('||'), group13);
var group15 = group14; // TODO(alex) conditional
var group16 = bopsr(text.trie(['=', '*=', '/=', '+=', '-=']), group15);
var group17 = group16; // TODO(alex) throw
var group18 = bopsl(text.character(','), group17);
var expr = ws(group18);

var var_decl = bind_list(
  typ,
  ws(var_name),
  (typ, name) => new ast.Decl(typ, name));

var var_def = bind_list(
  var_decl,
  parse.optional(undefined, parse.next(
    ws(text.character('=')),
    expr)),
  (decl, assign) => {
    if(assign) {
      decl.val = assign;
    }
    return decl;
  });

var while_loop = parse.late(() =>
  bind_list(
    text.string('while'),
    ws(lang.between(
      text.character('('),
      text.character(')'),
      step_point(expr))),
    ws(stmt),
    (w, cond, body) => {
      return new ast.Loop(cond, body)
    }));

var scope = parse.late(() => lang.between(
    text.character('{'),
    text.character('}'),
    parse.bind(stmts, s => parse.always(new ast.Scope(s)))))

var stmt = ws(parse.choice(
  while_loop,
  scope,
  step_point(parse.attempt(lang.then(var_def, semi))),
  step_point(lang.then(expr, semi))));

var stmts = parse.eager(parse.many(ws(stmt)));

var params = lang.between(
  text.character('('),
  text.character(')'),
  parse.eager(
    ws(lang.sepBy(ws(text.character(',')), var_decl))));

var fn_def = bind_list(
  typ, ws(ident), ws(params), ws(scope),
  (typ, name, params, body) => new ast.Fn(typ, name, params, body));

var obj_tmpl = bind_list(
  text.trie(['class', 'struct']),
  ws(parse.optional(undefined, var_name)),
  lang.between(
    text.character('{'),
    text.character('}'),
    ws(parse.eager(parse.many(ws(parse.either(
      lang.then(text.trie(['public', 'private']), ws(':')),
      lang.then(var_decl, ws(semi))
    )))))),
  (type, name, body) => {
    var publ = type == 'struct';
    var publ = [];
    var priv = [];
    for(var e of body) {
      if(e == 'public') publ = true;
      else if(e == 'private') publ = false;
      else if (publ) publ.push(e);
      else priv.push(e);
    }
    return new ast.ObjTmpl(name, publ, priv);
  });

var file = parse.bind(lang.then(
    parse.eager(parse.many(
      ws(parse.choice(
        lang.then(obj_tmpl, ws(semi)),
        fn_def)))),
    parse.eof),
    (body) => parse.always(new ast.File(body)));


function UserData() {
  this.types = ['int', 'char', 'float'];
}
var parseFile = (s) => parse.run(file, s, new UserData())
var parseFn = (s) => parse.run(fn_def, s, new UserData())
var parseExpr = (s) => parse.run(expr, s, new UserData())
var parseStmt = (s) => parse.run(stmt, s, new UserData())

// parseFile(');
// console.log(parse.run(ident, 's'))
// console.log(parse.run(ident, 'asdf'))
// console.log(parse.run(ident, '_A1'))
// console.log(parse.run(ident, '_A64Hsfb'))
// parse.run(
//   bind_list(text.character('a'), (a) => (parse.always(a))
//   ),
//   'asdf')
// parse.run(
//   parse.choice(
//     parse.attempt(lang.then(text.character('a'), text.character('c'))),
//     parse.attempt(lang.then(text.character('a'), text.character('b')))
//   ),
//   'abc')
// console.log(parseFile('struct node { int key; }; int main () { node asdf; }'))

module.exports = {
  parseFile: parseFile,
  parseFn: parseFn,
  parseExpr: parseExpr,
  parseStmt: parseStmt,
}
