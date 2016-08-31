#!/usr/bin/env node
const path = require('path')
const build = require('./builder')
const mkdirp = require('mkdirp')

let base
if (process.argv.length > 2) {
  base = path.join(process.cwd(), process.argv[2])
} else {
  base = process.cwd()
}

const config = require(path.join(base, 'package.json'))
const ctx = {
  paths: {
    base: base,
    build: path.join(base, '_build'),
    tmp: path.join(base, '_build', 'tmp'),
    bin: path.join(base, '_build', 'bin'),
    npm: path.join(base, '_build', 'npm'),
  },
  deps: {
    opam: {},
    npm: {},
  },
  opts: {
    showSource: false,
  },
}

mkdirp.sync(ctx.paths.build)
mkdirp.sync(ctx.paths.tmp)
mkdirp.sync(ctx.paths.bin)
mkdirp.sync(ctx.paths.npm)

build(config, ctx)
