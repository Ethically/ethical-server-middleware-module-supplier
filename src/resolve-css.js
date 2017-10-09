import { readFileSync } from 'fs'
import { join } from 'path'
import { isRelative, getRootPath } from 'ethical-utility-path'
import { generateModuleID } from 'ethical-utility-resolve-module-node'

const source = (path) => {
    const css = readFileSync(path, 'utf8').replace(/\'/g, '"')
    return `module.exports = '${css.trim()}'`
}

const resolveCSSModule = (path) => {
    const key = generateModuleID(path)
    return { key, path, source }
}

export default resolveCSSModule
