
const path = require('path')
const build = require('./builder')
const mkdirp = require('mkdirp')

const base = path.join(__dirname, 'sandbox')
const ctx = {
  paths: {
    base: base,
    build: path.join(base, '_build'),
    tmp: path.join(base, '_build', 'tmp'),
    bin: path.join(base, '_build', 'bin'),
  },
  deps: {
    // TODO fill w/ deps data
  },
}

mkdirp.sync(ctx.paths.build)
mkdirp.sync(ctx.paths.tmp)
mkdirp.sync(ctx.paths.bin)

build({
  name: 'a-import',
  ocaml: {
    bin: './A.ml',
    opam: {
      Yojson: 'yojson',
    },
  },
  dependencies: {
    Cheese: './local/cheese',
  },
}, ctx)

