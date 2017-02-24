var EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits;

//  Connection class. A simple wrapper for a WebSocket connection that handles
//  things like making sure messages are delivered in order, retrying messages
//  that fail, sending acks on received messages.
function Connection(rawConnection) {
  //  Load default parameters.
  for (var p in this.defaults)
    this[p] = this.defaults[p];

  this.rawConnection = rawConnection;

  //  Sequence number for sending messages.
  this.sendSeq = 0;

  //  Sent messages have a timeout; when the timeout is reached they are sent
  //  again. The setTimeout function returns an id that can be used to cancel
  //  the timeout. So, associate sequence numbers with those ids so when an ack
  //  is received the timeout can be cancelled.
  this.sendSeqToTimeoutId = {};

  //  Sequence number for receiving messages, i.e. the next message is expected
  //  to have this number.
  this.receiveSeq = 0;

  //  Queue to save messages if they are received out of order.
  this.receiveQueue = [];

  //  Handle message events with the receive method.
  this.rawConnection.on("message", this.receive.bind(this));

  //  Call super constructor.
  EventEmitter.call(this);
}

//  Act as an event emitter so message events can be created for the other
// modules to listen to
inherits(Connection, EventEmitter);

Connection.prototype.defaults = {
  timeout: 1000 // How many ms to wait before retrying a message.
};

//  Send a message.
Connection.prototype.send = function(channel, message, seq) {
  //  If the message is being resent after failing to be delivered, the seq parameter
  //  will be set. Otherwise, assign and increment.
  seq = (typeof seq !== "undefined" ? seq : this.sendSeq++);

  //  For some reason a message is being sent to a closed connection, so ignore.
  if (this.rawConnection.readyState !== 1)
    return;

  //  Send errors can be ignored, it probably means that the WebSocket has closed
  //  and the associated event handler has not been invoked yet.
  try {
    this.rawConnection.send(JSON.stringify(new Envelope(channel, message, seq)), function(err) {
      if (err) {
        console.log("WebSocket improperly closed?");
      }
    });
  } catch (e) {
    console.log("Send error.");
  }

  //  Set a timeout to retry the message if an ack is not received.
  this.sendSeqToTimeoutId[seq] = setTimeout((function() {
    this.send(channel, message, seq);
  }).bind(this), this.timeout);
};

//  Handle a message receive.
Connection.prototype.receive = function(json) {
  var data = JSON.parse(json);
  var envelope = new Envelope(data.channel, data.message, data.seq);

  //  If the message is an ack, need to abort the resend.
  if (envelope.channel === "ack") {
    clearTimeout(this.sendSeqToTimeoutId[envelope.seq]);
    delete this.sendSeqToTimeoutId[envelope.seq];
  } else {
    //  Message is not an ack. Send an ack to the client
    this.rawConnection.send(JSON.stringify(new Ack(envelope.seq)));

    //  Add the message to the queue and sort it ascending by sequence number.
    this.receiveQueue.push(envelope);
    this.receiveQueue.sort(function(a, b) {
      return a.seq - b.seq;
    });

    //  Process the queue, delivering messages in order (or abort and wait for
    //  more messages if next message is not present.
    while (this.receiveQueue.length > 0) {
      if (this.receiveSeq === this.receiveQueue[0].seq) {
        this.receiveSeq++;
        this.emit("message", this, this.receiveQueue.shift());
      } else if (this.receiveQueue[0].seq < this.receiveSeq) {
        this.receiveQueue.shift();
      } else {
        break;
      }
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

exports.Connection = Connection;
