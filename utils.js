const {execSync} = require('child_process')
const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs')

const IMPORT_PPX = path.join(__dirname, 'ppx', 'convert_imports.native')

const sh = (cmd, opts) => {
  // console.log('SH:', cmd, opts && opts.cwd)
  return execSync(cmd, {cwd: opts && opts.cwd})
}
const symlink = (from, to, isDir) => sh(`ln -s ${from} ${to}`)
const move = (from, to) => sh(`mv ${from} ${to}`)

const withoutExt = fname =>
  fname.slice(0, -(path.extname(fname).length))
const makeModuleName = (source, base) => {
  return 'Self__' + withoutExt(
    path.relative(base, source)
      .replace(/^\./, '')
      .replace(/^\//, '')
      .replace(/\/$/, '')
  ).replace(/\//g, '__')
}

const sourceFromModuleName = (moduleName, base, build) => {
  const parts = moduleName.split(/__/g).slice(1) // rm Self__
  const full = path.join(base, parts.join('/'))
  if (fs.existsSync(full + '.re')) {
    return {path: full + '.re', pp: 'reason'}
  }
  if (fs.existsSync(full + '.ml')) {
    return {path: full + '.ml'}
  }
  if (fs.existsSync(full + '.mll')) {
    return {
      path: full + '.mll',
      plugins: ['ocamllex'],
      source: path.join(build, moduleName + '.ml'),
    }
  }
  if (fs.existsSync(full + '.mly')) {
    return {
      path: full + '.mly',
      plugins: ['menhir'],
      source: path.join(build, moduleName + '.ml'),
      interface: path.join(build, moduleName + '.mli'),
    }
  }
  if (fs.existsSync(full + '/mod.re')) {
    return {path: full + '/mod.re', pp: 'reason'}
  }
  if (fs.existsSync(full + '/mod.ml')) {
    return {path: full + '/mod.ml'}
  }
  throw new Error('Unknown module (no file found): ' + moduleName)
}

const getImportPrefix = (fullPath, base) => {
  let prefix = path.relative(base, path.dirname(fullPath))
  // console.log('prefix!', prefix)
  let premod = prefix.replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '__')
  return premod.length ? '__' + premod : ''
}

const ocamlLink = (dest, cmos) => {
  sh(`ocamlc -o ${dest} ${cmos.join(' ')}`)
}

const ocamlCompile = (filename, config) => {
  if (config.showSource) {
    console.log('[[[', path.basename(filename), ']]]')
  }
  sh(`ocamlc ${config.showSource ? '-dsource' : ''} -ppx "${IMPORT_PPX} ${config.prefix}" -c ${filename}`, {cwd: config.cwd})
}

const menhirCompile = (filename, config) => {
  // TODO pp ppx
  sh(`menhir --strict --unused-tokens --fixed-exception --table --infer --ocamlc "ocamlc -ppx '${IMPORT_PPX} ${config.prefix}'" ${filename}`, {cwd: config.cwd})
}

const ocamllexCompile = (filename, dest) => {
  // TODO pp ppx
  sh(`ocamllex ${filename} -o ${dest}`)
}

const makeSource = (source, paths) => {
  const moduleName = makeModuleName(source, paths.base)
  return {
    type: 'source',
    path: path.join(paths.base, source),
    source: path.join(paths.base, source),
    moduleName,
    'archive(byte)': path.join(paths.build, moduleName + '.cmo'),
    'archive(interface)': path.join(paths.build, moduleName + '.cmi'),
  }
}

const makeSourceFromImport = (moduleName, paths) => {
  const config = sourceFromModuleName(moduleName, paths.base, paths.build)
  return Object.assign({
    type: 'source',
    moduleName,
    plugins: [],
    source: config.path,
    'archive(byte)': path.join(paths.build, moduleName + '.cmo'),
    'archive(interface)': path.join(paths.build, moduleName + '.cmi'),
  }, config)
}

let tmpnum = 0
const makeTmpDir = base => {
  const suffix = Date.now()
  // const suffix = Math.random().toString(16).slice(2)
  const rand = path.join(base, `tmp-${tmpnum++}-${suffix}`)
  mkdirp.sync(rand)
  return rand
}

const rmDir = dir => sh(`rm -rf ${dir}`)

module.exports = {
  symlink, move,
  makeSourceFromImport, makeSource,
  ocamlLink, ocamlCompile,
  makeTmpDir,
  rmDir, sh,
  getImportPrefix,
  menhirCompile,
  ocamllexCompile,
}
