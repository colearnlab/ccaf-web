var WebSocket = require("ws");
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var fs = require("fs");
var path = require("path");
var async = require("async");
var stream = require("stream");
var zlib = require("zlib");

module.exports.server = function(port, dir, verifyClient) {
  return new Server(port, dir, verifyClient);
};

function Server(server, dir, verifyClient) {
  this.dir = dir;
  try {
    fs.mkdirSync(dir);
  } catch(e) {

  }

  this.connections = [];

  this.gzips = {};
  this.readStreams = {};
  this.streams = {};
  this.stores = {};
  this.subscriptions = {};

  this.server = new WebSocket.Server({
    server: server,
    perMessageDeflate: false,
    path: "/ws"
  });

  this.server.on("connection", (function(ws) {
    var connection = new Connection(ws);

    verifyClient(ws.upgradeReq, (function(verified, user) {
      if (!verified) {
        ws.close();
        return;
      }

      connection.user = user;

      connection.on("message", this.processReceive.bind(this));
      ws.on("close", (function() {
        if (typeof connection.storeId !== "undefined" && connection.storeId in this.subscriptions) {
          this.subscriptions[connection.storeId].splice(this.subscriptions[connection.storeId].indexOf(connection), 1);
          this.handleSubscriptionUpdate(connection.storeId);
        }
        this.connections.splice(this.connections.indexOf(connection), 1);
      }).bind(this));
      this.connections.push(connection);
    }).bind(this));


  }).bind(this));

  EventEmitter.call(this);
}

Server.prototype.handleSubscriptionUpdate = function(storeId) {
  if (!(storeId in this.subscriptions))
    return;

  var addedUsers = {};
  var users = [];
  for (var i = 0; i < this.subscriptions[storeId].length; i++) {
    if (addedUsers[this.subscriptions[storeId][i].user.id])
      continue;

    var toAdd = this.subscriptions[storeId][i].user;
    users.push(toAdd);
    addedUsers[toAdd.id] = true;
  }

  this.subscriptions[storeId].forEach(function(connection) {
    connection.send("connected-users", {
      users: users
    });
  });
};

Server.prototype.processReceive = function(connection, envelope) {
  var channel = envelope.channel,
      message = envelope.message;

  switch(channel) {
    case "sync":
      var id = message;

      if (typeof connection.storeId !==  "undefined") {
        var indexOfConnection = this.subscriptions[connection.storeId].indexOf(connection);
        this.subscriptions[connection.storeId].splice(indexOfConnection, 1);
        this.handleSubscriptionUpdate(connection.storeId);
      }

      if (!(id in this.subscriptions)) {
        this.stores[id] = {};

        this.subscriptions[id] = [];
        this.readStreams[id] = new stream.Readable();
        this.readStreams[id]._read = function(){};

        this.gzips[id] = zlib.createGzip();

        if (fs.existsSync(path.resolve(path.resolve(this.dir, id + "")))) {
          var rs = fs.createReadStream(path.resolve(this.dir, id + ""));
          var writestream = new stream.Writable();
          var leftovers = "";
          writestream._write = (function(chunk, encoding, done) {
            var nextUpdates = (leftovers + chunk.toString()).split("\n");
            leftovers = nextUpdates.pop();
            for (var i = 0; i < nextUpdates.length; i++) {
              var cur = JSON.parse(nextUpdates[i]);
              for (var p in cur.updates) {
                var curPath = p.split(".");
                getByPath(this.stores[id], curPath.slice(0, -1))[curPath.pop()] = cur.updates[p];
              }
            }
            done();
          }).bind(this);

          writestream.on("finish", (function() {

            console.timeEnd("gunzip");
            this.streams[id] = fs.createWriteStream(path.resolve(this.dir, id + ""), {
              flags: "a",
              encoding: "utf8"
            });
            this.readStreams[id].pipe(this.gzips[id]).pipe(this.streams[id]);
            this.readStreams[id].push(" ");

            connection.send("set-store", {
              storeId: id,
              store: this.stores[id]
            });
          }).bind(this));
          var gunzip = zlib.createGunzip();
          rs.on("end", function() {
            console.log("end");
            gunzip.flush();
          });
          console.time("gunzip");
          rs.pipe(gunzip).pipe(writestream);
        } else {
          this.streams[id] = fs.createWriteStream(path.resolve(this.dir, id + ""), {
            flags: "a",
            encoding: "utf8"
          });
          this.readStreams[id].pipe(this.gzips[id]).pipe(this.streams[id]);
          this.readStreams[id].push(" ");

          connection.send("set-store", {
            storeId: id,
            store: this.stores[id]
          });
        }
      } else {
        this.streams[id] = fs.createWriteStream(path.resolve(this.dir, id + ""), {
          flags: "a",
          encoding: "utf8"
        });
        this.readStreams[id].pipe(this.gzips[id]).pipe(this.streams[id]);
        this.readStreams[id].push(" ");

        connection.send("set-store", {
          storeId: id,
          store: this.stores[id]
        });
      }

      this.subscriptions[id].push(connection);
      connection.storeId = id;
      this.handleSubscriptionUpdate(connection.storeId);
      break;
    case "transaction":
      var store = this.stores[connection.storeId];
      if (connection.storeId !== message.storeId)
        return;

      var p, curPath, updates;
      console.log(message.seq, connection.transactionSeq);
      if (message.seq != connection.transactionSeq) {
        updates = {};
        for (p in message.versions) {
          curPath = p.split(".");
          updates[p] = getByPath(store, curPath);
        }
        connection.send("transaction-failure", {
          seq: message.seq,
          updates: updates
        });

        return;
      }

      for (p in message.versions) {
        curPath = p.split(".");
        if ((getByPath(store, curPath)._id || 0) !== message.versions[p]) {
          updates = {};
          for (p in message.versions) {
            curPath = p.split(".");
            updates[p] = getByPath(store, curPath);
          }

          connection.send("transaction-failure", {
            seq: message.seq,
            updates: updates
          });

          return;
        }
      }

      for (p in message.updates) {
        curPath = p.split(".");
        getByPath(store, curPath.slice(0, -1))[curPath.pop()] = message.updates[p];
      }

      this.subscriptions[message.storeId].forEach(function(subscription) {
        if (subscription === connection)
          return;

        subscription.send("updates", {
          storeId: message.storeId,
          updates: message.updates
        });
      });

      this.readStreams[message.storeId].push(JSON.stringify({time: + new Date(), updates:  message.updates}) + "\n");

      connection.transactionSeq += 1;
      connection.send("transaction-success", {
        seq: message.seq
      });

      break;
  }
};

