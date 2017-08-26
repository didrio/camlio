const express = require("express");
const app = express();
const socket = require("socket.io");
const server = app.listen(80, () => {console.log("server connected")});
const io = socket(server);

app.use(express.static("./public"));

io.on("connection", socket => {

    socket.on('create or join', function() {
      socket.emit("clientCount", io.engine.clientsCount);
      const rooms = io.sockets.adapter.rooms;
      for (id in rooms) {
        if (rooms[id].length === 1 && id !== socket.id) {
          socket.join(id);
          socket.leave(socket.id);
          socket.roomNumber = id;
          socket.emit('joined');
          io.to(id).emit('join');
          socket.broadcast.to(id).emit('created');
          break;
        } else {
          socket.roomNumber = socket.id;
        }
      }
    });

    socket.on('message', function(message) {
      socket.broadcast.to(socket.roomNumber).emit('message', message);
    });

    socket.on("text", data => {
      socket.broadcast.to(socket.roomNumber).emit("textFrom", data);
    });

    socket.on('bye', function(){
      console.log('received bye');
    });

    socket.on('disconnect', data => {
      io.to(socket.roomNumber).emit("userDisconnected");
    });
});
