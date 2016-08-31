[%%import from * Asttypes];
[%%import from * Parsetree];
[%%import from * Ast_mapper];
[%%import Ast_helper];

let test_mapper argv => {
  ...default_mapper,
  expr: fun mapper expr =>
    switch expr {
    | {pexp_desc: Pexp_extension {txt: "test"} (PStr []) [@implicit_arity]} =>
      Ast_helper.Exp.constant (Const_int 42)
    | other => default_mapper.expr mapper other
    }
};

register "ppx_test" test_mapper;
