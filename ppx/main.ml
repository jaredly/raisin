[%%import typ {expression_desc} from CompilerLibs.Parsetree]
[%%import (Parsetree) from CompilerLibs]
[%%import {x; y} from Self.Other]
[%%import (Other) from Self]
[%%import {from_string=parseJson} from Yojson.Safe]
let x = parseJson "10"
let _ = print_endline Other.z
let _ = print_endline y
