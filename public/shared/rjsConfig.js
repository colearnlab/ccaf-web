requirejs.config({
  'paths': {
    'interact': '/lib/interact',
    'mithril': '/lib/mithril',
    'underscore': '/lib/underscore',
    'pdfjs-dist/build/pdf.combined': '/lib/pdf',
    'jquery': '/lib/jquery',
    'bootstrap': '/lib/bootstrap',
    "typeahead": "/lib/bootstrap3-typeahead",

    "models": "/shared/models",
    "userPicker": "/shared/userPicker",
    "css": "/shared/css",
    "synchronizedStateClient": "/shared/synchronizedStateClient",
    "multicast": "/shared/multicast"
  },
  'shim': {
    'underscore': {
      'exports': '_'
    },
    'bootstrap': {
      deps: ["jquery"]
    },
    "bootstrap3-typeahead": {
      deps: ["jquery", "bootstrap"]
    }
  }
});
