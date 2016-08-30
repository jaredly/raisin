
open Ast_mapper
open Convert_utils.Wrap_importType

let endswith main suffix =
  let sl = String.length suffix in
  let ml = String.length main in
  if ml < sl then
    false
  else
    String.sub main (ml - sl) sl = suffix

let (file, isRe) =
  match Array.to_list Sys.argv with
    | _::ml::_ when endswith ml ".ml" -> (ml, true)
    | _::re::_ when endswith re ".re" -> (re, true)
    | _ -> failwith "Bad args"

let lexer =
  if isRe then
    failwith "Reason not yet supported"
  else
    Lexing.from_channel (open_in file)

let pstr = Parse.implementation lexer

let imports = ref []

let mapper = { Ast_mapper.default_mapper with
  structure_item = fun mapper item -> begin
  (match Convert_utils.item_to_import item "__src" with
    | Some import -> (match import with
      | Single x
      | ModuleFrom (_, _, x)
      | TypesFrom (_, _, x)
      | ValuesFrom (_, _, x) ->
       imports := x::!imports; ()
    )
    | None -> ());
  (default_mapper.structure_item mapper item)
  end
}
