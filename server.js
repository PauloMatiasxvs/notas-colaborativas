const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Configuração do banco de dados SQLite
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error(err);
  console.log('Conectado ao SQLite');
});

// Criação da tabela de notas e configuração inicial
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS notas (id INTEGER PRIMARY KEY, conteudo TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, senha_hash TEXT)');
  
  // Configura uma senha padrão (mude isso depois!)
  db.get('SELECT * FROM usuarios', (err, row) => {
    if (!row) {
      bcrypt.hash('senha123', 10, (err, hash) => {
        db.run('INSERT INTO usuarios (senha_hash) VALUES (?)', [hash]);
      });
    }
  });
  
  // Garante que haja um registro inicial de notas
  db.get('SELECT * FROM notas', (err, row) => {
    if (!row) db.run('INSERT INTO notas (conteudo) VALUES (?)', ['']);
  });
});

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Endpoint para autenticação
app.post('/login', (req, res) => {
  const { senha } = req.body;
  db.get('SELECT senha_hash FROM usuarios LIMIT 1', (err, row) => {
    if (err || !row) return res.status(500).json({ sucesso: false });
    bcrypt.compare(senha, row.senha_hash, (err, result) => {
      if (result) res.json({ sucesso: true });
      else res.json({ sucesso: false });
    });
  });
});

io.on('connection', (socket) => {
  // Verifica se o usuário está autenticado
  socket.on('autenticar', (senha) => {
    db.get('SELECT senha_hash FROM usuarios LIMIT 1', (err, row) => {
      bcrypt.compare(senha, row.senha_hash, (err, result) => {
        if (result) {
          socket.autenticado = true;
          // Envia as notas atuais
          db.get('SELECT conteudo FROM notas LIMIT 1', (err, row) => {
            socket.emit('atualizarNotas', row.conteudo);
          });
        } else {
          socket.emit('authErro', 'Senha incorreta');
        }
      });
    });
  });

  // Atualiza notas apenas se autenticado
  socket.on('editarNotas', (novasNotas) => {
    if (!socket.autenticado) {
      socket.emit('authErro', 'Você precisa se autenticar');
      return;
    }
    db.run('UPDATE notas SET conteudo = ? WHERE id = 1', [novasNotas], (err) => {
      if (!err) socket.broadcast.emit('atualizarNotas', novasNotas);
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});