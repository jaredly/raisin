
open Ast_mapper
open Convert_utils.Wrap_importType

let endswith main suffix =
  let sl = String.length suffix in
  let ml = String.length main in
  if ml < sl then
    false
  else
    String.sub main (ml - sl) sl = suffix

let (selfPath, file, onStdin) =
  match Array.to_list Sys.argv with
    | _::path::ml::_ when endswith ml ".ml" -> (path, ml, false)
    | _::path::ml::_ when ml = "-" -> (path, ml, true)
    | _ -> failwith "Bad args"

let lexer =
  if onStdin then
    Lexing.from_channel stdin
  else
    Lexing.from_channel (open_in file)

let pstr = Parse.implementation lexer

let imports = ref []

let mapper = { Ast_mapper.default_mapper with
  structure_item = (fun mapper item ->
  let _ = (match Convert_utils.item_to_import item selfPath with
    | Some import -> (match import with
      | Single x
      | All (_, x)
      | ModuleFrom (_, _, x)
      | TypesFrom (_, _, x)
      | ValuesFrom (_, _, x) ->
       imports := x::!imports; ()
      | PpxFrom (_, x) ->
       imports := (x ^ ".ppx")::!imports; ()
    )
    | None -> ()) in
  (default_mapper.structure_item mapper item)
  )
};;

let _ = mapper.structure mapper pstr;;

(* let _ = List.iter (fun x -> print_endline x) !imports *)
let _ = print_endline ("some.cmo : " ^ String.concat " " (List.map (fun x -> x ^ ".cmo") !imports))
