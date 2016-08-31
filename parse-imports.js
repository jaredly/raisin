
const fs = require('fs')
const path = require('path')
const {sh} = require('./utils')

const deps = path.join(__dirname, 'ppx', 'menhir_deps.native')

module.exports = (file, importPrefix) => {
  let menhir = file.match(/\.mly$/)
  let re = file.match(/\.re$/)
  let out
  if (menhir) {
    out = sh(`menhir --depend "${file}" --unused-tokens --ocamldep '${deps} "${importPrefix}"'`)
  } else if (re) {
    out = sh(`refmt -parse re -print ml ${file}`)
    console.log('here', out.toString('utf8'))
    out = sh(`${deps} "${importPrefix}" -`, {input: out.toString('utf8')})
    console.log('reason', out.toString('utf8'))
  } else {
    out = sh(`${deps} "${importPrefix}" "${file}"`)
  }
  const results = out.toString('utf8')
    .split(/\n/g)[0].split(' : ')[1].split(' ').filter(x => !!x.trim())
    .map(name => name.split('.')[0].trim())
  if (menhir) results.push('MenhirLib')
  return results.map(name => ({isSelf: !!name.match(/^Self__/), name}))
}

const old = (file, importPrefix) => {
  const text = fs.readFileSync(file).toString('utf8')
  // console.log('parsing', text)
  const deps = []
  const found = {}

  text.replace(/\[%%import \((\w+)\) from ([\w\.]+)\]/g, (_, target, source) => {
    const parts = source.split(/\./g)
    if (parts[0] === 'Self') {
      const name = 'Self' + importPrefix + '__' + (parts.length === 1 ? target : parts[1])
      if (!found[name]) {
        found[name] = true
        deps.push({
          isSelf: true,
          name: name
        })
      }
    } else {
      if (!found[parts[0]]) {
        found[parts[0]] = true
        deps.push({
          name: parts[0],
          full: parts.concat([target]),
        })
      }
    }
  })

  text.replace(/\[%%import\s+(\w+)\s*\]/g, (_, source) => {
    const parts = source.split(/\./g)
    if (!found[parts[0]]) {
      found[parts[0]] = true
      deps.push({
        name: parts[0],
        full: parts,
      })
    }
  })

  text.replace(/\[%%import \{[^\}]+\} from ([\w\.]+)\]/g, (_, source) => {
    const parts = source.split(/\./g)
    if (parts[0] === 'Self') {
      const name = parts[0] + importPrefix + '__' + parts[1]
      if (!found[name]) {
        found[name] = true
        deps.push({
          isSelf: true,
          name: name
        })
      }
    } else {
      if (!found[parts[0]]) {
        found[parts[0]] = true
        deps.push({
          name: parts[0],
          full: parts,
        })
      }
    }
  })
  // console.log('DEPS', file, deps)
  return deps
}