Server.prototype.close = function(callback) {
  var waitingFor = Object.keys(this.gzips).length;
  var handler = function() {
    if (--waitingFor === 0)
      callback();
  };

  if (!waitingFor)
    callback();

  for (var p in this.gzips) {
    this.readStreams[p].push(null);
    this.gzips[p].flush();
    this.streams[p].on("finish", handler);
  }
};

function getByPath(obj, curPath) {
  if (curPath.length === 0)
    return obj;

  if (!(curPath[0] in obj))
    obj[curPath[0]] = {};

  var next = obj[curPath[0]];

  return getByPath(next, curPath.slice(1));
}

function Connection(ws) {
  for (var p in this.defaults)
    this[p] = this.defaults[p];

  this.ws = ws;

  this.transactionSeq = 0;

  this.sendSeqToTimeoutId = {};
  this.sendSeq = 0;

  this.receiveQueue = [];
  this.receiveSeq = 0;

  this.ws.on("message", this.receive.bind(this));

  EventEmitter.call(this);
}

inherits(Connection, EventEmitter);

Connection.prototype.defaults = {
  timeout: 1000
};

Connection.prototype.send = function(channel, message, seq) {
  seq = (typeof seq !== "undefined" ? seq : this.sendSeq++);

  if (this.ws.readyState !== 1)
    return;

  try {
    this.ws.send(JSON.stringify(new Envelope(channel, message, seq)), function(err) {
      if (err) {
        console.log("WebSocket improperly closed?");
      }
    });
  } catch (e) {
    console.log("Send error.");
  }

  this.sendSeqToTimeoutId[seq] = setTimeout((function() {
    this.send(channel, message, seq);
  }).bind(this), this.timeout);
};

Connection.prototype.receive = function(json) {
  var data = JSON.parse(json);
  var envelope = new Envelope(data.channel, data.message, data.seq);

  if (envelope.channel === "ack") {
    clearTimeout(this.sendSeqToTimeoutId[envelope.seq]);
    delete this.sendSeqToTimeoutId[envelope.seq];
  } else if (envelope.seq >= this.receiveSeq) {
    this.ws.send(JSON.stringify(new Ack(envelope.seq)));

    this.receiveQueue.push(envelope);
    this.receiveQueue.sort(function(a, b) {
      return a.seq - b.seq;
    });

    while (this.receiveQueue.length > 0 && this.receiveSeq === this.receiveQueue[0].seq) {
      this.receiveSeq++;
      this.emit("message", this, this.receiveQueue.shift());
    }
  }
};

function Envelope(channel, message, seq) {
  this.channel = channel;
  this.message = message;
  this.seq = seq;
}

function Ack(seq) {
  this.channel = "ack";
  this.seq = seq;
}
