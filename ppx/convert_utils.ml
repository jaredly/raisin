open Ast_mapper
open Ast_helper
open Asttypes
open Parsetree
open Longident

module Wrap_importType = struct
(* the Longident's represent the "source module" *)
  type importType =
    | Single of string
    | All of Longident.t * string
    | ModuleFrom of string * Longident.t * string
    | TypesFrom of (string * string) list * Longident.t * string
    | ValuesFrom of (string * string) list * Longident.t * string
    | PpxFrom of Longident.t * string
end
include Wrap_importType

let maybeDot source final =
  match final with
  | Some x -> Ldot (source, x)
  | None -> source

let rec makeSourceAndDepName source final selfPath =
  match source with
  | Lident "Self" ->
      let name =
      (match final with
      | Some x -> "Self" ^ selfPath ^ "__" ^ x
      | None -> "Self" ^ selfPath)
      in
      (Lident name), name
  | Lident x -> (Lident x), x
  | Ldot (Lident "Self", two) ->
    let name = "Self" ^ selfPath ^ "__" ^ two in
    (maybeDot (Lident name) final, name)
  | Ldot (one, two) ->
    let (source, dep) = makeSourceAndDepName one None selfPath in
    (maybeDot (Ldot (source, two)) final, dep)
  | Lapply (one, two) ->
    let (source, dep) = makeSourceAndDepName one None selfPath in
    (maybeDot (Lapply (source, two)) final, dep)

(*

import Thing

import * from Two
import (One) from Two.Three -> ('One', Thing, 'Dep name')
import (One) from Self.Two.Three
import (One) from Self

// alternate syntax (for reason, b/c reasons)
import One & from Self.Two

import type {one, two} from Two.Three
import type {one, two} from Self.Two

import {one, two} from Two.Three
import {one, two} from Self.Two

import intf Something from Otherplace // ?
import ppx from Self.PpxThing
import ppx from PackageWithAPpx

*)

let item_to_import = fun structure_item selfPath ->
      match structure_item with
      | { pstr_desc = Pstr_extension (({ txt = "import"; loc }, (PStr [{ pstr_desc = Pstr_eval ({pexp_desc = apply}, _) }])), _)} ->
        begin match apply with
        (* import Thing *)
        | Pexp_construct ({txt = Lident left}, _) ->
          Some (Single left)

        (* import ( * ) from Thing *)
        | Pexp_apply ({pexp_desc = Pexp_ident {txt = Lident "*"}}, [("", {pexp_desc=Pexp_ident {txt=Lident "from"}});
                                            ("", {pexp_desc = Pexp_construct ({txt = source}, _)})]) ->
          let (source, depname) = (makeSourceAndDepName source None selfPath) in
          Some (All (source, depname))

        (* import typ {thing} from Place *)
        |  Pexp_apply
            ({pexp_desc = Pexp_ident {txt = Lident "typ"}},
              [("", {pexp_desc = Pexp_record (items, _)});
              ("", {pexp_desc = Pexp_ident {txt = Lident "from"}});
              ("", {pexp_desc = Pexp_construct ({txt = source}, None)})]) ->

            let rec conv items = match items with
              | [] -> []
              | ({txt = Lident left}, {pexp_desc = Pexp_ident {txt = Lident rename}})::rest ->
                (left, rename)::(conv rest)
              | _ -> failwith "Invalid types import"
            in
            let (source, depname) = makeSourceAndDepName source None selfPath in
            Some (TypesFrom(conv items, source, depname))

        (* import ppx from Place *)
        |  Pexp_apply
            ({pexp_desc = Pexp_ident {txt = Lident "ppx"}},
              [("", {pexp_desc = Pexp_ident {txt = Lident "from"}});
              ("", {pexp_desc = Pexp_construct ({txt = source}, None)})]) ->

            let (source, depname) = makeSourceAndDepName source None selfPath in
            Some (PpxFrom(source, depname))

        (* import Mod & from Place *)
        |  Pexp_apply
            ({pexp_desc = Pexp_ident {txt = Lident "&"}},
              [("", {pexp_desc = Pexp_construct ({txt = Lident left}, _)});
               ("", {pexp_desc = Pexp_apply
                      ({pexp_desc = Pexp_ident {txt = Lident "from"}},
                       [("", {pexp_desc = Pexp_construct ({txt = source}, _)})])});]) ->
              let (source, depname) = makeSourceAndDepName source (Some left) selfPath in
              Some (ModuleFrom (left, source, depname))

        |  Pexp_apply
            ({pexp_desc = target},
              [("", {pexp_desc = Pexp_ident {txt = Lident "from"}});
              ("", {pexp_desc = Pexp_construct ({txt = source}, None)})]) ->

          (match target with
            (* import {thing} from Place *)
            | Pexp_record (items, _) ->
                let rec conv items = match items with
                  | [] -> []
                  | ({txt = Lident left}, {pexp_desc = Pexp_ident {txt = Lident rename}})::rest ->
                    (left, rename)::(conv rest)
                  | _ -> failwith "Invalid values import"
                in
                let (source, depname) = makeSourceAndDepName source None selfPath in
                Some (ValuesFrom(conv items, source, depname))

            (* import (Mod) from Place *)
            | Pexp_construct ({txt = Lident left}, _) ->
                let (source, depname) = makeSourceAndDepName source (Some left) selfPath in
                Some (ModuleFrom (left, source, depname))

            | _ -> failwith "Invalid import values")

        | _ ->
          raise (Location.Error (
                  Location.error ~loc "[%import] should be of the form [%import <target> from <source>] where target is either an ident or a destructure, and source is a Some.Thing"))
        end
      | x -> None
