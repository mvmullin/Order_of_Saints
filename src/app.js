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

// helper functions
// spawn enemies
const spawnEnemies = (enemies) => {
  const eachEnemy = {};

  // fill eachEnemy with x and y spawn points off screen
  for (let i = 0; i < enemies.numToSpawn; i += 1) {
    const limitXorY = Math.floor(Math.random() * 2); // determine which axis to spawn on
    let xSpawn;
    let ySpawn;

    // if 0, spawn on y axis either to the left or right of screen
    // else spawn on x axis either above or below screen
    if (limitXorY) {
      xSpawn = Math.floor(Math.random() * enemies.spawnRange) + 1;
      if (xSpawn <= enemies.spawnRange / 2) {
        xSpawn -= 10;
      } else {
        xSpawn += enemies.spawnWidth;
      }
      ySpawn = Math.floor(Math.random() * enemies.spawnHeight);
    } else {
      ySpawn = Math.floor(Math.random() * enemies.spawnRange) + 1;
      if (ySpawn <= enemies.spawnRange / 2) {
        ySpawn -= 10;
      } else {
        ySpawn += enemies.spawnHeight;
      }
      xSpawn = Math.floor(Math.random() * enemies.spawnWidth);
    }

    // create enemy
    eachEnemy[i] = {
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
  return eachEnemy;
};

// set up data properties
const setupPlayer = (data) => {
  const newUser = {
    x: data.spawnWidth / 2,
    y: data.spawnHeight / 2,
    rad: 25,
    score: 0,
    attacking: false,
    attackRange: 70,
    mouse: {},
    fill: `#${(`000000${Math.random().toString(16).slice(2, 8).toUpperCase()}`).slice(-6)}`, // code from http://www.daverabideau.com/blog/
    stroke: `#${(`000000${Math.random().toString(16).slice(2, 8).toUpperCase()}`).slice(-6)}`,
  };

  return newUser;
};

const rooms = {};
const movRad = 10;
let roomName;
const roomMax = 3;
let roomCount = 3;
let roomNum = 1;

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
		console.log("joined");
    const user = `user${(Math.floor((Math.random() * 1000)) + 1)}`;
    socket.name = user;

    // if active room is full, create new room
    if (roomCount >= roomMax) {
      roomName = `room${roomNum}`; // set active room to new room
      rooms[roomName] = {};
      roomCount = 0;
      roomNum += 1;

      // first enemy wave parameters
      rooms[roomName].enemySetup = {
        numToSpawn: 3,
        numAlive: 3,
        spawnWidth: data.spawnWidth,
        spawnHeight: data.spawnHeight,
        spawnRange: 20,
      };

      // set up enemies and add to the enemy tracker for this room
      // else join active room, increment roomCount, and send room enemies to new data
      if (!rooms[roomName].enemies) {
        rooms[roomName].enemies = {};
      }
      rooms[roomName].enemies = spawnEnemies(rooms[roomName].enemySetup);
    } else {
      roomCount += 1;
    }

    if (!rooms[roomName].users) {
      rooms[roomName].users = {};
    }
    // fill user
    rooms[roomName].users[user] = setupPlayer({
      spawnWidth: data.spawnWidth,
      spawnHeight: data.spawnHeight });

    const time = new Date().getTime();
    rooms[roomName].lastUpdate = time;
    socket.room = roomName;

    
    socket.join(roomName);
		socket.emit('learnRoom', { name: user, room: roomName, data: rooms[socket.room] }); // sent client their room name
  });
};

const onDisconnect = (sock) => {
  const socket = sock;
  socket.on('disconnect', () => {
    socket.leave(socket.room);
    delete rooms[socket.room].users[socket.name];
  });
};

// process key presses when requested
const onMove = (sock) => {
  const socket = sock;
  socket.on('movement', (data) => {
    if (rooms[socket.room].users[socket.name]) {
      const time = new Date().getTime();
      rooms[socket.room].lastUpdate = time;

      if ((data.keysDown[87] && data.keysDown[68]) || (data.keysDown[80] && data.keysDown[222])) {
        rooms[socket.room].users[socket.name].x += Math.cos(45 * ((Math.PI / 180))) * movRad;
        rooms[socket.room].users[socket.name].y -= Math.sin(45 * ((Math.PI / 180))) * movRad;
      } else if ((data.keysDown[87] && data.keysDown[65]) ||
      (data.keysDown[80] && data.keysDown[76])) {
        rooms[socket.room].users[socket.name].x -= Math.cos(45 * (Math.PI / 180)) * movRad;
        rooms[socket.room].users[socket.name].y -= Math.sin(45 * (Math.PI / 180)) * movRad;
      } else if ((data.keysDown[65] && data.keysDown[83]) ||
      (data.keysDown[76] && data.keysDown[186])) {
        rooms[socket.room].users[socket.name].x -= Math.cos(45 * (Math.PI / 180)) * movRad;
        rooms[socket.room].users[socket.name].y += Math.sin(45 * (Math.PI / 180)) * movRad;
      } else if ((data.keysDown[68] && data.keysDown[83]) ||
      (data.keysDown[186] && data.keysDown[222])) {
        rooms[socket.room].users[socket.name].x += Math.cos(45 * (Math.PI / 180)) * movRad;
        rooms[socket.room].users[socket.name].y += Math.sin(45 * (Math.PI / 180)) * movRad;
      } else if (data.keysDown[65] || data.keysDown[76]) {
        rooms[socket.room].users[socket.name].x -= movRad;
      } else if (data.keysDown[68] || data.keysDown[222]) {
        rooms[socket.room].users[socket.name].x += movRad;
      } else if (data.keysDown[87] || data.keysDown[80]) {
        rooms[socket.room].users[socket.name].y -= movRad;
      } else if (data.keysDown[83] || data.keysDown[186]) {
        rooms[socket.room].users[socket.name].y += movRad;
      }

    // contain datas on canvas
      if (rooms[socket.room].users[socket.name].x < 0) {
        rooms[socket.room].users[socket.name].x = 0;
      }
      if (rooms[socket.room].users[socket.name].y < 0) {
        rooms[socket.room].users[socket.name].y = 0;
      }
      if (rooms[socket.room].users[socket.name].x > data.winWidth) {
        rooms[socket.room].users[socket.name].x = data.winWidth;
      }
      if (rooms[socket.room].users[socket.name].y > data.winHeight) {
        rooms[socket.room].users[socket.name].y = data.winHeight;
      }

      io.sockets.in(socket.room).emit('draw', rooms[socket.room]);
    }
  });
};

