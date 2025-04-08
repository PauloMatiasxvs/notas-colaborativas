const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const SENHA_CORRETA = 'senha123';
let notas = []; // Armazena as notas em memória (temporário)

io.on('connection', (socket) => {
  socket.on('autenticar', (senha) => {
    if (senha === SENHA_CORRETA) {
      socket.autenticado = true;
      socket.emit('atualizarNotas', notas);
    } else {
      socket.emit('authErro', 'Senha incorreta');
    }
  });

  socket.on('editarNotas', (novasNotas) => {
    if (!socket.autenticado) {
      socket.emit('authErro', 'Você precisa se autenticar');
      return;
    }
    notas = novasNotas; // Atualiza o array de notas
    socket.broadcast.emit('atualizarNotas', notas); // Sincroniza com outros usuários
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});