define('fileManager', ['exports'], function(exports) {
  exports.upload = function(path, fileAsArray, callback) {
    $.ajax({
      'type': 'POST',
      'url': '/upload',
      'data': {
        'path': path,
        'contents': fileAsArray,
        'success': callback ? callback.bind(false) : function(){},
        'error': callback ? callback.bind(true) : function(){}
      }
    });
  }
});
