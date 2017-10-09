import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import ethicalServer from 'ethical-utility-server'
import moduleCapturerMiddleware from '../../src/index.js'

const startServer = ({
    beforeMiddleware = (ctx, next) => next(),
    afterMiddleware = (ctx, next) => next(),
    request = () => {},
    config = {}
}) => (
    ethicalServer()
    .use(beforeMiddleware)
    .use(moduleCapturerMiddleware(config))
    .use(afterMiddleware)
    .listen()
    .then(destroyServer => {
        return new Promise(async resolve => {
            await request()
            resolve(destroyServer)
        })
    })
    .then(destroyServer => destroyServer())
)

const host = 'http://localhost:8080'
const data = [{
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
        source: 'module.exports = \'Browser chain works!\'\n'
    },
    {
        id: 4,
        key: '~/test/files/dist/c.js',
        source: '\'use strict\';\n\nrequire(\'ethical-noop-module-browser\');\n\nrequire(\'ethical-noop-module-browser/relative.js\');'
    },
    {
        id: 5,
        key: 'ethical-noop-module-browser/relative.js',
        source: 'module.exports = \'Relative!\'\n'
    },
    {
        id: 6,
        key: 'test/files/css/file.css',
        source: 'module.exports = \'"css"\''
    }
]

describe('moduleCapturerMiddleware()', () => {
    it('should capture modules', (done) => {
        const request = async () => {
            const entry = '~/test/files/dist/a.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).toEqual(data)
        }
        startServer({ request })
        .then(done)
        .catch(e => console.error(e))
    })
    it('should capture modules with exclusions', (done) => {
        const request = async () => {
            const entry = '~/test/files/dist/a.js'
            const url = `${host}/module?entry=${entry}&exclude=1`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).toEqual([ data[0], data[6] ])
        }
        startServer({ request })
        .then(done)
        .catch(e => console.error(e))
    })
    it('should console error and return empty array when module is missing', (done) => {
        const consoleError = console.error
        console.error = e => {
            const error = 'ENOENT: no such file or directory'
            expect(e.message.startsWith(error)).toBe(true)
            console.error = consoleError
        }
        const request = async () => {
            const entry = '~/test/files/dist/noop.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).toEqual([])
        }
        startServer({ request })
        .then(done)
        .catch(e => console.error(e))
    })
    it('should console error and return empty array when module is problematic', (done) => {
        const consoleError = console.error
        console.error = e => {
            expect(e.message).toBe('SomeProblematicVariable is not defined')
            console.error = consoleError
        }
        const request = async () => {
            const entry = '~/test/files/dist/problematic.js'
            const url = `${host}/module?entry=${entry}`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).toEqual([{
                id: 7,
                key: "~/test/files/dist/problematic.js",
                source: "'use strict';\n\nSomeProblematicVariable = 'Hello';"
            }])
        }
        startServer({ request })
        .then(done)
        .catch(e => console.error(e))
    })
    it('should capture main module if entry is omitted', (done) => {
        const data = [{
            id: jasmine.any(Number),
            key: '~',
            source: '"use strict";',
            alias: '~/test/files/dist/main.js'
        }]
        const request = async () => {
            const url = `${host}/module`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).toEqual(data)
        }
        const config = { main: 'test/files/dist/main.js' }
        startServer({ request, config })
        .then(done)
        .catch(e => console.error(e))
    })
    it('should accept a custom endpoint path', (done) => {
        const data = [{
            id: jasmine.any(Number),
            key: '~',
            source: '"use strict";',
            alias: '~/test/files/dist/main.js'
        }]
        const request = async () => {
            const url = `${host}/custom`
            const response = await fetch(url)
            const body = await response.json()
            expect(body).toEqual(data)
        }
        const config = { main: 'test/files/dist/main.js', path: 'custom' }
        startServer({ request, config })
        .then(done)
        .catch(e => console.error(e))
    })
    it('should do nothing', (done) => {
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
            expect(text).toEqual(body)
        }
        startServer({ request, beforeMiddleware })
        .then(done)
        .catch(e => console.error(e))
    })

    it('should do nothing when path is irrelevant', (done) => {
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
            expect(text).toEqual(body)
        }
        startServer({ request, afterMiddleware })
        .then(done)
        .catch(e => console.error(e))
    })
})
