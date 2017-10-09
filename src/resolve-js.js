import { readFileSync } from 'fs'
import { isRelative } from 'ethical-utility-path'
import {
    isAbsolutePackage,
    isRelativePackage,
    resolveRelative,
    resolveNodeModule,
    resolveNodeModuleFile,
    generateModuleID
} from 'ethical-utility-resolve-module-node'

const source = (path) => readFileSync(path, 'utf8')

const resolveJSPath = (request, parent) => {
    if (isAbsolutePackage(request)) return resolveNodeModule(request)
    if (isRelativePackage(request)) return resolveNodeModuleFile(request)
    if (isRelative(request)) return resolveRelative(request, parent)
    return request
}

const resolveAlias = (request, id) => {
    if (isAbsolutePackage(request)) {
        return id
    }
}

const resolveJSModule = (request, parent) => {
    const path = resolveJSPath(request, parent)
    const id = generateModuleID(path)
    const alias = resolveAlias(request, id)
    const key = ( alias ? request : id )
    return { key, alias, path, source }
}

export default resolveJSModule
