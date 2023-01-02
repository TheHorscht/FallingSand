const info = document.querySelector('#info>span');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cellSize = 2; // Set the size of each cell in the grid
let updateFrequency = 60; // In ticks per second
let interval;
let brushWidth = 4;
let tick = 0;
const activeParticles = new Map();
const gridWidth = canvas.width / cellSize;
const gridHeight = canvas.height / cellSize;
// Create the grid array to store the state of each cell
let grid = [];
function resetGrid() {
  for (let x = 0; x < gridWidth; x++) {
    grid[x] = [];
  }
}
resetGrid();
function loadTexture(url) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const img = new Image();
  let data, w, h;
  img.src = url;
  img.addEventListener('load', () => {
    w = img.width;
    h = img.height;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0);
    data = ctx.getImageData(0, 0, w, h).data;
  });
  return {
    getPixel(x, y) {
      const r = data[(w * y + x) * 4], g = data[(w * y + x) * 4 + 1], b = data[(w * y + x) * 4 + 2];
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }
}
const t = loadTexture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw\
0AcxV9TtaIVBTuIOGSoThakijhKFYtgobQVWnUwufRDaNKQpLg4Cq4FBz8Wqw4uzro6uAqC4AeIo5OToouU+L+k0CLGg+N+vLv3uHsHCPUyU82OCUDVLCMVj4nZ3Io\
YeEUQA+hFFF0SM/VEeiEDz/F1Dx9f7yI8y/vcn6NPyZsM8InEs0w3LOJ14ulNS+e8TxxiJUkhPiceN+iCxI9cl11+41x0WOCZISOTmiMOEYvFNpbbmJUMlXiKOKyoG\
uULWZcVzluc1XKVNe/JXxjMa8tprtMcQRyLSCAJETKq2EAZFiK0aqSYSNF+zMM/7PiT5JLJtQFGjnlUoEJy/OB/8LtbszAZdZOCMaDzxbY/RoHALtCo2fb3sW03TgD\
/M3CltfyVOjDzSXqtpYWPgP5t4OK6pcl7wOUOMPSkS4bkSH6aQqEAvJ/RN+WAwVugZ9XtrbmP0wcgQ10t3QAHh8BYkbLXPN7d3d7bv2ea/f0AfPFyqxtlO4sAAAAJc\
EhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfmDB4MBDFFV6PIAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAADBJREFUCNdj3LMi5z8jExvDv78\
/GJiY2PgZfn6+y8DIxMbAxPD/L4OAYijD72/PGAAY5Q4TcxcJ4wAAAABJRU5ErkJggg==');
function getDistance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}
function getDistance2(p1, p2) {
  return (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
}
function findNearest(a, b, p) {
  let atob = { x: b.x - a.x, y: b.y - a.y };
  let atop = { x: p.x - a.x, y: p.y - a.y };
  let len = atob.x * atob.x + atob.y * atob.y;
  if(len === 0) {
    return a;
  }
  let dot = atop.x * atob.x + atop.y * atob.y;
  let t = Math.min(1, Math.max(0, dot / len));
  return { x: a.x + atob.x * t, y: a.y + atob.y * t };
}
function drawLine(x1, y1, x2, y2, radius, setPixel) {
  const minX = Math.min(x1, x2) - radius;
  const minY = Math.min(y1, y2) - radius;
  const maxX = Math.max(x1, x2) + radius;
  const maxY = Math.max(y1, y2) + radius;
  for(let x = minX; x <= maxX; x++) {
    for(let y = minY; y <= maxY; y++) {
      const nearest = findNearest({ x: x1, y: y1 }, { x: x2, y: y2 }, { x, y });
      const distance2 = getDistance2(nearest, { x, y });
      if(distance2 < radius**2) {
        setPixel(x, y);
      }
    }
  }
}
function randi(min, max) {
  return min + Math.round(Math.random() * (max - min));
}
function setPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
}
class Particle {
  constructor(x, y, grid) {
    this._x = x;
    this._y = y;
    this._prevX = x;
    this._prevY = y;
    this._grid = grid;
    this._lastUpdateTick = 0;
    this._awake = false;
    this.wake();
  }
  savePosition() {
    this._prevX = this._x;
    this._prevY = this._y;
  }
  update() {
    if(this._lastUpdateTick === tick || !this._awake) return;
    this._lastUpdateTick = tick;
    this.savePosition();
    const hasMoved = this._update();
    if(hasMoved) {
      this.wake();
    } else {
      this.sleep();
    }
    this.render();
  }
  render() {}
  wake() {
    if(!this._awake) {
      this._awake = true;
      activeParticles.set(this, this);
    }
  }
  sleep() {
    if(this._awake) {
      this._awake = false;
      activeParticles.delete(this);
    }
  }
  canMove(dx, dy) {
    const newX = this._x + dx;
    const newY = this._y + dy;
    return newX >= 0 && 
      newX < gridWidth && 
      newY >= 0 && 
      newY < gridHeight && 
      !this._grid[newX][newY] &&
      (this._grid[newX][newY] === null || !this._grid[newX][newY]);
  }
  moveIfCan(dx, dy) {
    getParticle(this._x + dx, this._y + dy)?.update();
    if(this.canMove(dx, dy)) {
      this._grid[this._x][this._y] = null;
      setPixel(this._x, this._y, 'black');
      wakeNeighbors(this._x, this._y);
      this._x += dx;
      this._y += dy;
      placeParticle(this._x, this._y, this);
      return { x: this._x, y: this._y };
    }
    return false;
  }
  toString() { return `${this._x}_${this._y}` }
}
function defineParticleType(name, buttonColor, particleColor, updateFn) {
  const newParticleClass = class extends Particle {
    constructor(x, y, grid) {
      super(x, y, grid);
      if(typeof particleColor == 'function') {
        this._color = particleColor(x, y);
      } else {
        this._color = particleColor;
      }
    }
    _update = updateFn;
    render() {
      setPixel(this._prevX, this._prevY, 'black');
      setPixel(this._x, this._y, this._color);
    }
  };
  const button = document.createElement('button');
  button.classList.add('button');
  button.style.backgroundColor = buttonColor;
  button.innerText = name;
  button.addEventListener('click', () => currentMaterial = newParticleClass);
  document.querySelector('.controls__buttons').appendChild(button);
  return newParticleClass;
}
const SandParticle = defineParticleType('Sand', 'yellow', (x, y) => t.getPixel(randi(0, 2), randi(0, 2)), function() {
  if(!this.moveIfCan(0, 1)) {
    const leftOrRight = randi(0, 1);
    if(leftOrRight === 0) {
      return this.moveIfCan(-1, 1) || this.moveIfCan(1, 1);
    } else {
      return this.moveIfCan(1, 1) || this.moveIfCan(-1, 1);
    }
  }
  return true;
});
// Particle definitions
const WaterParticle = defineParticleType('Water', 'blue', 'blue', function() {
  if(!(this.moveIfCan(0, 1) ||
    this.moveIfCan(randi(-1, -2), 1) ||
    this.moveIfCan(randi(1, 2), 1) ||
    this.moveIfCan(1, 0))) {
    return Math.random() <= 0.5 ? this.moveIfCan(randi(-1, -2), 0) : this.moveIfCan(randi(1, 2), 0);
  }
  return true;
});
const GasParticle = defineParticleType('Gas', 'green', 'green', function() {
  if(!(this.moveIfCan(0, -1) || this.moveIfCan(-1, -1) || this.moveIfCan(1, -1))) {
    if(Math.random() < 0.2) {
      Math.random() <= 0.5 ? this.moveIfCan(-1, 0) : this.moveIfCan(1, 0);
    }
  }
  return true;
});
const SolidParticle = defineParticleType('Solid', 'grey', 'grey', function() {
  return false;
});
let currentMaterial = SandParticle;
let isMouseDown = false;
const mouse = {
  isDown: false,
  button: 0,
  prevX: 0, prevY: 0,
  x: 0, y: 0,
}
canvas.addEventListener('mousedown', event => {
  mouse.isDown = true;
  mouse.button = event.button;
  // Calculate the x and y coordinates of the click relative to the canvas
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  mouse.x = Math.floor(event.offsetX / cellSize);
  mouse.y = Math.floor(event.offsetY / cellSize);
  // Update the particles if game is not running
  if(!interval) {
    tick++;
    getParticle(mouse.x, mouse.y)?.update();
  }
});
canvas.addEventListener('mousemove', event => {
  mouse.x = Math.floor(event.offsetX / cellSize);
  mouse.y = Math.floor(event.offsetY / cellSize);
});
canvas.addEventListener('mouseup', () => mouse.isDown = false);
canvas.addEventListener("contextmenu", e => e.preventDefault());
document.getElementById('startButton').addEventListener('click', () => { if(!interval) { interval = setInterval(gameLoop, 1000 / updateFrequency); }});
document.getElementById('stepButton').addEventListener('click', gameLoop);
document.getElementById('stopButton').addEventListener('click', () => { if(interval) { clearInterval(interval); interval = null; }});
const brushWidthValue = document.getElementById('brushWidthValue');
document.getElementById('brushWidthSlider').value = brushWidth;
brushWidthValue.innerText = brushWidth;
document.getElementById('brushWidthSlider').addEventListener('input', e => {
  brushWidth = parseInt(e.target.value);
  brushWidthValue.innerText = brushWidth;
});
function getParticle(x, y) {
  if(x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
    return grid[x][y];
  }
}
function placeParticle(x, y, particle) {
  if(x >= 0 && x < gridWidth) {
    if(y >= 0 && y < gridHeight) {
      if(!getParticle(x, y)) {
        grid[x][y] = particle || new currentMaterial(x, y, grid);
        grid[x][y].wake();
      }
    }
  }
}
function removeParticle(x, y) {
  if(x >= 0 && x < gridWidth) {
    if(y >= 0 && y < gridHeight) {
      const particle = grid[x][y];
      activeParticles.delete(particle);
      setPixel(x, y, 'black');
      grid[x][y] = null;
      wakeNeighbors(x, y);
    }
  }
}
function wakeNeighbors(cx, cy) {
  for(let x = cx-1; x <= cx+1; x++) {
    for(let y = cy-1; y <= cy+1; y++) {
      const particle = getParticle(x, y);
      if(particle) {
        particle.wake();
      }
    }
  }
}
// Define the update function
function update() {
  tick++;
  if(mouse.isDown) {
  // if(mouse.isDown && activeParticles.size == 0) {
    drawLine(mouse.prevX, mouse.prevY, mouse.x, mouse.y, brushWidth, mouse.button == 0 ? placeParticle : removeParticle);
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }
  let count = 0;
  activeParticles.forEach(particle => {
    count++;
    particle.update();
  });
  info.innerHTML = `Active particles: ${count}`;
}

// Set up the game loop to update and render the game on each frame
function gameLoop() {
  update();
}

interval = setInterval(gameLoop, 1000 / updateFrequency);
