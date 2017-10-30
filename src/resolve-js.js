import { readFileSync } from 'fs'
import { isAbsolutePackage } from 'ethical-utility-resolve-module'
import {
    generateModuleID,
    resolveModulePath
} from 'ethical-utility-resolve-module-node'

const source = (path) => readFileSync(path, 'utf8')

const resolveAlias = (request, id) => {
    if (isAbsolutePackage(request)) {
        return id
    }
}

const resolveJSModule = (request, parent) => {
    const path = resolveModulePath(request, parent)
    const id = generateModuleID(path)
    const alias = resolveAlias(request, id)
    const key = ( alias ? request : id )
    return { key, alias, path, source }
}

export default resolveJSModule
