const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: '*' }, // Permite conexões de qualquer origem
  path: '/socket.io', // Caminho explícito para Socket.IO
  transports: ['websocket', 'polling'] // Suporte a WebSocket com fallback
});

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  console.log('Requisição GET para /');
  res.sendFile(__dirname + '/public/index.html');
});

const SENHA_CORRETA = 'senha123';
let notas = [];

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  socket.on('autenticar', (senha) => {
    console.log('Tentativa de autenticação com senha:', senha);
    if (senha === SENHA_CORRETA) {
      socket.autenticado = true;
      console.log('Autenticação bem-sucedida para', socket.id);
      socket.emit('atualizarNotas', notas);
    } else {
      console.log('Senha incorreta para', socket.id);
      socket.emit('authErro', 'Senha incorreta');
    }
  });

  socket.on('editarNotas', (novasNotas) => {
    if (!socket.autenticado) {
      console.log('Cliente não autenticado tentou editar notas:', socket.id);
      socket.emit('authErro', 'Você precisa se autenticar');
      return;
    }
    console.log('Notas atualizadas por', socket.id, ':', novasNotas);
    notas = novasNotas;
    socket.broadcast.emit('atualizarNotas', notas);
    socket.emit('atualizarNotas', notas);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});