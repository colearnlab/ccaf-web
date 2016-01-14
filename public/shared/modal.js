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
          m('span.xmark', m.trust(args.dismissable ? "&#x2716;" : "")),
          m('span', m.trust(args.text)),
          m('div.close-text', args.dismissable ? "Tap to close" : "")
        ]);
        
      else return m('span');
    }
  }
  
  clientUtil.css('/shared/modal.css', true);
  
  exports.display = function(text, args) {
    var container;
    if ((container = document.getElementById('modal-container')) === null) {
      container = document.createElement('div');
      container.id = 'modal-container';
      document.body.appendChild(container)
    }
    
    m.mount(container, m.component(modal, _.extend(args, {'text': text})));
  };
  
});