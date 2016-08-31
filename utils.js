const {execSync} = require('child_process')
const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs')

const IMPORT_PPX = path.join(__dirname, 'ppx', 'convert_imports.native')

const sh = (cmd, opts) => {
  // console.log('SH:', cmd, opts && opts.cwd)
  return execSync(cmd, {cwd: opts && opts.cwd, input: opts && opts.input})
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
  if (parts[0] === "n_p_m") {
    parts[0] = 'node_modules'
  }
  const full = path.join(base, parts.join('/'))
  if (fs.existsSync(full + '.re')) {
    return {path: full + '.re'}
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
    return {path: full + '/mod.re'}
  }
  if (fs.existsSync(full + '/mod.ml')) {
    return {path: full + '/mod.ml'}
  }
  throw new Error('Unknown module (no file found): ' + moduleName + ' looked in ' + full)
}

const getImportPrefix = (item, base) => {
  const fullPath = item.path
  const isNpm = item.type === 'npm'
  const prefix = path.relative(isNpm ? item.config.base : base, path.dirname(fullPath))
  let premod = prefix.replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '__')
  premod = premod ? '__' + premod : ''
  if (isNpm) {
    return "__n_p_m__" + item.config.name + premod
  }
  return premod
}

const ocamlLink = (dest, cmos) => {
  sh(`ocamlc -o ${dest} ${cmos.join(' ')}`)
}

const ocamlCompile = (filename, config) => {
  if (config.showSource) {
    console.log('[[[', path.basename(filename), ']]]')
  }
  const pp = filename.match(/\.re$/) ? '-pp refmt' : ''
  sh(`ocamlc ${config.showSource ? '-dsource' : ''} ${pp} -ppx "${IMPORT_PPX} ${config.prefix}" -c -impl ${filename}`, {cwd: config.cwd})
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
    pp: path.extname(source) === '.re' ? 'refmt' : null,
    moduleName,
    'archive(byte)': path.join(paths.build, moduleName + '.cmo'),
    'archive(interface)': path.join(paths.build, moduleName + '.cmi'),
  }
}

const makeSourceFromImport = (moduleName, paths, item) => {
  const config = sourceFromModuleName(moduleName, paths.base, paths.build)
  const base = item.type === 'npm' ? item.config.build : paths.build
  return Object.assign({
    type: item.type,
    moduleName,
    plugins: [],
    config: item.config,
    source: config.path,
    'archive(byte)': path.join(base, moduleName + '.cmo'),
    'archive(interface)': path.join(base, moduleName + '.cmi'),
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
