const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let notas = ''; // Armazena as anotações em memória

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  // Envia as notas atuais para o novo usuário
  socket.emit('atualizarNotas', notas);
  
  // Quando receber uma atualização de notas
  socket.on('editarNotas', (novasNotas) => {
    notas = novasNotas;
    // Envia para todos os conectados
    socket.broadcast.emit('atualizarNotas', notas);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});