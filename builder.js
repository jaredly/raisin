
const path = require('path')
const {
  symlink, move,
  makeSourceFromImport, makeSource,
  ocamlLink, ocamlCompile, menhirCompile, ocamllexCompile,
  makeTmpDir, rmDir,
  getImportPrefix,
} = require('./utils')
const processDependencies = require('./process-dependencies')
const parseImports = require('./parse-imports')
const fs = require('fs')

module.exports = (config, ctx) => {
  // process deps
  processDependencies(config, ctx)
  buildBins(config, ctx)
}

const buildBins = (config, ctx) => {
  // console.log(ctx.deps)
  if (typeof config.ocaml.bin === 'string') {
    config.ocaml.bin = {[config.name]: config.ocaml.bin}
  }
  Object.keys(config.ocaml.bin).forEach(dest => {
    const src = config.ocaml.bin[dest]
    const destPath = path.join(ctx.paths.bin, dest)
    makeBin(
      destPath,
      makeSource(src, ctx.paths),
      ctx
    )
    // TODO is this the right place?
    const link = path.join(ctx.paths.base, dest)
    if (!fs.existsSync(link)) {
      symlink(destPath, link)
    }
  })
}

const uniq = ar => ar.filter((x, i) => ar.indexOf(x) === i)

const makeBin = (dest, refile, ctx) => {
  const compiled = getCompiled(refile, ctx)
  const cmos = uniq([].concat(...compiled.cmo))
  ocamlLink(dest, cmos)
}

const makePpx = (item, ctx) => {
  ocamlLink(item.item['executable(ppx)'], uniq([].concat(...item.cmo)))
  return item.item['executable(ppx)']
}

const getOpamCmos = (item, ctx) => {
  if (!item) {
    // Umm is this OK?
    return []
  }
  const deps = item.requires.map(name => getOpamCmos(ctx.deps.opam[name], ctx))
  return [].concat(...deps, item['archive(byte)'])
}

const getCompiled = (item, ctx) => {
  if (item.type === 'opam') {
    return {cmo: getOpamCmos(item, ctx), cmi: [item['archive(interface)']],}
  }
  const deps = getDeps(item, ctx)
  const subs = deps.map(dep => getCompiled(dep, ctx))
  let modifyTime = fs.statSync(item.path).mtime.getTime()
  subs.forEach(sub => {
    if (sub.modifyTime > modifyTime) {
      modifyTime = sub.modifyTime
    }
  })
  const normals = subs.filter(x => !x.isPpx)
  const results = {
    item,
    isPpx: item.isPpx,
    ppx: subs.filter(x => x.isPpx),
    cmo: [].concat(...normals.map(r => r.cmo), item['archive(byte)']),
    cmi: [].concat(...normals.map(r => r.cmi), item['archive(interface)']),
    modifyTime: modifyTime,
  }
  const needBuild = !fs.existsSync(item['archive(byte)']) ||
      fs.statSync(item['archive(byte)']).mtime.getTime() < results.modifyTime
  if (needBuild) {
    console.log('Building', item.moduleName)
    makeCmo(item, deps, results, ctx)
    results.modifyTime = Date.now()
  } else {
    console.log('Using cached', item.moduleName)
  }
  return results
}

const plugins = {
  menhir: {
    preCmo(item, deps, results, ctx) {
      const tmp = makeTmpDir(ctx.paths.tmp)
      const source = item.moduleName + '.mly'
      const fullName = path.join(tmp, source)
      symlink(item.path, fullName)
      const found = {}
      found[item['archive(interface)']] = true
      results.cmi.forEach(dep => {
        if (!found[dep]) {
          found[dep] = true
          symlink(dep, tmp, true)
        }
      })
      menhirCompile(fullName, {
        cwd: tmp,
        prefix: getImportPrefix(item, ctx.paths.base),
      })
      move(path.join(tmp, item.moduleName + '.ml'), item.source)
      move(path.join(tmp, item.moduleName + '.mli'), item.interface)
      rmDir(tmp)
    }
  },

  ocamllex: {
    preDeps(item, ctx) {
      // TODO cache
      ocamllexCompile(item.path, item.source)
    }
  }
}

