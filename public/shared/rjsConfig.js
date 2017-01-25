requirejs.config({
  'paths': {
    'interact': '/lib/interact',
    'mithril': '/lib/mithril',
    'checkerboard': '/lib/checkerboard',
    'cookies': '/shared/cookies',
    'clientUtil': '/shared/clientUtil',
    'pinLock': '/shared/pinLock',
    'modal': '/shared/modal',
    'login': '/shared/login',
    'configurationActions': '/shared/configurationActions',
    'autoconnect': '/shared/autoconnect',
    'underscore': '/lib/underscore',
    'loginHelper': '/shared/loginHelper',
    'pdfjs': '/lib/pdf',
    'fileManager': '/shared/fileManager',
    'jquery': '/lib/jquery',
    'bootstrap': '/lib/bootstrap'
  },
  'shim': {
    'underscore': {
      'exports': '_'
    },
    'pdfjs': {
      'exports': 'PDFJS'
    },
    'bootstrap': {
      deps: ["jquery"]
    }
  }
});