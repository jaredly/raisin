
const path = require('path')
const {
  symlink, move,
  makeSourceFromImport, makeSource,
  ocamlLink, ocamlCompile,
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
  // Make the main bin?
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
    const link = path.join(ctx.paths.base, destPath)
    if (!fs.existsSync(link)) {
      symlink(destPath, link)
    }
  })
}

const makeBin = (dest, refile, ctx) => {
  const compiled = getCompiled(refile, ctx)
  const cmos = [].concat(...compiled.cmo)
  ocamlLink(dest, cmos.filter((x, i) => cmos.indexOf(x, i+1) === -1))
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

const makeCmo = (item, deps, results, ctx) => {
  // console.log('MAKE CMO', item)
  const tmp = makeTmpDir(ctx.paths.tmp)
  const source = item.moduleName + '.ml'
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
      prefix: getImportPrefix(item.source, ctx.paths.base),
      showSource: ctx.opts.showSource,
    })
  } catch (e) {
    const match = e.message.match(/Error: Unbound module (\w+)/)
    if (match) {
      // console.log(deps)
      console.log(tmp)
      console.log('\n')
      console.log(`  Undefined module "${match[1]}" in ${item.moduleName} \n    (${item.source})`)
      const maybepath = path.join(path.dirname(item.source), match[1].toLowerCase() + '.ml')
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
        // console.log(ctx.deps.opam)
        throw new Error(`Unrecognized package: ${item.name}. Is it declared in package.json?`)
      }
      return dep
    }
  })
  _deps[file] = {imports, time: Date.now()}
  return imports
}