// emit to everybody a data's attack status
const onAttack = (sock) => {
  const socket = sock;

  socket.on('updateAttack', (data) => {
    const time = new Date().getTime();
    rooms[socket.room].lastUpdate = time;
    rooms[socket.room].users[socket.name].attacking = true;
    rooms[socket.room].users[socket.name].mouse = data.mouse;
    io.sockets.in(socket.room).emit('draw', rooms[socket.room]);
  });
};

// check for collisions when data attacks
const onCollisionCheck = (sock) => {
  const socket = sock;

  socket.on('collisionCheck', (data) => {
    const enemies = rooms[socket.room].enemies;
    const keys = Object.keys(enemies);

    // check data's weapon tip to see if it is in the enemies radius
    for (let i = 0; i < keys.length; i += 1) {
      const enemy = enemies[keys[i]];
      if (enemy.alive) {
        const dx = enemy.x - data.weaponX;
        const dy = enemy.y - data.weaponY;
        const mag = Math.sqrt((dx * dx) + (dy * dy));

        if (mag <= enemy.rad) {
          delete rooms[socket.room].enemies[i];
          rooms[socket.room].enemySetup.numAlive -= 1;

          const users = Object.keys(rooms[socket.room].users);

          for (let j = 0; j < users.length; j += 1) {
            const user = rooms[socket.room].users[users[j]];

            user.score += 10;
          }
        }
      }
    }

    // spawn next wave if no enemies are alive
    if (rooms[socket.room].enemySetup.numAlive <= 0) {
      rooms[socket.room].enemySetup.numToSpawn += 2;
      rooms[socket.room].enemySetup.numAlive = rooms[socket.room].enemySetup.numToSpawn;
      rooms[socket.room].enemies = spawnEnemies(rooms[socket.room].enemySetup);
    }

    setTimeout(() => { rooms[socket.room].users[socket.name].attacking = false; }, 100);
    io.sockets.in(socket.room).emit('draw', rooms[socket.room]);
  });
};

const onAliveCheck = (sock) => {
	const socket = sock;
	
	socket.on('aliveCheck', () => {
		
		if(rooms[socket.room].users[socket.name]) {
		//check player enemy collisions
		const enemies = rooms[socket.room].enemies;
		const keys = Object.keys(enemies);
		
		const user = rooms[socket.room].users[socket.name];
		
		for (let i = 0; i < keys.length; i += 1) {
				
				const enemy = enemies[keys[i]];
				
				const dx = enemy.x - user.x;
        const dy = enemy.y - user.y;
        const mag = Math.sqrt((dx * dx) + (dy * dy));

        if (mag <= (enemy.rad + user.rad)) {
					
					socket.leave(socket.room);
          delete rooms[socket.room].users[socket.name];
					//socket.emit('activityChange', rooms[socket.room]);
        }	
			}
		}
		});
		
	};

// update enemy positions when requested
const onUpdateEnemies = (sock) => {
  const socket = sock;

  socket.on('updateEnemies', () => {
    if (rooms[socket.room].users[socket.name]) {
      const enemies = rooms[socket.room].enemies;
      const keys = Object.keys(enemies);

    // determine player to follow for each enemy
      for (let i = 0; i < keys.length; i += 1) {
        const enemy = enemies[keys[i]];
        if (enemy.alive) {
          let deltaX = rooms[socket.room].users[socket.name].x - enemy.x;
          let deltaY = rooms[socket.room].users[socket.name].y - enemy.y;
          let leastMag = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));

          const users = rooms[socket.room].users;
          const userProps = Object.keys(users);

        // find closest player
          for (let j = 0; j < userProps.length; j += 1) {
            const user = users[userProps[j]];
            if (user.x !== null) {
              const dx = (user.x - enemy.x);
              const dy = (user.y - enemy.y);
              const mag = Math.sqrt((dx * dx) + (dy * dy));

              if (mag < leastMag) {
                deltaX = dx;
                deltaY = dy;
                leastMag = mag;
              }
            }
          }

        // set enemy velocity
          enemy.velX = (deltaX / leastMag) * enemy.speed;
          enemy.velY = (deltaY / leastMag) * enemy.speed;

          enemy.x += enemy.velX;
          enemy.y += enemy.velY;
        }
        rooms[socket.room].enemies[i] = enemy;
      }
			
			
      io.sockets.in(socket.room).emit('draw', rooms[socket.room]);
    }
  });
};

io.on('connection', (socket) => {
  onJoined(socket);
  onDisconnect(socket);
  onMove(socket);
  onAttack(socket);
  onCollisionCheck(socket);
	onAliveCheck(socket);
  onUpdateEnemies(socket);
});

app.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`Listening on 127.0.0.1: ${port}`);
});

