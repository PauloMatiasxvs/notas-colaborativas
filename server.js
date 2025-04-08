const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Configuração do banco de dados SQLite
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Erro ao conectar ao DB:', err);
  console.log('Conectado ao SQLite');
});

// Criação das tabelas
db.serialize(() => {
  // Tabela de usuários (mantida igual)
  db.run('CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, senha_hash TEXT)');
  
  // Tabela de notas ajustada para múltiplas entradas
  db.run('CREATE TABLE IF NOT EXISTS notas (id INTEGER PRIMARY KEY AUTOINCREMENT, conteudo TEXT)');

  // Configura uma senha padrão (mude isso depois!)
  db.get('SELECT * FROM usuarios', (err, row) => {
    if (!row) {
      bcrypt.hash('senha123', 10, (err, hash) => {
        if (err) console.error('Erro ao criar hash:', err);
        db.run('INSERT INTO usuarios (senha_hash) VALUES (?)', [hash], (err) => {
          if (err) console.error('Erro ao inserir usuário:', err);
          else console.log('Usuário padrão criado com senha "senha123"');
        });
      });
    }
  });

  // Insere uma nota inicial se a tabela estiver vazia
  db.get('SELECT COUNT(*) as count FROM notas', (err, row) => {
    if (row.count === 0) {
      db.run('INSERT INTO notas (conteudo) VALUES (?)', [''], (err) => {
        if (err) console.error('Erro ao inserir nota inicial:', err);
      });
    }
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
    if (err || !row) {
      console.error('Erro ao buscar senha:', err);
      return res.status(500).json({ sucesso: false });
    }
    bcrypt.compare(senha, row.senha_hash, (err, result) => {
      if (err) console.error('Erro ao comparar senha:', err);
      res.json({ sucesso: result });
    });
  });
});

io.on('connection', (socket) => {
  socket.on('autenticar', (senha) => {
    db.get('SELECT senha_hash FROM usuarios LIMIT 1', (err, row) => {
      if (err || !row) {
        socket.emit('authErro', 'Erro no servidor');
        return;
      }
      bcrypt.compare(senha, row.senha_hash, (err, result) => {
        if (result) {
          socket.autenticado = true;
          // Envia todas as notas do banco
          db.all('SELECT id, conteudo FROM notas', (err, rows) => {
            if (err) console.error('Erro ao buscar notas:', err);
            socket.emit('atualizarNotas', rows.map(row => ({ id: row.id, conteudo: row.conteudo })));
          });
        } else {
          socket.emit('authErro', 'Senha incorreta');
        }
      });
    });
  });

  socket.on('editarNotas', (novasNotas) => {
    if (!socket.autenticado) {
      socket.emit('authErro', 'Você precisa se autenticar');
      return;
    }
    // Atualiza o banco de dados com as novas notas
    db.serialize(() => {
      // Remove todas as notas existentes
      db.run('DELETE FROM notas', (err) => {
        if (err) console.error('Erro ao limpar notas:', err);
      });
      // Insere as novas notas
      const stmt = db.prepare('INSERT INTO notas (id, conteudo) VALUES (?, ?)');
      novasNotas.forEach(nota => {
        stmt.run(nota.id, nota.conteudo, (err) => {
          if (err) console.error('Erro ao inserir nota:', err);
        });
      });
      stmt.finalize();
      // Sincroniza com outros usuários
      socket.broadcast.emit('atualizarNotas', novasNotas);
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});