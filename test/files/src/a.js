import './b.js'

const value = require('test/files/css/file.css')

if (value !== '"css"') {
    throw new Error('CSS is not being properly resolved!')
}
