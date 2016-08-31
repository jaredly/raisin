
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
    .map(name => {
      const parts = name.split('.')
      if (parts[1] === 'ppx') {
        return {
          name: parts[0],
          isSelf: !!name.match(/^Self__/),
          isPpx: true,
        }
      } else {
        return {
          name: parts[0],
          isSelf: !!name.match(/^Self__/),
        }
      }
    })
  if (menhir) results.push({name: 'MenhirLib'})
  return results
}
