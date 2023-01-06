const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const ws = require("ws");
const path = require('path');


const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  wsEngine: ws.Server,
});

class Debt {
  constructor() {
    this.debt = [];
    this.reset(); //Add 52 cards to the debt
    this.shuffle(); //Suffle the debt
  } //End of constructor

  reset() {
    this.debt = [];
    const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
    const values = ["Ace", 2, 3, 4, 5, 6, 7, 8, 9, 10, "Jack", "Queen", "King"];

    for (let suit in suits) {
      for (let value in values) {
        this.debt.push(values[value] + " of " + suits[suit]);
      }
    }
  } //End of reset()

  shuffle() {
    let numberOfCards = this.debt.length;
    for (var i = 0; i < numberOfCards; i++) {
      let j = Math.floor(Math.random() * numberOfCards);
      let tmp = this.debt[i];
      this.debt[i] = this.debt[j];
      this.debt[j] = tmp;
    }
  } //End of shuffle()

  deal() {
    return this.debt.pop();
  } //End of deal()

  isEmpty() {
    return this.debt.length == 0;
  } //End of isEmpty()

  length() {
    return this.debt.length;
  } //End of length()
} //End of Debt Class

var sockets = {};

let card1, card2, card3, card4, card5;
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

server.listen(PORT, () => {
  console.log(`server started on Port ${PORT}`);
});

io.on("connection", (socket) => {
  console.log(`user ${socket.id} has connected`);
  io.to(socket.id).emit("server_id", socket.id);

  socket.on("join_room", ({ room, name, members }) => {
    try {
      socket.join(room);
      socket.nickname = name;
      socket.room = room;
      if (!sockets[room]) {
        sockets[room] = {};
        sockets[room].names = [];
        sockets[room].maxMembers = 8;
        sockets[room].start = false;
        sockets[room].maxMembers = members;
      }
      sockets[room].names = [...sockets[room].names, { 'id': name, 'nickname': "" }];
      io.in(room).emit("player_count", io.sockets.adapter.rooms.get(room).size);
      io.in(room).emit("max_member", sockets[room].maxMembers);
      io.in(room).emit("player_names", sockets[room].names);
      io.in(room).emit("update", `${name} has joined room ${room}`);
      console.log(`${name} joind room ${room}`);
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
        sockets[room].names = sockets[room].names.filter((item) => item['id'] !== name)
        io.in(room).emit("update", `${name} has left room ${room}`);
        io.in(room).emit(
          "player_count",
          io.sockets.adapter.rooms.get(room).size
        );
        io.in(room).emit("player_names", sockets[room].names);
        console.log(`${name} has left ${room}`);
      }
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("join_lobby", () => {
    try {
      if (sockets) {
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

  socket.on("update", ({ update, room }) => {
    try {
      io.in(room).emit("update", update);
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("click", ({ name, room, send, length }) => {
    try {
      io.in(room).emit("update", { name, send, length });
      sockets[room].opencard = send;
      io.in(room).emit("open_card", sockets[room].opencard);
    } catch (error) {
      console.log(error.message);
    }
  });
  let current_room;

  socket.on("start_game", (room) => {
    try {
      io.in(room).emit("start_game");
      sockets[room].start = true;
      sockets[room].debt = new Debt();
      if (sockets[room].debt.length() < 7) {
        sockets[room].debt.reset();
        sockets[room].debt.shuffle();
      }
      // sockets[room].handvalues = {}

      sockets[room].opencard = sockets[room].debt.deal();

      io.sockets.adapter.rooms.get(room).forEach((player) => {
        card1 = sockets[room].debt.deal();
        card2 = sockets[room].debt.deal();
        card3 = sockets[room].debt.deal();
        card4 = sockets[room].debt.deal();
        card5 = sockets[room].debt.deal();
        // sockets[room][io.sockets.sockets.get(player).nickname] = cardValues[card1] + cardValues[card2] + cardValues[card3] + cardValues[card4] + cardValues[card5];
        let opencard = sockets[room].opencard;
        let cards = [card1, card2, card3, card4, card5];
        let playerNames = sockets[room].names;
        io.to(player).emit("start_variables", { opencard, cards, playerNames });
      });
      // io.in(room).emit('players', sockets[room].names);
      current_room = Array.from(io.sockets.adapter.rooms.get(room));
      sockets[room]._turn = 0;
      io.in(room).emit(
        "your_turn",
        io.sockets.sockets.get(current_room[0]).nickname
      );
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("end_game", (room) => {
    try {
      console.log("game ended");
      io.in(room).emit("end_game", `${socket.nickname} has ended the game`);
      delete sockets[room];
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("turn_over", ({ room, pickedOption }) => {
    try {
      if (pickedOption === "debt") {
        io.to(socket.id).emit("picked_card", sockets[room].debt.deal());
      } else {
        io.to(socket.id).emit("picked_card", sockets[room].opencard);
      }
      sockets[room]._turn =
        (sockets[room]._turn + 1) % io.sockets.adapter.rooms.get(room).size;
      current_room = Array.from(io.sockets.adapter.rooms.get(room));
      io.in(room).emit(
        "your_turn",
        io.sockets.sockets.get(current_room[sockets[room]._turn]).nickname
      );
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("hand_value", ({ handValue, room }) => {
    try {
      if (!sockets[room].handValues) {
        sockets[room].handValues = {};
      }
      sockets[room].handValues[socket.nickname] = handValue;
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("declare", ({ handValue, room }) => {
    try {
      let caught = false;
      for (const [name, value] of Object.entries(sockets[room].handValues)) {
        if (name === socket.nickname) {
          continue;
        }
        if (value <= handValue) {
          caught = true;
        }
      }
      if (caught) {
        socket
          .to(room)
          .emit(
            "declare_result",
            `${socket.nickname} has declared and has been caught`
          );
        io.to(socket.id).emit(
          "declare_result",
          `your have declared and have been caught`
        );
      } else {
        socket
          .to(room)
          .emit(
            "declare_result",
            `${socket.nickname} has declared and has won this round`
          );
        io.to(socket.id).emit(
          "declare_result",
          `your have declared and have won this round`
        );
      }
    } catch (error) {
      console.log(error.message);
    }
  });

  socket.on("disconnect", () => {
    try {
      console.log(`${socket.id} has disconnected`);
      if (!socket.room) {
        return
      }
      console.log(sockets[socket.room].start);
      if (sockets[socket.room].start) {
        io.in(socket.room).emit(
          "end_game",
          `${socket.nickname} has left the game`
        );
        delete sockets[socket.room];
      } else {
        io.in(socket.room).emit(
          "player_count",
          io.sockets.adapter.rooms.get(socket.room).size
        );
        sockets[socket.room].names.splice(
          sockets[socket.room].names.indexOf(socket.nickname)
        );
        io.emit("update", `${socket.nickname} has left`);
      }
    } catch (error) {
      console.log(error.message);
    }
  });
});
