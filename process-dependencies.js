const path = require('path')
const fs = require('fs')
const {sh} = require('./utils')
const capitalize = x => x[0].toUpperCase() + x.slice(1)
const parseOpamMeta = require('./parse-opam-meta')

module.exports = (config, ctx) => {
  processOpam(config, ctx)
  // processNpm(config, ctx)
}

const ocamlFind = name => sh(`ocamlfind query -r ${name}`).toString('utf8').split(/\n/g).map(x => x.trim()).filter(x => x)

const compilerLibs = {
  "name": "compiler-libs.common",
  "lib(byte)": "ocamlcommon.cma",
  "lib(native)": "ocamlcommon.cmxa",
  "children": [
    "clflags",
    "syntaxerr",
    "location",
    "parsetree",
    "ast_helper",
    "ast_mapper",
    "asttypes",
    "longident",
    "pprintast",
    "lexer",
    "misc",
    "config",
    "printast",
    "warnings",
    "parser",
    "syntaxerr",
    "location"
  ]
}

const processOpam = (config, ctx) => {
  ctx.deps.opam = {}
  Object.keys(config.ocaml.opam).forEach(key => {
    let conf = config.ocaml.opam[key]
    if (conf === 'compiler-libs.common') {
      conf = compilerLibs
    }
    if (typeof conf === 'string') {
      processMeta(config, ctx, key, conf)
    } else {
      const deps = ocamlFind(conf.name)
      const base = deps[deps.length - 1]
      // TODO support an object, so pretty-names can be specified
      conf.children.forEach(child => {
        const full = path.join(base, child)
        const meta = {
          name: child,
          type: 'opam',
          requires: [],
        }
        if (fs.existsSync(full + '.cmo')) {
          meta['archive(byte)'] = full + '.cmo'
        } else if (conf['lib(byte)']) {
          meta['archive(byte)'] = path.join(base, conf['lib(byte)'])
        }
        if (fs.existsSync(full + '.cmx')) {
          meta['archive(native)'] = full + '.cmx'
        } else if (conf['lib(native)']) {
          meta['archive(native)'] = path.join(base, conf['lib(native)'])
        }
        if (!fs.existsSync(full + '.cmi')) {
          throw new Error(`Child module ${child} doesn't have a .cmi (looked in ${full + '.cmi'}`)
        }
        meta['archive(interface)'] = full + '.cmi'
        ctx.deps.opam[child] = meta
        ctx.deps.opam[capitalize(child)] = meta
      })
    }
  })
}

const processMeta = (config, ctx, key, name) => {
  const found = sh(`ocamlfind query -r ${name}`).toString('utf8').split(/\n/g).map(x => x.trim()).filter(x => x)
  // console.log(key, name, 'found', found)
  found.forEach((base, i) => {
    const metas = parseOpamMeta(base, i === found.length - 1 && name)
    if (!metas) {
      if (i !== found.length - 1) return null
      const full = path.join(base, name)
      // for `unix`
      const meta = {
        name,
        type: 'opam',
        'archive(byte)': full + '.cmo',
        'archive(interface)': full + '.cmi',
        'archive(native)': full + '.cmx',
        requires: [],
      }
      ctx.deps.opam[meta.name] = meta
      ctx.deps.opam[capitalize(meta.name)] = meta
      ctx.deps.opam[key] = meta
      return
    }
    // console.log(metas)
    let foundChild = false
    Object.keys(metas.subs).forEach(child => {
      const meta = metas.subs[child]
      if (child === name && i === found.length - 1) {
        foundChild = true
        ctx.deps.opam[key] = meta
      }
      if (!meta['archive(byte)']) return // skip
      ctx.deps.opam[meta.name] = meta
      ctx.deps.opam[capitalize(meta.name)] = meta
      ctx.deps.opam[meta.name.replace(/\./g, '_')] = meta
      ctx.deps.opam[capitalize(meta.name.replace(/\./g, '_'))] = meta
    })
    if (i === found.length - 1) {
      // console.log('found child?', metas.subs, foundChild, name, key)
    }
    if (metas.base['archive(byte)']) {
      metas.base.name = metas.base.name || name
      ctx.deps.opam[metas.base.name] = metas.base
      ctx.deps.opam[capitalize(metas.base.name)] = metas.base
      if (!foundChild && i === found.length - 1) {
        ctx.deps.opam[key] = metas.base
      }
    }
  })
}

const processNpm = (config, ctx) => {
  ctx.deps.npm = {}
}
