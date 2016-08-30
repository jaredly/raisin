open Ast_mapper
open Ast_helper
open Asttypes
open Parsetree
open Longident
open Convert_utils.Wrap_importType

let selfPath =
  if Array.length Sys.argv > 3 then
    Sys.argv.(1)
  else
    ""

let makeType left rename source loc =
      {pstr_desc =
        Pstr_type [{
          ptype_name = {txt = rename; loc = loc};
          ptype_manifest = Some {
            ptyp_desc = Ptyp_constr ({txt = Ldot (source, left); loc = loc}, []);
            ptyp_loc = loc; ptyp_attributes = [] };
          ptype_kind = Ptype_abstract; ptype_params = []; ptype_cstrs = []; ptype_private = Public; ptype_attributes=[]; ptype_loc=loc }]; pstr_loc=loc }

let makeMod left source loc =
    {pstr_desc =
      Pstr_module {
        pmb_name = {txt = left; loc = loc};
        pmb_expr = {
          pmod_desc = Pmod_ident {txt = source; loc = loc};
          pmod_loc = loc; pmod_attributes = [] }; pmb_attributes=[]; pmb_loc=loc }; pstr_loc=loc }

let makeValue left rename source loc =
  [%stri let [%p {ppat_desc = Ppat_var {txt = rename; loc=loc}; ppat_loc = loc; ppat_attributes=[]}] = [%e {
      pexp_desc = (Pexp_ident {txt = Ldot (source, left); loc=loc});
      pexp_attributes = [];
      pexp_loc = loc}]]


let import_to_structure_items import loc = match import with
  | Single name -> [[%stri let _ = ()]]
  | ModuleFrom (name, source, _) -> [makeMod name source loc]
  | TypesFrom (types, source, _) -> List.map (fun (left, right) -> makeType left right source loc) types
  | ValuesFrom (values, source, _) -> List.map (fun (left, right) -> makeValue left right source loc) values

let map_item = fun default_mapper mapper structure_item ->
  match Convert_utils.item_to_import structure_item selfPath with
  | None -> [default_mapper mapper structure_item]
  | Some x -> import_to_structure_items x structure_item.pstr_loc

let main_mapper argv =
  { default_mapper with
    structure = (fun mapper structure ->
      List.fold_right
      (fun item items ->
        List.concat [(map_item default_mapper.structure_item mapper item); items])
        structure []
      );
  }

let () = register "import" main_mapper
