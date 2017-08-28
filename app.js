const express = require("express");
const app = express();
const socket = require("socket.io");
const server = app.listen(3000, () => {console.log("Server Connected")});
const io = socket(server);

app.use(express.static("./public"));

io.on("connection", socket => {

  socket.on("lookForSocket", function() {
    socket.emit("clientCount", io.engine.clientsCount);
    for (s in io.sockets.sockets) {
      const connectedSocket = io.sockets.sockets[s];
      if (!connectedSocket.connectedTo && socket.id !== connectedSocket.id) {
        socket.connectedTo = connectedSocket.id;
        connectedSocket.connectedTo = socket.id;
        io.to(socket.id).emit("joined");
        io.to(socket.connectedTo).emit("joined");
        io.to(socket.connectedTo).emit("created");
        break;
      } else {
        socket.connectedTo = undefined;
      }
    }
  });

  socket.on("handleNew", function() {
    io.to(socket.connectedTo).emit("setup");
  });

  socket.on('message', function(message) {
    socket.broadcast.to(socket.connectedTo).emit('message', message);
  });

});
