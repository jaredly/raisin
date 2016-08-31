[%%import B & from Self];
[%%import {sayHi: sayHi} from Self.C];
[%%import E & from Self.D];
[%%import {name: d_name} from Self.D];
[%%import {from_string, to_string} from Yojson.Safe];
[%%import Hello & from Self];
[%%import {names: names} from Cheese];

print_endline "A ";
print_endline ("Hello B - " ^ B.name);
print_endline ("Hello D - " ^ d_name);
sayHi "A is the betts";
let z = from_string {|{"x": 10}|};
print_endline (to_string z);
E.corner ();
