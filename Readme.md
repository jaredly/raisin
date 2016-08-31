# Raisin
a build system for Reason & Ocaml

## Import syntax
First via a `ppx`, in future it will be included in the Reason syntax
directly.

## Build tool
First in javascript for speed of iteraction, soon to be in Reason once various
kinks are smoothed out.

## I want to try it!
```
$ cd ppx && make ppx
$ cd sandbox; ../rsn.js
$ ./sandbox/awesome
```

## Thoughts
I think stuff like `menhir` integration would be great to do through
plugins... but how well do plugins work w/ ocaml?
