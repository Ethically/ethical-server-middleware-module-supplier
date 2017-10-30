import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import ethicalServer from 'ethical-utility-server'
import { expect } from 'chai'
import moduleCapturerMiddleware from '../../src/index.js'

const host = 'http://localhost:8080'
let data = {
    "browserMap": {},
    "conflictMap": {},
    "modules": [{
            id: 0,
            key: '~/test/files/dist/a.js',
            source: '\'use strict\';\n\nrequire(\'./b.js\');\n\nconst value = require(\'test/files/css/file.css\');\n\nif (value !== \'"css"\') {\n    throw new Error(\'CSS is not being properly resolved!\');\n}'
        },
        {
            id: 1,
            key: '~/test/files/dist/b.js',
            source: '\'use strict\';\n\nrequire(\'ethical-noop-module-browser\');\n\nrequire(\'./c.js\');'
        },
        {
            id: 2,
            key: 'ethical-noop-module-browser',
            source: 'module.exports = require(\'./browser/file.js\')\n',
            alias: 'ethical-noop-module-browser/browser.js'
        },
        {
            id: 3,
            key: 'ethical-noop-module-browser/browser/file.js',
            source: 'module.exports = \'@ethical-noop-module-browser/browser/file.js\'\n'
        },
        {
            id: 4,
            key: '~/test/files/dist/c.js',
            source: '\'use strict\';\n\nrequire(\'ethical-noop-module-browser\');\n\nrequire(\'ethical-noop-module-browser/relative.js\');'
        },
        {
            id: 5,
            key: 'ethical-noop-module-browser/relative.js',
            source: 'module.exports = \'@ethical-noop-module-browser/relative.js\'\n'
        },
        {
            id: 6,
            key: 'test/files/css/file.css',
            source: 'module.exports = \'"css"\''
        }
    ]
}

describe('moduleCapturerMiddleware()', () => {

    let destroyServer
    const startServer = ({
        beforeMiddleware = (ctx, next) => next(),
        afterMiddleware = (ctx, next) => next(),
        request = () => {},
        config
    }) => (
        ethicalServer()
        .use(beforeMiddleware)
        .use(moduleCapturerMiddleware(config))
        .use(afterMiddleware)
        .listen()
        .then(destroy => {
            destroyServer = destroy
            return request()
        })
    )

    beforeEach(() => {
        destroyServer = () => Promise.resolve()
    })

    afterEach(() => destroyServer())

    it('should capture modules', () => {
        const request = async () => {
            const entry = '~/test/files/dist/a.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).to.deep.equal(data)
        }
        return startServer({ request })
    })
    it('should capture modules with exclusions', () => {
        const request = async () => {
            const entry = '~/test/files/dist/a.js'
            const url = `${host}/module?entry=${entry}&exclude=1`
            const response = await fetch(url)
            const body = await response.json()
            expect(body.modules)
            .to.deep.equal([ data.modules[0], data.modules[6] ])
        }
        return startServer({ request })
    })
    it('should console error and return empty array when module is missing', () => {
        const consoleError = console.error
        console.error = e => {
            const error = 'ENOENT: no such file or directory'
            expect(e.message.startsWith(error)).to.deep.equal(true)
            console.error = consoleError
        }
        const request = async () => {
            const entry = '~/test/files/dist/noop.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).to.deep.equal({
                browserMap: {},
                conflictMap: {},
                modules: []
            })
        }
        return startServer({ request })
    })
    it('should console error and return empty array when module is problematic', () => {
        const consoleError = console.error
        console.error = e => {
            expect(e.message).to.deep.equal('SomeProblematicVariable is not defined')
            console.error = consoleError
        }
        const request = async () => {
            const entry = '~/test/files/dist/problematic.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).to.deep.equal({
                browserMap: {},
                conflictMap: {},
                modules: [{
                    id: 7,
                    key: "~/test/files/dist/problematic.js",
                    source: "'use strict';\n\nSomeProblematicVariable = 'Hello';"
                }]
            })
        }
        return startServer({ request })
    })
    it('should capture main module if entry is omitted', () => {
        const modules = [{
            id: 8,
            key: '~',
            source: '"use strict";',
            alias: '~/test/files/dist/main.js'
        }]
        const request = async () => {
            const url = `${host}/module`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).to.deep.equal({
                browserMap: {},
                conflictMap: {},
                modules
            })
        }
        const config = { main: 'test/files/dist/main.js' }
        return startServer({ request, config })
    })
    it('should accept a custom endpoint path', () => {
        const modules = [{
            id: 8,
            key: '~',
            source: '"use strict";',
            alias: '~/test/files/dist/main.js'
        }]
        const request = async () => {
            const url = `${host}/custom`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).to.deep.equal({
                browserMap: {},
                conflictMap: {},
                modules
            })
        }
        const config = { main: 'test/files/dist/main.js', path: 'custom' }
        return startServer({ request, config })
    })
    it('should capture modules with version conflicts', () => {
        const data = {
            "browserMap": {},
            "conflictMap": {
                "ethical-noop-module-conflict": {
                    "ethical-noop-module-conflict-sub": "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/index.js"
                },
                "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub": {
                    "ethical-noop-module-conflict": "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/node_modules/ethical-noop-module-conflict/index.js"
                },
                "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/node_modules/ethical-noop-module-conflict": {
                    "ethical-noop-module-conflict-sub": "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/node_modules/ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/index.js"
                }
            },
            "modules": [
                {
                    "id": 9,
                    "key": "~/test/files/dist/conflict.js",
                    "source": "'use strict';\n\nrequire('ethical-noop-module-conflict');"
                },
                {
                    "id": 10,
                    "key": "ethical-noop-module-conflict",
                    "alias": "ethical-noop-module-conflict/index.js",
                    "source": "module.exports = require('ethical-noop-module-conflict-sub')\n"
                },
                {
                    "id": 11,
                    "key": "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/index.js",
                    "source": "module.exports = require('ethical-noop-module-conflict')\n"
                },
                {
                    "id": 12,
                    "key": "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/node_modules/ethical-noop-module-conflict/index.js",
                    "source": "module.exports = require('ethical-noop-module-conflict-sub')\n"
                },
                {
                    "id": 13,
                    "key": "ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/node_modules/ethical-noop-module-conflict/node_modules/ethical-noop-module-conflict-sub/index.js",
                    "source": "module.exports = 'Bottom of the rabbit hole!'\n"
                }
            ]
        }
        const request = async () => {
            const entry = '~/test/files/dist/conflict.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).to.deep.equal(data)
        }
        return startServer({ request })
    })
    it('should do nothing', () => {
        const body = 'Hello!'
        const beforeMiddleware = async (ctx, next) => {
            ctx.body = body
            await next()
        }
        const request = async () => {
            const entry = '~/test/files/dist/a.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const text = await response.text()
            expect(text).to.deep.equal(body)
        }
        return startServer({ request, beforeMiddleware })
    })

    it('should do nothing when path is irrelevant', () => {
        const body = 'Hello!'
        const afterMiddleware = async (ctx, next) => {
            ctx.body = body
            await next()
        }
        const request = async () => {
            const entry = '~/test/files/dist/a.js'
            const url = `${host}/noop`
            const response = await fetch(url)
            const text = await response.text()
            expect(text).to.deep.equal(body)
        }
        return startServer({ request, afterMiddleware })
    })
})
