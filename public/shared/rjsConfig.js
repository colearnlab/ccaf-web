requirejs.config({
  'paths': {
    'interact': '/lib/interact',
    'mithril': '/lib/mithril',
    'checkerboard': '/lib/checkerboard',
    'underscore': '/lib/underscore',
    'pdf': '/lib/pdf',
    'jquery': '/lib/jquery',
    'bootstrap': '/lib/bootstrap',
    "typeahead": "/lib/bootstrap3-typeahead",

    "models": "/shared/models",
    "userPicker": "/shared/userPicker",
    "css": "/shared/css"
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
    },
    "bootstrap3-typeahead": {
      deps: ["jquery", "bootstrap"]
    }
  }
});
