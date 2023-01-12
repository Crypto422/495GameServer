const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const ws = require("ws");

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  wsEngine: ws.Server,
});

var sockets = {};

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World');
})

server.listen(PORT, () => {
  console.log(`server started on Port ${PORT}`);
});

io.on("connection", (socket) => {
  console.log(`user ${socket.id} has connected`);
  io.to(socket.id).emit("server_id", socket.id);

  socket.on("join_room", ({ room, name, members }) => {
    if (!socket.room) {
      // const leavename = sockets[socket.room].names.filter((item) => item['id'] === socket.nickname)
      try {
        socket.join(room);
        socket.nickname = name;
        socket.room = room;
        if (!sockets[room]) {
          sockets[room] = {};
          sockets[room].names = [];
          sockets[room].debts = [];
          sockets[room].currentMembers = 0;
          sockets[room].start = false;
          sockets[room].maxMembers = members;
          sockets[room].owner = socket.id;
        }
        sockets[room].names = [...sockets[room].names, { 'id': name, 'nickname': "" }];
        sockets[room].debts = [...sockets[room].debts, { 'id': name, 'debt': 490 }];
        try {
          sockets[room].currentMembers = io.sockets.adapter.rooms.get(room).size;
        } catch (error) {

        }
        io.in(room).emit("max_member", sockets[room].maxMembers);
        io.in(room).emit("player_names", sockets[room].names);
        io.in(room).emit("player_debts", sockets[room].debts);
        io.in(room).emit("room_state", sockets[room].start);
        socket.broadcast.emit('room_list', sockets);
        console.log(`${name} joind room ${room}`);
      } catch (err) {
        console.log(err.message);
      }
    }
  });

  socket.on("request_join_room", ({ room, name }) => {
    try {
      if (sockets[room]) {
        io.to(sockets[room].owner).emit("request_join_room", name, socket.id);
      } else {
        io.to(socket.id).emit("response_join_room_fail", "This room has closed.");
      }

      console.log(`${name} requested joind room ${room}`);
    } catch (err) {
      console.log(err.message);
    }
  });

  socket.on("response_join_room", ({ room, name, approve }) => {
    try {
      if (sockets[room]) {
        if (approve) {
          socket.broadcast.emit("response_join_room", room, name, approve);
        } else {
          socket.broadcast.emit("response_join_room", room, name, approve);
        }
      }
      console.log(`Sent joined response ${approve} to ${name}`);
    } catch (err) {
      console.log(err.message);
    }
  });

  socket.on("leave_room", ({ name, room }) => {
    try {
      socket.leave(room);
      delete socket.room;
      delete socket.nickname;
      if (sockets[room]) {
        const leavename = sockets[room].names.filter((item) => item['id'] === name)
        sockets[room].names = sockets[room].names.filter((item) => item['id'] !== name)
        sockets[room].debts = sockets[room].debts.filter((item) => item['id'] !== name)
        try {
          sockets[room].currentMembers = io.sockets.adapter.rooms.get(room).size;
        } catch (error) {

        }
        try {
          io.in(room).emit("update", `${leavename[0].nickname} has left room ${room}`);
        } catch (error) {
        }
        io.in(room).emit("player_names", sockets[room].names);
        io.in(room).emit("player_debts", sockets[room].debts);
        console.log(`${name} has left ${room}`);
        if (sockets[room].owner === socket.id) {
          delete sockets[room];
          io.in(room).emit("room_closed", room);
          console.log(`Closed room ${room} user ${name}`);
        }
      }

    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("kick_player", ({ name, room }) => {
    try {
      if (sockets[room]) {
        io.in(room).emit("kick_player", name);
        console.log(`${name} has kicked ${room}`);
      }
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("join_lobby", () => {
    try {
      if (sockets) {
        socket.broadcast.emit('room_list', sockets);
        io.to(socket.id).emit("room_list",
          sockets);
        console.log(`send Room list ${sockets}`);
      }
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("ready", ({ room, id, nickname }) => {
    try {
      const names = sockets[room].names.map((item) => {
        if (item.id === id) {
          return { 'id': id, 'nickname': nickname }
        } else {
          return item
        }
      })
      sockets[room].names = [...names]
      io.in(room).emit("player_names", sockets[room].names);
    } catch (err) {
      console.log(err.message);
    }
  });

  socket.on("edit_score", ({ ids, room, debts }) => {
    try {
      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      ids.forEach((id, index) => {
        const newdebts = sockets[room].debts.map((item) => {
          if (item.id === id) {
            return { 'id': id, 'debt': debts[index] }
          } else {
            return item
          }
        })
        sockets[room].debts = [...newdebts]
      });
      io.in(room).emit("edit-score", ids, debts, players);
      io.in(room).emit("player_debts", sockets[room].debts);
      console.log("send edit score info")
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("forgive", ({ ids, room, amounts, debts }) => {
    try {
      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      ids.forEach((id, index) => {
        const newdebts = sockets[room].debts.map((item) => {
          if (item.id === id) {
            return { 'id': id, 'debt': debts[index] }
          } else {
            return item
          }
        })
        sockets[room].debts = [...newdebts]
      })
      io.in(room).emit("forgive", ids, amounts, players);
      io.in(room).emit("player_debts", sockets[room].debts);
      console.log("send forgive info")
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("transgress", ({ from, ids, room, amounts, debts }) => {
    try {
      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      ids.forEach((id, index) => {
        const newdebts = sockets[room].debts.map((item) => {
          if (item.id === id) {
            return { 'id': id, 'debt': debts[index] }
          } else {
            return item
          }
        })
        sockets[room].debts = [...newdebts]
      })
      io.in(room).emit("transgress", from, ids, amounts, players);
      io.in(room).emit("player_debts", sockets[room].debts);
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("start_game", ({ room }) => {
    try {
      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      io.in(room).emit("start_game", players);
      io.in(room).emit("game_players", players);
      io.in(room).emit("player_debts", sockets[room].debts);

      sockets[room].start = true;
      sockets[room]._turn = 0;
      io.in(room).emit(
        "your_turn",
        players,
        players[0].id
      );
      console.log("send Start Info");
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("join_game", ({ room, id }) => {
    try {
      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      const joinname = sockets[room].names.filter((item) => item['id'] === id)
      io.in(room).emit("update", `${joinname[0].nickname} has joined game`);
      io.in(room).emit("game_players", players);
      io.in(room).emit("player_debts", sockets[room].debts);
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("leave_game", ({ name, room }) => {
    try {
      const leavename = sockets[room].names.filter((item) => item['id'] === name)
      sockets[room].names = sockets[room].names.filter((item) => item['id'] !== name)
      if (sockets[room].names.length <= 1) {
        io.in(room).emit("end_game", `There is no other player, so that the game has ended.`);
      } else if (sockets[room].owner === name) {
        io.in(room).emit("end_game", `The Admin has closed this game.`);
      }

      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      io.in(room).emit("game_players", players);
      sockets[room].debts = sockets[room].debts.filter((item) => item['id'] !== name)
      sockets[room].currentMembers = io.sockets.adapter.rooms.get(room).size;
      io.in(room).emit("player_names", sockets[room].names);
      io.in(room).emit("player_debts", sockets[room].debts);

      io.in(room).emit("update", `${leavename[0].nickname} has left game`);
      io.in(room).emit("leave_game", `${nickname} has leaved this game`);
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("success_game", ({ name, room }) => {
    try {
      const leavename = sockets[room].names.filter((item) => item['id'] === name)
      sockets[room].names = sockets[room].names.filter((item) => item['id'] !== name)
      if (sockets[room].names.length <= 1) {
        io.in(room).emit("end_game", `There is no othe player, so that the game has ended.`);
        delete sockets[room];
      } else {
        const players = sockets[room].names.filter((item) => item.nickname.length > 0);
        io.in(room).emit("game_players", players);
        sockets[room].debts = sockets[room].debts.filter((item) => item['id'] !== name)
        sockets[room].currentMembers = io.sockets.adapter.rooms.get(room).size;
        io.in(room).emit("player_names", sockets[room].names);
        io.in(room).emit("player_debts", sockets[room].debts);
      }
      io.in(room).emit("update", `${leavename[0].nickname} has forgived 495 debts`);
      io.in(room).emit("leave_game", `${nickname} has leaved this game`);
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("end_game", ({ room }) => {
    try {
      console.log("game ended");
      io.in(room).emit("end_game", `There is no othe player, so that the game has ended.`);
      delete sockets[room];
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("turn_over", ({ room }) => {
    try {
      const players = sockets[room].names.filter((item) => item.nickname.length > 0);
      sockets[room]._turn =
        (sockets[room]._turn + 1) % players.length;

      io.in(room).emit(
        "your_turn",
        players,
        players[sockets[room]._turn].id
      );
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("disconnect", () => {
    try {
      console.log(`${socket.id} has disconnected`);
      if (socket.room) {
        const leavename = sockets[socket.room].names.filter((item) => item['id'] === socket.nickname)
        sockets[socket.room].names = sockets[socket.room].names.filter((item) => item['id'] !== socket.nickname)
        const players = sockets[socket.room].names.filter((item) => item.nickname.length > 0);
        io.in(socket.room).emit("game_players", players);
        sockets[socket.room].debts = sockets[socket.room].debts.filter((item) => item['id'] !== socket.nickname)
        try {
          sockets[room].currentMembers = io.sockets.adapter.rooms.get(room).size;
        } catch (error) {

        }
        io.in(socket.room).emit("player_names", sockets[socket.room].names);
        io.in(socket.room).emit("player_debts", sockets[socket.room].debts);
        io.in(socket.room).emit("update", `${leavename[0].nickname} has left game`);
        io.in(socket.room).emit("leave_game", `${socket.nickname} has leaved this game`);
      }
    } catch (error) {
      console.log(error.message);
    }
  });
});
