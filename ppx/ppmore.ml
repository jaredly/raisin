open Ast_mapper
open Ast_helper
open Asttypes
open Parsetree
open Longident

let selfPath =
  if Array.length Sys.argv > 3 then
    Sys.argv.(1)
  else
    ""

let rec convertlid lid =
  match lid with
  | Ldot (Lident "Self", two) ->
    Lident ("Self" ^ selfPath ^ "__" ^ two)
  | Ldot (one, two) ->
    Ldot ((convertlid one), two)
  | Lident str -> Lident str
  | Lapply (one, two) ->
    Lapply ((convertlid one), two)

let rec isSelf lid =
  match lid with
  | Ldot (one, two) -> isSelf one
  | Lident str -> str = "Self"
  | Lapply (one, two) -> isSelf one

let rec newModIdent source final =
  if not (isSelf source) then
    Ldot (source, final)
  else
    match source with
    | Lident "Self" ->
      Lident ("Self" ^ selfPath ^ "__" ^ final)
    | _ ->
        Ldot ((convertlid source), final)

let makeType source target loc =
  match target with
    | Pexp_record ([({txt = Lident left}, {pexp_desc = Pexp_ident {txt = Lident rename}})], _) ->
      {pstr_desc =
        Pstr_type [{
          ptype_name = {txt = rename; loc = loc};
          ptype_kind = Ptype_abstract;
          ptype_params = [];
          ptype_cstrs = [];
          ptype_private = Public;
          ptype_manifest = Some {
            ptyp_desc = Ptyp_constr ({txt = newModIdent source left; loc = loc}, []);
            ptyp_loc = loc; ptyp_attributes = [] };
          ptype_attributes=[]; ptype_loc=loc }]; pstr_loc=loc }
    | _ -> failwith "Invalid type import"

let makeMod left source loc =
    {pstr_desc =
      Pstr_module {
        pmb_name = {txt = left; loc = loc};
        pmb_expr = {
          pmod_desc = Pmod_ident {txt = newModIdent source left; loc = loc};
          pmod_loc = loc; pmod_attributes = [] };
        pmb_attributes=[]; pmb_loc=loc }; pstr_loc=loc }

let makeLet rename source left loc =
    [%stri let [%p {ppat_desc = Ppat_var {txt = rename; loc=loc}; ppat_loc = loc; ppat_attributes=[]}] = [%e {
      pexp_desc = (Pexp_ident {txt = Ldot ((if isSelf source then (convertlid source) else source), left); loc=loc});
      pexp_attributes = [];
      pexp_loc = loc}]]

let makeright source (target:Parsetree.expression_desc) loc =
  match target with
  | Pexp_record ([({txt = Lident left}, {pexp_desc = Pexp_ident {txt = Lident rename}})], _) ->
      makeLet rename source left loc
      (* (Pexp_construct ({txt = Lident frommod; loc = loc}, None)) *)
  | Pexp_construct ({txt = Lident left}, _) ->
      makeMod left source loc
  | _ -> failwith "Invalid"


let getenv_mapper argv =
  (* Our getenv_mapper only overrides the handling of expressions in the default mapper. *)
  { default_mapper with
    structure_item = fun mapper structure_item ->
      match structure_item with
      (* Is this an extension node? *)
      | { pstr_desc = Pstr_extension (({ txt = "import"; loc }, apply), _)} ->
        begin match apply with
        | PStr [{ pstr_desc = Pstr_eval ({ pexp_desc = Pexp_apply
            ({pexp_desc = Pexp_ident {txt = Lident "intf"}},
              [("", {pexp_desc = target});
              ("", {pexp_desc = Pexp_ident {txt = Lident "from"}});
              ("", {pexp_desc = Pexp_construct ({txt = source}, None)})]) }, _)}] ->
          [%stri let _ = ()]
        | PStr [{ pstr_desc = Pstr_eval ({ pexp_desc = Pexp_apply
            ({pexp_desc = Pexp_ident {txt = Lident "typ"}},
              [("", {pexp_desc = target});
              ("", {pexp_desc = Pexp_ident {txt = Lident "from"}});
              ("", {pexp_desc = Pexp_construct ({txt = source}, None)})]) }, _)}] ->
          makeType source target loc
        | PStr [{ pstr_desc = Pstr_eval ({pexp_desc = Pexp_construct ({txt = Lident left}, _)}, _)}] ->
          [%stri let _ = ()]
        | PStr [{ pstr_desc = Pstr_eval ({ pexp_desc = Pexp_apply
            ({pexp_desc = target},
              [("", {pexp_desc = Pexp_ident {txt = Lident "from"}});
              ("", {pexp_desc = Pexp_construct ({txt = source}, None)})]) }, _)}] ->
          makeright source target loc
        | _ ->
          raise (Location.Error (
                  Location.error ~loc "[%import] should be of the form [%import <target> from <source>] where target is either an ident or a destructure, and source is a Some.Thing"))
        end
      (* Delegate to the default mapper. *)
      | x -> default_mapper.structure_item mapper x;
  }

let () = register "import" getenv_mapper
