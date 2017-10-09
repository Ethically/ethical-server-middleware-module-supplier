var debug = process.env.DEBUG

var reporters = ( debug ? [] : ['nutra-coverage'] )
var srcPreprocessors = ['nutra-babel']
if (!debug) {
    srcPreprocessors.push('nutra-coverage')
}

module.exports = function( config ) {
  config.set({
    frameworks: ['nutra-jasmine'],
    files: ['test/specs/**/*.js', 'src/**/*.js'], // Modify to include your own app & spec files
    preprocessors: {
        'test/specs/**/*.js': ['nutra-babel'], // Modify to include your spec files
        'src/**/*.js': srcPreprocessors // Modify to include your app files
    },
    reporters: reporters,
    babelOptions: {
      configFile: './.babelrc'
      // For more transpiling options, see:
      // https://github.com/m-a-r-c-e-l-i-n-o/nutra-babel
    },
    coverageOptions: {
      reporters: [
        { type: 'html', subdir: '.' }
      ]
      // For more coverage options, see:
      // https://github.com/m-a-r-c-e-l-i-n-o/nutra-coverage
    }
  })
  // For more configuration options, see:
  // https://github.com/m-a-r-c-e-l-i-n-o/nutra#configuration-anatomy
}
