requirejs.config({
  'paths': {
    'interact': '/lib/interact',
    'mithril': '/lib/mithril',
    'underscore': '/lib/underscore',
    'pdfjs-dist/build/pdf.combined': '/lib/pdf',
    'jquery': '/lib/jquery',
    'bootstrap': '/lib/bootstrap',
    "typeahead": "/lib/bootstrap3-typeahead",
    "uuidv1": "/lib/uuidv1",

    "models": "/shared/models",
    "userPicker": "/shared/userPicker",
    "css": "/shared/css",
    "synchronizedStateClient": "/shared/synchronizedStateClient",
    "multicast": "/shared/multicast",
    "userColors": "/shared/userColors"
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
