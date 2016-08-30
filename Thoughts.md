
import * from SomeMod -> open SomeMod
import NeighborMod from Self -> let module NeighborMod = Self__NeighborMod
import SomeChild from SomeMod -> let module SomeChild = SomeMod__SomeChild ??


TODO

- can I -pack opam things?

- multiple local
- yojson, which has dependencies
  - call ocamlfind to figure out the dependencies











- ocamlc = bytecode compiler, ocamlopt = native compiler
- native = faster, maybe less debuggable?

- two files, one depends on the other through automagic import.
- the one also depends on yojson

```
# ocamlbuild
ocamlbuild -use-ocamlfind -pkg yojson

:~/clone/rsn/Reason/cargo$ ocamlbuild one.native -use-ocamlfind -pkg yojson
+ ocamlfind ocamlc -c -package yojson -o two.cmo two.ml
+ ocamlfind ocamlc -c -package yojson -o one.cmo one.ml
+ ocamlfind ocamlopt -c -package yojson -o two.cmx two.ml
+ ocamlfind ocamlopt -c -package yojson -o one.cmx one.ml
+ ocamlfind ocamlopt -linkpkg -package yojson two.cmx one.cmx -o one.native
Finished, 7 targets (0 cached) in 00:00:00.


# ocamlfind
## NOTE dependencies must not be circular? w/ dependencies coming first
ocamlfind ocamlc two.ml one.ml -package yojson

# OR separately
ocamlfind ocamlc -c two.cmo two.ml

> one.ml depends on the parsetree module (from compiler-libs) and the two module
> in order for this to build, we need the `.cmi` files to be in the current
> directory, or in a directory included via `-I`
ln -s 
ocamlfind ocamlc -c one.cmo one.ml
ocamlfind ocamlc -package yojson two.cmo one.ml

-- compiling w/ ppx

:~/clone/rusty-automata/src$ ocamlfind ocamlc -c two.ml -package ppx_deriving -package ppx_deriving_yojson -only-show
ocamlc.opt -c
  -I /Users/jared/.opam/new-reason/lib/result
  -I /Users/jared/.opam/new-reason/lib/ppx_deriving
  -I /Users/jared/.opam/new-reason/lib/easy-format
  -I /Users/jared/.opam/new-reason/lib/biniou
  -I /Users/jared/.opam/new-reason/lib/yojson
  -I /Users/jared/.opam/new-reason/lib/ppx_deriving_yojson
  -ppx "/Users/jared/.opam/new-reason/lib/ppx_deriving/./ppx_deriving /Users/jared/.opam/new-reason/lib/ppx_deriving_yojson/./ppx_deriving_yojson.cma"
  two.ml


-- linking

:~/clone/rsn/Reason/cargo/hide$ ocamlfind ocamlc two.cmo one.cmo -package yojson -linkpkg -only-show
findlib: [WARNING] Interface yojson.cmi occurs in several directories: ., /Users/jared/.opam/new-reason/lib/yojson
ocamlc.opt
  -I /Users/jared/.opam/new-reason/lib/easy-format
  -I /Users/jared/.opam/new-reason/lib/biniou
  -I /Users/jared/.opam/new-reason/lib/yojson
  /Users/jared/.opam/new-reason/lib/easy-format/easy_format.cmo
  /Users/jared/.opam/new-reason/lib/biniou/biniou.cma
  /Users/jared/.opam/new-reason/lib/yojson/yojson.cmo
  two.cmo one.cmo

:~/clone/rusty-automata/src$ ocamlfind ocamlc two.cmo one.cmo -package ppx_deriving_yojson -linkpkg -only-show
ocamlc.opt
  -I /Users/jared/.opam/new-reason/lib/result
  -I /Users/jared/.opam/new-reason/lib/ppx_deriving
  -I /Users/jared/.opam/new-reason/lib/easy-format
  -I /Users/jared/.opam/new-reason/lib/biniou
  -I /Users/jared/.opam/new-reason/lib/yojson
  -I /Users/jared/.opam/new-reason/lib/ppx_deriving_yojson
  -ppx "/Users/jared/.opam/new-reason/lib/ppx_deriving/./ppx_deriving /Users/jared/.opam/new-reason/lib/ppx_deriving_yojson/./ppx_deriving_yojson.cma"
  /Users/jared/.opam/new-reason/lib/result/result.cma
  /Users/jared/.opam/new-reason/lib/ppx_deriving/ppx_deriving_runtime.cma
  /Users/jared/.opam/new-reason/lib/easy-format/easy_format.cmo
  /Users/jared/.opam/new-reason/lib/biniou/biniou.cma
  /Users/jared/.opam/new-reason/lib/yojson/yojson.cmo
  /Users/jared/.opam/new-reason/lib/ppx_deriving_yojson/ppx_deriving_yojson_runtime.cma
  two.cmo one.cmo


```

# One file

```
# ocamlbuild
:~/clone/rsn/Reason/cargo$ ocamlbuild two.native -use-ocamlfind

# ocamlfind
~$ ocamlfind ocamlc two.ml -o two.native -only-show
ocamlc.opt two.ml -o two.native

# ocamlc
~$ ocamlc.opt two.ml -o two.native
```
