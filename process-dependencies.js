const path = require('path')
const fs = require('fs')
const {sh} = require('./utils')
const capitalize = x => x[0].toUpperCase() + x.slice(1)
const parseOpamMeta = require('./parse-opam-meta')

module.exports = (config, ctx) => {
  processOpam(config, ctx)
  // processNpm(config, ctx)
}

const processOpam = (config, ctx) => {
  ctx.deps.opam = {}
  Object.keys(config.ocaml.opam).forEach(key => {
    const name = config.ocaml.opam[key]
    const found = sh(`ocamlfind query -r ${name}`).toString('utf8').split(/\n/g)
    found.forEach(base => {
      if (!base.trim()) return
      const meta = parseOpamMeta(base)
      meta.type = 'opam'
      ctx.deps.opam[meta.name] = meta
      ctx.deps.opam[capitalize(meta.name)] = meta
    })
  })
}

