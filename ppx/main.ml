[%%import typ { expression_desc } from CompilerLibs.Parsetree]
[%%import Parsetree & (from CompilerLibs)]
[%%import from * Self.Other]
[%%import Other & (from Self)]
[%%import Inner & from Self.Other]
[%%import { from_string = parseJson } from Yojson.Safe]
let x = parseJson "10"
let _ = print_endline Other.z
let _ = print_endline y
let _ = print_endline Inner.value
