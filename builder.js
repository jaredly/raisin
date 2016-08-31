
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

const makeBin = (dest, refile, ctx) => {
  const compiled = getCompiled(refile, ctx)
  const cmos = [].concat(...compiled.cmo)
  const filtered = cmos.filter((x, i) => cmos.indexOf(x) === i)
  ocamlLink(dest, filtered)
}

const getPackageCmos = (item, ctx) => {
  if (!item) {
    // Umm is this OK?
    return []
  }
  if (item.type === 'opam') {
    const deps = item.requires.map(name => getPackageCmos(ctx.deps.opam[name], ctx))
    return [].concat(...deps, item['archive(byte)'])
  }
  if (item.type === 'npm') {
    const deps = item.requires.map(name => getPackageCmos(ctx.deps.npm[name], ctx))
    return [].concat(...deps, item['archive(byte)'])
  }
  console.log(item)
  throw new Error('unknown type')
}

const getCompiled = (item, ctx) => {
  if (item.type !== 'source') {
    return {
      cmo: getPackageCmos(item, ctx),
      cmi: [item['archive(interface)']],
    }
  }
  const deps = getDeps(item, ctx)
  const subs = deps.map(dep => getCompiled(dep, ctx))
  let modifyTime = fs.statSync(item.path).mtime.getTime()
  subs.forEach(sub => {
    if (sub.modifyTime > modifyTime) {
      modifyTime = sub.modifyTime
    }
  })
  const results = {
    cmo: [].concat(...subs.map(r => r.cmo), item['archive(byte)']),
    cmi: [].concat(...subs.map(r => r.cmi), item['archive(interface)']),
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
        prefix: getImportPrefix(item.path, ctx.paths.base),
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
    // TODO ppx, pp
    ocamlCompile(fullName, {
      cwd: tmp,
      prefix: getImportPrefix(item.path, ctx.paths.base),
      showSource: ctx.opts.showSource,
      pp: item.pp,
    })
  } catch (e) {
    const match = e.message.match(/Error: Unbound module (\w+)/)
    if (match) {
      console.log(deps)
      console.log(tmp)
      console.log('\n')
      console.log(`  Undefined module "${match[1]}" in ${item.moduleName} \n    (${item.path})`)
      const maybepath = path.join(path.dirname(item.path), match[1].toLowerCase() + '.ml')
      if (fs.existsSync(maybepath)) {
        console.log(`Looks like there's a file ${maybepath} -- did you forget to import it?`)
      }
      console.log('\n')
      process.exit(1)
    }
    // console.error(e)
    console.log(Object.keys(found))
    console.log(results)
    console.log(item)
    throw e
  }
  move(path.join(tmp, item.moduleName + '.cmi'), item['archive(interface)'])
  move(path.join(tmp, item.moduleName + '.cmo'), item['archive(byte)'])
  rmDir(tmp)
}

const system = ['Lexing', 'String', 'Format']

_deps = {}
const getDeps = (item, ctx) => {
  const file = item.path.match(/\.mll$/) ? item.source : item.path

  // && _deps[file].time > getMtime(file)
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

  const imports = parseImports(file, getImportPrefix(item.path, ctx.paths.base)).map(item => {
    if (item.isSelf) {
      return makeSourceFromImport(item.name, ctx.paths)
    } else {
      const dep = ctx.deps.npm[item.name] || ctx.deps.opam[item.name]
      if (!dep && system.indexOf(item.name) === -1) {
        // console.log(ctx.deps.opam)
        throw new Error(`Unrecognized package: ${item.name}. Is it declared in package.json?`)
      }
      return dep
    }
  }).filter(x => x)
  _deps[file] = {imports, time: Date.now()}
  return imports
}
