requirejs.config({
  'paths': {
    'interact': '/lib/interact',
    'mithril': '/lib/mithril',
    'checkerboard': '/lib/checkerboard',
    'underscore': '/lib/underscore',
    'pdf': '/lib/pdf',
    'jquery': '/lib/jquery',
    'bootstrap': '/lib/bootstrap',
    "models": "/shared/models"
  },
  'shim': {
    'underscore': {
      'exports': '_'
    },
    'pdf': {
      'exports': 'PDFJS'
    },
    'bootstrap': {
      deps: ["jquery"]
    }
  }
});
