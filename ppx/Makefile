
both: ppx build

ppx:
	@rm -rf _build
	@mkdir _build
	@cd _build && ln -s ../convert_imports.ml ../convert_utils.ml ./
	@cd _build && ocamlfind ocamlopt -package ppx_tools.metaquot -package compiler-libs.common convert_utils.ml convert_imports.ml -linkpkg -o ../convert_imports.native

menhir:
	@rm -rf _build
	@mkdir _build
	@cd _build && ln -s ../menhir_deps.ml ../convert_utils.ml ./
	@cd _build && ocamlfind ocamlopt -package compiler-libs.common convert_utils.ml menhir_deps.ml -linkpkg -o ../menhir_deps.native

compilerLibs.cmi:
	@ocamlc -pack -o compilerLibs.cmo `ocamlfind query compiler-libs`/parsetree.cmi

setup_build: compilerLibs.cmi
	@rm -rf _build_test
	@mkdir -p _build_test
	@cd _build_test && ln -s ../compilerLibs.cmi ./
	@cd _build_test && ln -s ../other.ml ./Self__Other.ml
	@cd _build_test && ln -s ../main.ml ./Self__Main.ml

build: setup_build
	@cd _build_test && ocamlc -c Self__Other.ml
	@cd _build_test && ln -s /Users/jared/.opam/new-reason/lib/yojson/yojson.cmi ./
	@cd _build_test && ocamlc -c -ppx '../convert_imports.native ' Self__Main.ml
	@cd _build_test && ocamlc -o something \
					/Users/jared/.opam/new-reason/lib/easy-format/easy_format.cmo \
					/Users/jared/.opam/new-reason/lib/biniou/biniou.cma \
					/Users/jared/.opam/new-reason/lib/yojson/yojson.cmo \
					../compilerLibs.cmo \
					Self__Other.cmo Self__Main.cmo

check: ppx setup_build
	@cd _build_test && ocamlc -c Self__Other.ml
	@cd _build_test && ln -s /Users/jared/.opam/new-reason/lib/yojson/yojson.cmi ./
	@cd _build_test && ocamlc -c -dsource -ppx '../convert_imports.native ' Self__Main.ml

nostdlib: setup_build
	@cd _build_test && ln -s /usr/local/lib/ocaml/pervasives.cmi ./
	@cd _build_test && ln -s /usr/local/lib/ocaml/string.cmi ./
	# Build Other
	@cd _build_test && ocamlc -nostdlib -c Self__Other.ml
	# Grab Yojson
	@cd _build_test && ln -s /Users/jared/.opam/new-reason/lib/yojson/yojson.cmi ./
	# Build Main
	@cd _build_test && ocamlc -nostdlib -c -ppx ../convert_imports.native Self__Main.ml
	# Basically, I'll just have -nostdlib for the compiling part, not for
	# the linking part. And that will be enough to catch missed imports. I think?
	@cd _build_test && ocamlc -o awesome \
		/Users/jared/.opam/new-reason/lib/easy-format/easy_format.cmo \
		/Users/jared/.opam/new-reason/lib/biniou/biniou.cma \
		/Users/jared/.opam/new-reason/lib/yojson/yojson.cmo \
		../compilerLibs.cmo \
		Self__Other.cmo Self__Main.cmo

clean:
	rm -rf compilerLibs.cm*
	rm -rf convert_imports.native
	rm -rf _build_test
	rm -rf _build

.PHONY: menhir ppx
