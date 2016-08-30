
> for the moment, everything is public. I don't want to mess w/ .rei
> generation from [@export] annotations just yet

--- process ---

# How ocamlc/opt works

- .byte <- .cmo (all deps) + .cmo (main)
- .cmo  <- .cmi (immediate) + .ml (main) // Ohhhh wait maybe we do need
  transitive dependencies though.

```
ocamlc [creates] [needs: all transitive dependencies]
- executable needs cmo + cma, and the last one is the entry point

ocamlc -c [creates] [needs: immediate dependencies]
- cmo(source) + cmi(source) needs .cmi's from all immediate dependents (IMPLICIT), and a .ml (+ maybe .mli)

- cmi(lib) comes from the lib ~ needs to be symlinked in
- cmo(lib) comes from the lib ~ is referenced explicitly

- .mli can be generated from `ocaml -i somefile.ml`, needs `.cmi`s maybe? not
  sure
```

# Here's a pseudo-python buildery thing

> package.json
```js
/// you can have multiple bins, but only one lib? prolly
{
  name: "hello",
  ocaml: {
    bin: "./hello.re",
    // or
    bin: {
      hello: "./hello.re",
    },

    lib: true, // looks for mod.re in base dir
    lib: "./exportable.re", // alternate

    opam: {
      "Yojson": "yojson",
    },
  },
  dependencies: {
    "Cheese": "git://github.com/jaredly/cheese.git",
  },
}
```

```
// hello.re
import Yojson
import {something} from Cheese

something()
```

```

```

```
import config from './config'

cmos = make_cmos(entry)

def make_cmo(fname):
  fname_cmo = fname + '.cmo'
  imports = get_imports(fname)
  cmos = imports.map(as_cmo)
  allcmos = cmos + [fname_cmo]
  if exists(fname_cmo):
    return allcmos
  $ ocamlc -c cmos fname -o fname_cmo
  return allsmos

def as_cmo(item):
  something

def get_imports(fname):
  maybe parse it? or just like regex it?


for i, fname in enumerate(topo_sorted_files):
  ocamlc -c topo_sorted_files[:i+1] -o fname+'.cmo'

ocamlc -o binary_name topo_sorted_files.map(f => f + '.cmo')


```

check:
	ocamlc -dsource \
					-I /Users/jared/.opam/new-reason/lib/easy-format \
					-I /Users/jared/.opam/new-reason/lib/biniou \
					-I /Users/jared/.opam/new-reason/lib/yojson \
					-I /usr/local/lib/ocaml/compiler-libs \
					-ppx ./ppx_getenv.native \
					-ppx ./ppmore.native \
					/Users/jared/.opam/new-reason/lib/easy-format/easy_format.cmo \
					/Users/jared/.opam/new-reason/lib/biniou/biniou.cma \
					/Users/jared/.opam/new-reason/lib/yojson/yojson.cmo \
					compilerLibs.cmo \
					other.ml foo.ml











# PPX usage
until reason merges it, I can just abuse ppx I guess :D

`[%import _type {some} from Self]`

Valid things
```
[%import ModName from Self            -> in the same directory
[%import PackageName                  -> declared in package.json, gets the `package/lib.re`
                                    -> now I can use PackageName, right?
[%import * from PackageName           -> open PackageName
[%import intf PackageName             -> rewrites to `let _ = ()`, just lets the builder know to include that interface
[%import {value} from Self.ModName    -> `export let value = ...` in ModName.re
[%import {value} from PackageName     -> `export let value = ...` in `package/lib.re`
[%import {value} from PackageName.SubModName -> `export SubModName` in `package/lib.re`
                                             -> `export let value = ...` in package/SubModName.re
[%import SubModName from PackageName -> `export SubModName` in `package/lib.re`
[%import ppx:deriving from ppx_deriving_yojson
loadppx from ppx_deriving_json
loadppx from Self.Modname
> Maybe? Maybe it's ok for there to be only one ppxable file per library?
> It would be more flexible if you could just load a ppx from anywhere
> `loadppx from Self.ppx_something`
```

(you can't `import Self`, b/c that doesn't make sense)

# auto-packing??
For some things, like `compiler-libs`, the sub modules are published directly,
and so I would want to auto-pack them, with `ocamlc -pack -o compilerLibs.cmo /usr/local/lib/ocaml/compiler-libs/parsetree.cmi`

## Thoughts about relative imports
I kindof want to be able to get parent modules from within the package.
like
`import Something from "../Something.re"`

- `import Something from Self:` ? allow trailing / in-between colons? maybe
  confusing
