[%%import (B) from Self]
[%%import {sayHi} from Self.C]
[%%import (E) from Self.D]
[%%import {name=d_name} from Self.D]
[%%import {from_string; to_string} from Yojson.Safe]

let _ = print_endline "A "
let _ = print_endline ("Hello B - " ^ B.name)
let _ = print_endline ("Hello D - " ^ d_name)
let _ = sayHi "A is the betts"
let z = from_string {|{"x": 10}|}
let _ = print_endline (to_string z)
let _ = E.corner()
