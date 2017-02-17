define(["exports", "synchronizedStateClient"], function(exports, synchronizedStateClient) {
  var MAX_LENGTH = 15;

  exports.connect = function(url, realm) {
    return new Multicast(url, realm);
  };

  var Multicast = function(url, realm) {
    var that = this;

    this.initialUpdateHandled = false;
    this.subscriptions = {};
    this.MAX_LENGTH = MAX_LENGTH;
    this.remoteSeqs = {};
    this.seq = 0;

    this.connection = synchronizedStateClient.connect(url, function() {
      this.addObserver(function(store) {
        var multicasts = store.multicasts;

        var i;
        if (!that.initialUpdateHandled) {
          that.initialUpdateHandled = true;

          if (multicasts) {
            for (i = 0; i < that.connection.array.length(multicasts); i++) {
              that.remoteSeqs[multicasts[i].uuid] = multicasts[i].seq;
            }
          }

          that.connection.transaction([["uuid"]], function(uuid) {
            that.uuid = uuid.cur = (uuid.cur || 0) + 1;
          });

          return;
        }

        if (!multicasts)
          return;

        for (i = 0; i < that.connection.array.length(multicasts); i++) {
          var curMulticast = multicasts[i];
          if (curMulticast.uuid === that.uuid)
            continue;
          else if (curMulticast.uuid in that.remoteSeqs && curMulticast.seq <= that.remoteSeqs[curMulticast.uuid])
            continue;

          that.remoteSeqs[curMulticast.uuid] = curMulticast.seq;

          if (curMulticast.channel in that.subscriptions)
            for (var j = 0; j < that.subscriptions[curMulticast.channel].length; j++)
              that.subscriptions[curMulticast.channel][j](curMulticast.message);
        }
      });

      this.sync(realm);
    });
  };

  Multicast.prototype.subscribe = function(channel, callback) {
    if (!(channel in this.subscriptions))
      this.subscriptions[channel] = [];

    this.subscriptions[channel].push(callback);
  };

  Multicast.prototype.unsubscribe = function(channel, callback) {
    if (typeof callback === "undefined" || !(channel in this.subscriptions)) {
      delete this.subscriptions[channel];
      return;
    }

    var idx = this.subscriptions[channel].indexOf(callback);
    this.subscriptions[channel].splice(idx, 1);
  };

  Multicast.prototype.send = function(channel, message) {
    var that = this;
    this.connection.transaction([["multicasts"]], function(multicasts) {
      var len = that.connection.array.length(multicasts);

      if (len > that.MAX_LENGTH) {
        that.connection.array.splice(multicasts, len - that.MAX_LENGTH);
      }

      that.connection.array.push(multicasts, {
        channel: channel,
        message: message,
        uuid: that.uuid,
        seq: that.seq++
      });
    });
  };
});
