var parse = require("../src/compiler.js");
var test = require("tape");

test("creating and initializing various variables", function(t) {
  t.plan(1);

  t.doesNotThrow(() => new Runtime({ code: `int main() { }` }),
    undefined, "basic function declaration")

  // t.doesNotThrow(() => parse(tokenize(
  //   `int **x = 4;
  //   int main() {
  //   }`
  // )), undefined, "pointer declaration and initialization")
  //
  // t.doesNotThrow(() => parse(tokenize(
  //   `int x[1];
  //   int main() {
  //   }`
  // )), undefined, "array declaration")
  //
  // t.doesNotThrow(() => parse(tokenize(
  //   `int *x, y[5], z = 4;
  //   int main() {
  //   }`
  // )), undefined, "multiple declatations on one line")
  //
  // t.doesNotThrow(() => parse(tokenize(
  //   `int *x, y[6], z = 4;
  //   int main() {
  //     int x, y, z;
  //   }`
  // )), undefined, "shadowing of variables in different scopes")
  //
  // t.doesNotThrow(() => parse(tokenize(
  //   `int *x, *y, z = 4;
  //   int main() {
  //     int x, y, z;
  //     {
  //       int x, y, z;
  //       if(1) {
  //         int x, y, z;
  //       }
  //       for(1;1;1) {
  //         int x, y, z;
  //       }
  //     }
  //   }`
  // )), undefined, "multiple shadowing of multiple variables")
  //
  // t.throws(() => parse(tokenize(
  //   `int main() {
  //     int x, y;
  //     int x = 2;
  //   }`
  // )), undefined, "variable redeclaration should thow an error")
  //
  // t.throws(() => parse(tokenize(
  //   `int main() {
  //     int x, y;
  //   }
  //   int main() {
  //     int x, y;
  //   }`
  // )), undefined, "function redeclaration should throw an error")
})