- `import {name} from Self.Something` (same directory)
  `import {name} from Self..Something` (parent directory)
- `import Something from Self..` (parent directory)
  `import Something from Self.` (same directory)
  `import Something from Self` (same as same directory? ORR from root -- but
  that could be weird bc there's no way to do `import {name} from SelfSomething`)
  -- that has some poetry to it?
- `import {name} from Self...Something.Child` (grandparent, then child of the
  mod.rs?`

buuut can I make sure to rule out circular dependencies?

# What will this rewrite to?
If I can avoid reason needing info from the build system in order to transpile
things, that would be good. Ideally, the communication will be one-way
`reason -> (these are modules to expose) -> build system`

Buuut do I need to be able to distinguish between a file and a directory?
Nope, becase `Path/mod.re` is the same as Path.re`

Does reason need to know the currect directory in order to rewrite correctly?
like if we're in `src/Path/Sub/Thing.re`, then
- `import {name} from Self.Something` becomes `let name = Self__Path__Sub__Something.name`
- `import Other from Self..` becomes `let module Other = Self__Path__Other`
- `import Child from Self..Other` becomse `let module Child = Self__Path__Other.Child`

yup. you can't reach into directories not in your direct line.
children have to be exposed.
You can see peers of yourself & your direct ancestors.
You can't see your direct ancestors b/c that is probably circular
e.g.

```
H.re
A/
  mod.re
  B.re
  C.re
  D/mod.re
  D/E.re
  F/mod.re
  F/G.re
```

G can see B, C, D, H, but not E, A, F
C can see B, H, D, F, but not E, G, A
H can see A, but nothing else


# Simple 2-file
```
one.re
| print_endline Import.Self.Two.name
two.re
| export let name = "Jared"

one.re
| import {name} from Self.Two
| print_endline name

one.re
| import Two from Self
| print_endline Two.name
```

# Simple external
```
one.re
| print_endline Import.OtherMod.name
| print_endline Import.OtherMod.Consts.name

// othermod.git
lib.re
| export {name} from Self.Consts
| export Consts from Self
consts.re
| export let name = "Othermod"
```




# Kitchen Sink
```
one.re
| import Two from Self
| import Hello from Self
| import {greet} from Self.Hello
| print_endline(greet(Two.name))
| print_endline(Hello.Child.greet(Two.name))

two.re
| export let name = "Julie"
hello/child.re
| export let greet name => "Hello " ^ name
hello/mod.re
| export {greet} from Self.Child
| export Child from Self
utils/mod.re
| export {process} from Self.Process
utils/process.re
| export let process num => num + 1
```


# Trying to ditch stdlib to force you to include `String` etc manually

Oooh looks like I can ditch -stdlib just for the inital compilation phase, and
then have it back in for the linking (which is the harder part?)

```
nostdlib:
	rm -rf _build
	mkdir -p _build
	cd _build && ln -s ../other.ml ../foo.ml ../compilerLibs.cmi ./
	cd _build && ln -s /usr/local/lib/ocaml/pervasives.cmi ./
	cd _build && ln -s /usr/local/lib/ocaml/string.cmi ./
	cd _build && ocamlc -nostdlib -c other.ml -o other.cmo
	cd _build && ln -s /Users/jared/.opam/new-reason/lib/yojson/yojson.cmi ./
	cd _build && ocamlc -nostdlib -c -ppx ../ppmore.native other.cmo foo.ml -o foo.cmo
	# Basically, I'll just have -nostdlib for the compiling part, not for the linking part. And that will be enough to catch missed imports. I think?
	cd _build && ocamlc -o awesome \
					/Users/jared/.opam/new-reason/lib/easy-format/easy_format.cmo \
					/Users/jared/.opam/new-reason/lib/biniou/biniou.cma \
					/Users/jared/.opam/new-reason/lib/yojson/yojson.cmo \
					../compilerLibs.cmo \
					-ppx ../ppmore.native \
					other.cmo foo.cmo
```

META file

```
name = "yojson"
version = "1.3.2"
description = "JSON parsing and printing (successor of json-wheel)"
requires = "easy-format,biniou"
archive(byte) = "yojson.cmo"
archive(native) = "yojson.cmx"
archive(native,plugin) = "yojson.cmxs"
package "biniou" (
 version = "1.3.2"
 description = "JSON <=> Biniou conversion"
 requires = "easy-format,biniou"
 archive(byte) = "yojson_biniou.cmo"
 archive(native) = "yojson_biniou.cmx"
 archive(native,plugin) = "yojson_biniou.cmxs"
)
```

