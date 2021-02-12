import express from 'express'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path'
import sass from 'sass'
import _ from 'underscore'
import BS from 'browser-sync'

import WebDAVHandler from './webdav'

const host = process.env.HOST || '127.0.0.1'
const port = process.env.PORT || 3000
const WEB_FOLDER = path.resolve(process.env.WEB_FOLDER || './web')
const PUBLIC = path.join(WEB_FOLDER, 'public')

const bs = BS.create()

bs.init({
  server: WEB_FOLDER,
  port,
  host,
  open: false,
  ui: false,
  middleware: [
    morgan(process.env.NODE_ENV === 'production' ? 'short' : 'tiny'),
    express.static(PUBLIC),
    bodyParser.json(),
    {
      route: '/api',
      handle: update
    },
    {
      route: '/webdav',
      handle: WebDAVHandler(path.join(WEB_FOLDER, 'style'))
    }
  ]
})
bs.watch(WEB_FOLDER + '/index.html').on('change', bs.reload)

const outFile = path.join(PUBLIC, 'style.css')
const styleMain = path.join(WEB_FOLDER, 'style', 'bootstrap.scss')
function _rebuildStyle (file) {
  const includePaths = ['./node_modules/bootstrap/scss']
  try {
    const f = sass.renderSync({ file: styleMain, includePaths, outFile })
    fs.writeFile(outFile, f.css, (err) => {
      return err ? console.error(err) : bs.reload(outFile)
    })
  } catch (err) {
    console.error(err)
  }
}
bs.watch(WEB_FOLDER + '/style/*.scss').on('change', _rebuildStyle)
bs.watch(WEB_FOLDER + '/style/*.css').on('change', _rebuildStyle)
_rebuildStyle(styleMain)

function update (req, res, next) {
  const pathParts = req.body.path.split('.')
  const filename = pathParts[0] === '/' ? '_index.js' : pathParts[0]
  const filePath = path.join(path.resolve(WEB_FOLDER), 'data', filename)
  try {
    const data = require(filePath).default
    const subTree = _.get(data, _.rest(pathParts))
    if (!subTree) throw new Error(`Nothing found on path: ${req.body.path}`)
    Object.assign(subTree, req.body.data)
    const src = `export default ${JSON.stringify(data, null, 2)}`
    fs.writeFile(filePath, src, (err) => {
      return err ? next(err) : res.write('ok') && res.end()
    })
  } catch (err) {
    next(err)
  }
}
