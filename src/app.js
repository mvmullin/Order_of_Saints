const http = require('http');
const socketio = require('socket.io');

const fs = require('fs');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const handler = (req, res) => {
  fs.readFile(`${__dirname}/../client/index.html`, (err, data) => {
    if (err) {
      throw err;
    }

    res.writeHead(200);
    res.end(data);
  });
};

const app = http.createServer(handler);

const io = socketio(app);

const movRad = 10;
let roomName;
const roomMax = 3;
let roomCount = 3;
const users = {};

const enemySetup = {};
const enemyTracker = {};
const spawnRange = 20;

// helper functions
// spawn enemies
const spawnEnemies = (enemies) => {
  var eachEnemy = {};
  for (let i = 0; i < enemies.numToSpawn; i++) {
    let xSpawn = Math.floor(Math.random() * spawnRange) + 1;
    if (xSpawn <= spawnRange / 2)
      {
      xSpawn -= 10;
    }
    else
      {
      xSpawn += enemies.spawnWidth;
    }
    let ySpawn = Math.floor(Math.random() * spawnRange) + 1;
    if (xSpawn <= spawnRange / 2)
      {
      ySpawn -= 10;
    }
    else
      {
      ySpawn += enemies.spawnHeight;
    }
    const time = new Date().getTime();
    eachEnemy[i] = {
      lastUpdate: time,
      x: xSpawn,
      y: ySpawn,
      rad: 25,
      fill: '#F00',
      speed: 5,
      velX: 0,
      velY: 0,
      alive: true,
    };
  }
  console.log('filled enemies');
  return eachEnemy;
};

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    socket.name = data.name;
    users[socket.name] = socket.name;
    // if active room is full, create new room
    if (roomCount >= roomMax)
    {
      roomName = `room${(Math.floor((Math.random() * 1000)) + 1)}`; // set new room to active room
      socket.room = roomName;
      roomCount = 0;
      console.log(roomName);
      enemySetup[socket.room] =
      {
        numToSpawn: 3,
        numAlive: 3,
        spawnWidth: data.spawnWidth,
        spawnHeight: data.spawnHeight,
      };

      enemyTracker[socket.room] = spawnEnemies(enemySetup[socket.room]);
      console.log("test x " + enemyTracker[socket.room].x);
      socket.emit('spawnEnemies', enemyTracker[socket.room]);
    }

    // else join active room and increment roomCount
    else {
      socket.room = roomName;
      roomCount++;
      socket.emit('spawnEnemies', enemyTracker[socket.room]);
    }
    
    socket.emit('learnRoom', roomName);
    socket.join(socket.room);
  });
};

const onDraw = (sock) => {
  const socket = sock;

  socket.on('draw', (data) => {
    io.sockets.in(socket.room).emit('drawn', data);
  });
};

const onMove = (sock) => {
  const socket = sock;

  socket.on('movement', (data) => {
    const time = new Date().getTime();
    data.coords.lastUpdate = time;

    if (data.keysDown[87] && data.keysDown[68] || data.keysDown[80] && data.keysDown[222]) {
      data.coords.x += Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y -= Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[87] && data.keysDown[65] || data.keysDown[80] && data.keysDown[76]) {
      data.coords.x -= Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y -= Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[65] && data.keysDown[83] || data.keysDown[76] && data.keysDown[186]) {
      data.coords.x -= Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y += Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[68] && data.keysDown[83] || data.keysDown[186] && data.keysDown[222]) {
      data.coords.x += Math.cos(45 * Math.PI / 180) * movRad;
      data.coords.y += Math.sin(45 * Math.PI / 180) * movRad;
    }

    else if (data.keysDown[65] || data.keysDown[76]) {
      data.coords.x -= movRad;
    }

    else if (data.keysDown[68] || data.keysDown[222]) {
      data.coords.x += movRad;
    }

    else if (data.keysDown[87] || data.keysDown[80]) {
      data.coords.y -= movRad;
    }

    else if (data.keysDown[83] || data.keysDown[186]) {
      data.coords.y += movRad;
    }

    // contain players on canvas
    if (data.coords.x < 0)
      data.coords.x = 0;
    if (data.coords.y < 0)
      data.coords.y = 0;
    if(data.coords.x > data.winWidth)
      data.coords.x = data.winWidth;
    if(data.coords.y > data.winHeight)
      data.coords.y = data.winHeight;

    io.sockets.in(socket.room).emit('move', data);
  });
};

const onUpdateEnemies = (sock) => {
  const socket = sock;
  
  socket.on('updateEnemies', (player) => {
    console.log("player room " + player.room);
    console.log(enemyTracker[player.room].x);
    var enemies = enemyTracker[player.room];
    console.log(enemies);
    let keys = Object.keys(enemies);
    
    for(var i=0; i <keys.length; i++){
			const enemy = enemies[keys[i]];
			if(enemy.alive){
				var dx=(player.x-enemy.x);
				var dy=(player.y-enemy.y);
				var mag=Math.sqrt(dx*dx+dy*dy);
				
				enemy.velX=(dx/mag)*enemy.speed;
				enemy.velY=(dy/mag)*enemy.speed;
        
        enemy.x += enemy.velX;
        enemy.y += enemy.velY;
			}
		}
    io.sockets.in(socket.room).emit('enemiesUpdated', enemies);
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    socket.broadcast.to(socket.room).emit('userLeft', { user: socket.name });
    socket.leave(socket.room);
    delete socket.name;
  });
};

io.on('connection', (socket) => {
  onJoined(socket);
  onDraw(socket);
  onMove(socket);
  onUpdateEnemies(socket);
  onDisconnect(socket);
});

app.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`Listening on 127.0.0.1: ${port}`);
});

