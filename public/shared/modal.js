define('modal', ['exports', 'mithril', 'clientUtil', 'underscore'], function(exports, m, clientUtil, _) {  
  var modal = {
    'controller': function(args) {
      return {
        'display': m.prop(args.display || true)
      };
    },
    'view': function(ctrl, args) {
      if (ctrl.display())
        return m('div#modal', {
          'onclick': function(e) {
            if (args.dismissable)
              ctrl.display(false);
          }
        }, [
          m('span.xmark', m.trust(args.dismissable ? "x" : "")),
          m('span', m.trust(args.text)),
          m('div.close-text', args.dismissable ? "Tap to close" : "")
        ]);
        
      else return m('span');
    }
  }
  
  clientUtil.css('/shared/modal.css', true);
  
  // configuration options:
  // - dismissable [true]: if false, user cannot exit out of modal.
  exports.display = function(text, config) {
    var container;
    if ((container = document.getElementById('modal-container')) === null) {
      container = document.createElement('div');
      container.id = 'modal-container';
      document.body.appendChild(container)
    }
    
    if (!config)
      config = {};
    _.defaults(config, {
      'dismissable': true
    });
    m.mount(container, m.component(modal, _.extend(config, {'text': text})));
  };
  
  exports.close = function() {
    var el = document.getElementById('modal-container');
    if (!el) return;
    el.parentNode.removeChild(el);
  };
});