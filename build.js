var fs = require('fs');
var path = require('path');

// http://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js 
function copy(source, target, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}
// http://stackoverflow.com/questions/13696148/node-js-create-folder-or-use-existing
var mkdirSync = function (path) {
  try {
    fs.mkdirSync(path);
  } catch(e) {
    if ( e.code != 'EEXIST' ) throw e;
  }
}

// set up lib folder
mkdirSync(path.resolve(__dirname, 'public'));
mkdirSync(path.resolve(__dirname, 'public', 'lib'));

// copy dependencies to lib
copy(
  path.resolve(path.dirname(path.dirname(require.resolve('bootstrap'))), 'css', 'bootstrap.css'),
  path.resolve(__dirname, 'public', 'lib', 'bootstrap.css'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied bootstrap 1');
  });
  
  copy(
  path.resolve(path.dirname(path.dirname(require.resolve('bootstrap'))), 'fonts', 'glyphicons-halflings-regular.woff2'),
  path.resolve(__dirname, 'public', 'fonts', 'glyphicons-halflings-regular.woff2'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied bootstrap 2');
  });
  
copy(
  path.resolve(path.dirname(require.resolve('checkerboard')), 'build/out.js'),
  path.resolve(__dirname, 'public', 'lib', 'checkerboard.js'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied checkerboard');
  });
  
copy(
  require.resolve('interact.js'),
  path.resolve(__dirname, 'public', 'lib', 'interact.js'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied interact');
  });
  
copy(
  require.resolve('mithril'),
  path.resolve(__dirname, 'public', 'lib', 'mithril.js'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied mithril');
  });
  
copy(
  path.resolve(path.dirname(path.dirname(require.resolve('requirejs'))), 'require.js'),
  path.resolve(__dirname, 'public', 'lib', 'require.js'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied requirejs');
  });
  
copy(
  require.resolve('underscore'),
  path.resolve(__dirname, 'public', 'lib', 'underscore.js'),
  function(err) {
    if (err) console.error(err);
    else console.log('copied underscore');
  });