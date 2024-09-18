const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);

// Crear una instancia de Socket.io y pasar el servidor HTTP
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
  },
});


// Clase del Alert (Mediator)
class AlertMediator {
  constructor() {
    this.users = [];
    this.receptores = [];
  }

  addUser(user) {
    this.users.push(user);
  }

  // Método para enviar alertas de reporte cargado
  sendReporteCargado(sender,data) {
    this.receptores=[]
    this.users.forEach((user) => {
      if (user.username !== sender) {
        this.receptores.push(user)
        const mensajeParaReceptor = `${sender}, ${data}`;
        io.to(user.username).emit("reporte-cargado", mensajeParaReceptor);
      }
    });

    const nombresReceptores = this.receptores.map(user => user.username).join(", ");

    let newData = '';
    if (nombresReceptores.length !== 0) {
      newData = `${sender}, ${data}, y se le notifico a los usuarios: ${nombresReceptores}`;
    } else {
      newData = `${sender}, ${data}`;
    }

    io.to(sender).emit("reporte-cargado", newData);
  }

  // Método para enviar alertas de reporte eliminado
  sendReporteEliminado(sender,data) {
    this.receptores=[]
    const fecha = new Date(data.data.fecha);
    const formattedDate = `${fecha.getMonth() + 1}/${fecha.getFullYear()}`; // Los meses van de 0 a 11, así que añadimos +1

    this.users.forEach((user) => {
      if (user.username !== sender) {
        this.receptores.push(user)
        const mensajeParaReceptor = `${sender}, ${data.message}, ${formattedDate}`;
        io.to(user.username).emit("reporte-eliminado", mensajeParaReceptor);
      }
    });

    const nombresReceptores = this.receptores.map(user => user.username).join(", ");

    let newData = '';
    if (nombresReceptores.length !== 0) {
      newData = `${sender}, ${data.message}, ${formattedDate}, y se le notifico a los usuarios: ${nombresReceptores}`;
    } else {
      newData = `${sender}, ${data.message}, ${formattedDate}`;
    }
    io.to(sender).emit("reporte-eliminado", newData);
  }
}

const alertMediator = new AlertMediator();
const connectedUsers = new Set(); 

// Configurar eventos de Socket.io
io.on("connection", (socket) => {

  // Agregar usuario al Mediator cuando se conecta
  socket.on("login", (name) => {
    socket.join(`${name}`); 
   
    const user = {
      id: socket.id,
      username: name
    }
   
    console.log('Usuario Conectado:')
    console.log(user)
    alertMediator.addUser(user,socket)
    connectedUsers.add(name);
    
    // Enviamos la lista de usuarios conectados a todos los clientes
    io.emit("usuarios-conectados", Array.from(connectedUsers));
  });

  socket.on("reporte-cargado", (sender,data) => {
    alertMediator.sendReporteCargado(sender,data);
  });

  socket.on("reporte-eliminado", (sender,data) => {
    alertMediator.sendReporteEliminado(sender,data);
  });

  // Desconexión del usuario
  socket.on("disconnect", () => {
    const index = alertMediator.users.findIndex(user => user.id === socket.id);
    if (index !== -1) {
      console.log("Usuario desconectado:", alertMediator.users[index].username);
      connectedUsers.delete(alertMediator.users[index].username);
      alertMediator.users.splice(index, 1);
    }
      // Enviamos la lista actualizada de usuarios conectados a todos los clientes
    io.emit("usuarios-conectados", Array.from(connectedUsers));
  });
});


app.get("/", (res) => {
  res.send("Servicio Alertas UP");
});


const port = process.env.PORT || 2000;
server.listen(port, () => {
  console.log(`Servicio escuchando en el puerto ${port}`);
});