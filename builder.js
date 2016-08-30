
const path = require('path')
const {
  symlink, move,
  makeSourceFromImport, makeSource,
  ocamlLink, ocamlCompile,
  makeTmpDir, rmDir,
  getImportPrefix,
} = require('./utils')
const parseImports = require('./parse-imports')
const fs = require('fs')

module.exports = (config, ctx) => {
  const dest = path.join(ctx.paths.bin, config.name)
  makeBin(
    dest,
    makeSource(config.ocaml.bin, ctx.paths),
    ctx
  )
  if (!fs.existsSync(ctx.paths.base)) {
    symlink(dest, ctx.paths.base)
  }
}

const makeBin = (dest, refile, ctx) => {
  const compiled = getCompiled(refile, ctx)
  ocamlLink(dest, [].concat(...compiled.cmo))
}

const getPackageCmos = (item, ctx) => {
  if (item.type === 'opam') {
    const deps = item.requires.map(name => getPackageCmos(ctx.deps.opam[name], ctx))
    return [].concat(...deps, item['archive(byte)'])
  }
  if (item.type === 'npm') {
    const deps = item.requires.map(name => getPackageCmos(ctx.deps.npm[name], ctx))
    return [].concat(...deps, item['archive(byte)'])
  }
  throw new Erorr('unknown type')
}

const getCompiled = (item, ctx) => {
  if (item.type !== 'source') {
    return {
      cmo: getPackageCmos(item, ctx),
      cmi: [item['archive(interface)']],
    }
  }
  const deps = getDeps(item.source, ctx)
  const subs = deps.map(dep => getCompiled(dep, ctx))
  let modifyTime = fs.statSync(item.source).mtime.getTime()
  subs.forEach(sub => {
    if (sub.modifyTime > modifyTime) {
      modifyTime = sub.modifyTime
    }
  })
  const results = {
    cmo: [].concat(...subs.map(r => r.cmo), item['archive(byte)']),
    cmi: [].concat(...subs.map(r => r.cmi), item['archive(interface)']),
    modifyTime: modifyTime,
    /*
    // only if all deps are cached
    cached: (
      !subs.some(sub => !sub.cached) &&
      fs.existsSync(item['archive(byte)']) &&
      fs.statSync(item['archive(byte)']).mtime.getTime()
    )
    */
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

const getBoth = (item, ctx) => {
}

const makeCmo = (item, deps, results, ctx) => {
  // console.log('MAKE CMO', item)
  const tmp = makeTmpDir(ctx.paths.tmp)
  const source = item.moduleName + '.ml'
  const fullName = path.join(tmp, source)
  symlink(item.source, fullName)
  results.cmi.forEach(dep => {
    if (dep !== item['archive(interface)']) {
      symlink(dep, tmp, true)
    }
  })
  // TODO ppx, pp
  ocamlCompile(fullName, {
    cwd: tmp,
    prefix: getImportPrefix(item.source, ctx.paths.base)
  })
  move(path.join(tmp, item.moduleName + '.cmi'), item['archive(interface)'])
  move(path.join(tmp, item.moduleName + '.cmo'), item['archive(byte)'])
  rmDir(tmp)
}

_deps = {}
const getDeps = (file, ctx) => {
  // && _deps[file].time > getMtime(file)
  if (_deps[file] ) {
    return _deps[file].imports
  }
  const imports = parseImports(file, getImportPrefix(file, ctx.paths.base)).map(item => {
    if (item.isSelf) {
      return makeSourceFromImport(item.name, ctx.paths)
    } else {
      const dep = ctx.deps.npm[item.name] || ctx.deps.opam[item.name]
      if  (!dep) {
        throw new Error(`Unrecognized package: ${dep}. Is it declared in package.json?`)
      }
      return dep
    }
  })
  _deps[file] = {imports, time: Date.now()}
  return imports
}