const makeCmo = (item, deps, results, ctx) => {
  if (item.plugins) {
    item.plugins.forEach(plugin => {
      if (plugins[plugin].preCmo) {
        plugins[plugin].preCmo(item, deps, results, ctx)
      }
    })
  }
  const ext = path.extname(item.source)
  const tmp = makeTmpDir(ctx.paths.tmp)
  const source = item.moduleName + ext
  const fullName = path.join(tmp, source)
  symlink(item.source, fullName)
  const found = {}
  found[item['archive(interface)']] = true
  results.cmi.forEach(dep => {
    if (!found[dep]) {
      found[dep] = true
      symlink(dep, tmp, true)
    }
  })
  try {
    // TODO ppx
    ocamlCompile(fullName, {
      cwd: tmp,
      prefix: getImportPrefix(item, ctx.paths.base),
      showSource: ctx.opts.showSource,
      ppx: results.ppx.map(item => makePpx(item, ctx)),
      pp: item.pp,
    })
  } catch (e) {
    console.log(results)
    console.log(item)
    console.log(deps)
    showModuleError(e, item)
    // console.error(e)
    console.log(Object.keys(found))
    console.log(deps)
    console.log(item)
    throw e
  }
  move(path.join(tmp, item.moduleName + '.cmi'), item['archive(interface)'])
  move(path.join(tmp, item.moduleName + '.cmo'), item['archive(byte)'])
  rmDir(tmp)
}

const showModuleError = (e, item) => {
  let match = e.message.match(/Error: Unbound module (\w+)/)
  if (match) {
    console.log(deps)
    console.log('\n')
    console.log(`  Undefined module "${match[1]}" in ${item.moduleName} \n    (${item.path})`)
    const maybepath = path.join(path.dirname(item.path), match[1].toLowerCase() + '.ml')
    if (fs.existsSync(maybepath)) {
      console.log(`Looks like there's a file ${maybepath} -- did you forget to import it?`)
    }
    console.log('\n')
    process.exit(1)
  }
  match = e.message.match(/Uninterpreted extension '(\w+)'/)
  if (match) {
    console.log('\n')
    console.log(`  Looks like you forgot to require a ppx to handle "${match[1]}"

      Add a line like [%%import ppx from WhateverPpxWillHandleThis]
      to the top of ${item.path}`)
    console.log('')
    process.exit(1)
  }
}

const system = ['Lexing', 'String', 'Format']

_deps = {}
const getDeps = (item, ctx) => {
  const file = item.path.match(/\.mll$/) ? item.source : item.path

  if (_deps[file] ) {
    return _deps[file].imports
  }

  if (item.plugins) {
    item.plugins.forEach(plugin => {
      if (plugins[plugin].preDeps) {
        plugins[plugin].preDeps(item, ctx)
      }
    })
  }

  const isNpm = item.type === 'npm'
  const prefix = getImportPrefix(item, ctx.paths.base)
  const imports = parseImports(file, prefix).map(imp => {
    if (imp.isSelf) {
      const result = makeSourceFromImport(imp.name, ctx.paths, item)
      if (imp.isPpx) {
        result.isPpx = true
        result['executable(ppx)'] = path.join(result.base, result.moduleName + '.ppx')
      }
      return result
    } else {
      const dep = ctx.deps.npm[imp.name] || ctx.deps.opam[imp.name]
      if (!dep && system.indexOf(imp.name) === -1) {
        // console.log(ctx.deps.opam)
        throw new Error(`Unrecognized package: ${imp.name}. Is it declared in package.json?`)
      }
      return dep
    }
  }).filter(x => x)
  _deps[file] = {imports, time: Date.now()}
  return imports
}
