[%%import typ {expression_desc: expression_desc} from CompilerLibs.Parsetree];
[%%import Parsetree & from CompilerLibs];
[%%import ( * ) from Self.Other];
[%%import Other & from Self];
[%%import {from_string: parseJson} from Yojson.Safe];

let x = parseJson "10";
print_endline Other.z;
print_endline y;
