import requireHacker from 'require-hacker'
import { browserify, unbrowserify } from 'ethical-utility-browserifier'
import { requireModule, getAppPrefix, isRelativePackage } from 'ethical-utility-resolve-module-node'
import { absolute, relative } from 'ethical-utility-path'
import resolveCSSModule from './resolve-css.js'
import resolveJSModule from './resolve-js.js'

let moduleID = 0
const cache = {}

const resolveModule = (request, parent) => {
    if (request.endsWith('.css')) {
        return resolveCSSModule(request, parent)
    }
    return resolveJSModule(request, parent)
}

const resolveCache = (cached, modules, exclude) => {
    const { id, key, alias, source, path } = cached

    if (typeof require.cache[path + '.*'] === 'object') {
        global
        .__ethical_server_middleware_module_supplier__
        [path] = require.cache[path + '.*'].exports
    }

    if (exclude[id]) {
        const stubbedSource = `
            module.exports = (
                global.__ethical_server_middleware_module_supplier__['${path}']
            )
        `
        return { source: stubbedSource, path }
    }

    modules.push(cached)
    exclude[id] = 1
    return { source, path }
}

const handler = (modules, exclude) => (request, { filename: parent }) => {

    if (cache[request]) {
        return resolveCache(cache[request], modules, exclude)
    }

    const resolvedModule = resolveModule(request, parent)
    const { key, alias, path, source: getSource } = resolvedModule

    if (cache[key]) {
        return resolveCache(cache[key], modules, exclude)
    }

    const source = getSource(path)
    const id =  moduleID++
    cache[key] = { id, key, alias, source, path }

    return resolveCache(cache[key], modules, exclude)
}

const captureModules = (exclude) => {
    const modules = []
    const globalHook = requireHacker.global_hook('*', handler(modules, exclude))
    return () => {
        const cachedModules = modules.map(cached => {
            const { id, key, alias, source, path } = cached

            if (typeof require.cache[path + '.*'] === 'object') {
                global
                .__ethical_server_middleware_module_supplier__
                [path] = require.cache[path + '.*'].exports
            }

            return { id, key, alias, source }
        })
        globalHook.unmount()
        return cachedModules
    }
}

const decacheNode = () => {
    Object.keys(require.cache).forEach(key => { delete require.cache[key] })
    global.__ethical_server_middleware_module_supplier__ = {}
}

const moduleCapturerMiddleware = async (ctx, next, config) => {

    if (typeof ctx.response.body !== 'undefined') return await next()

    const { main, path = 'module' } = config

    if (ctx.request.path !== '/' + path) return await next()

    const { request: { query: { entry = absolute(main), exclude = '' } } } = ctx

    browserify()
    const excluded = {}
    exclude.split(',').forEach(id => excluded[id] = 1)
    const releaseModules = captureModules(excluded)
    try {
        requireModule(entry)
    } catch (e) {
        console.error(e)
    }
    const modules = releaseModules()

    unbrowserify()

    const [ mainModule = {} ] = modules

    if (main === relative(entry)) {
        mainModule.alias = mainModule.key
        mainModule.key = getAppPrefix()
    }

    ctx.response.body = JSON.stringify(modules)
    ctx.response.set('Content-Type', 'application/json')

    await next()
}

const moduleCapturerMiddlewareInit = (config = {}) => {
    decacheNode()
    return async (ctx, next) => (
        await moduleCapturerMiddleware(ctx, next, config)
    )
}

export default moduleCapturerMiddlewareInit
