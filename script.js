const info = document.querySelector('#info>span');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cellSize = 4; // Set the size of each cell in the grid
let updateFrequency = 60; // In ticks per second
let paused = false;
let brushWidth = 5;
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
function drawLine(x1, y1, x2, y2, radius, placeParticle) {
  const minX = Math.min(x1, x2) - radius;
  const minY = Math.min(y1, y2) - radius;
  const maxX = Math.max(x1, x2) + radius;
  const maxY = Math.max(y1, y2) + radius;
  for(let x = minX; x <= maxX; x++) {
    for(let y = minY; y <= maxY; y++) {
      const nearest = findNearest({ x: x1, y: y1 }, { x: x2, y: y2 }, { x, y });
      const distance2 = getDistance2(nearest, { x, y });
      if(distance2 < radius**2) {
        placeParticle(x, y);
      }
    }
  }
}
function randi(min, max) {
  return min + Math.round(Math.random() * (max - min));
}
class Particle {
  constructor(x, y, grid) {
    this._x = x;
    this._y = y;
    this._prevX = x;
    this._prevY = y;
    this._grid = grid;
    this._lastUpdateTick = 0;
    this._lastSuccessfulUpdate = tick;
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
      this._lastSuccessfulUpdate = tick;
      this.wake();
    } else if(!(tick - this._lastSuccessfulUpdate <= 60)) {
      // Go to sleep if there hasn't been a successful update in the last 60 ticks
      this.sleep();
    }
    this.render();
    return hasMoved;
  }
  render() {}
  wake() {
    if(!this._awake) {
      this._awake = true;
      this._lastSuccessfulUpdate = tick;
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
    let otherParticle = getParticle(this._x + dx, this._y + dy);
    if(otherParticle) {
      otherParticle.update();
      otherParticle = getParticle(this._x + dx, this._y + dy);
      if(otherParticle) {
        if((otherParticle.density ?? 0) < (this.density ?? 0)) {
          // const a = otherParticle == this;
          this.swapPositionWith(dx, dy);
          return true;
        }
      }
    }
    if(this.canMove(dx, dy)) {
      this._grid[this._x][this._y] = null;
      paintPixel(this._x, this._y, 'black');
      wakeNeighbors(this._x, this._y);
      this._x += dx;
      this._y += dy;
      placeParticle(this._x, this._y, this);
      return { x: this._x, y: this._y };
    }
    return false;
  }
  swapPositionWith(dx, dy) {
    const otherX = this._x + dx;
    const otherY = this._y + dy;
    const otherParticle = getParticle(otherX, otherY);
    otherParticle.savePosition();
    grid[otherParticle._x][otherParticle._y] = this;
    otherParticle._x = this._x;
    otherParticle._y = this._y;
    grid[this._x][this._y] = otherParticle;
    this.savePosition();
    this._x = otherX;
    this._y = otherY;
    paintPixel(this._x, this._y, otherParticle._color);
    paintPixel(otherParticle._x, otherParticle._y, this._color);
    wakeNeighbors(this._prevX, this._prevY);

    const thisP = getParticle(this._x, this._y);
    const otherP = getParticle(otherParticle._x, otherParticle._y);
    const b = thisP == otherP;
    const a = true;

    otherParticle.render();
    this.render();
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
      this._type = name;
    }
    _update = updateFn;
    render() {
      paintPixel(this._prevX, this._prevY, 'black');
      paintPixel(this._x, this._y, this._color);
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
const SandParticle = defineParticleType('Sand', '#bca970', (x, y) => t.getPixel(randi(0, 2), randi(0, 2)), function() {
  if(!this.moveIfCan(0, 1)) {
    const leftOrRight = randi(0, 1);
    if(leftOrRight === 0) {
      return this.moveIfCan(-1, 1);// || this.moveIfCan(1, 1);
    } else {
      return this.moveIfCan(1, 1);// || this.moveIfCan(-1, 1);
    }
  }
  return true;
});
SandParticle.prototype.density = 10;
// Particle definitions
const WaterParticle = defineParticleType('Water', 'blue', 'blue', function() {
  if(!this.moveIfCan(0, 1)) {
    if(!(this.moveIfCan(randi(-1, -2), 1) || this.moveIfCan(randi(1, 2), 1))) {
      return Math.random() <= 0.5 ? this.moveIfCan(randi(-1, -2), 0) : this.moveIfCan(randi(1, 2), 0);
    }
  }
  return true;
});
WaterParticle.prototype.density = 5;
const GasParticle = defineParticleType('Gas', 'green', 'green', function() {
  if(!this.moveIfCan(randi(-1, 1), -1)) {
    if(!(this.moveIfCan(randi(-1, -2), -1) || this.moveIfCan(randi(1, 2), -1))) {
      return Math.random() <= 0.5 ? this.moveIfCan(randi(-1, -2), 0) : this.moveIfCan(randi(1, 2), 0);
    }
  }
  return true;
});
const SolidParticle = defineParticleType('Solid', 'grey', 'grey', function() {
  return false;
});
SolidParticle.prototype.density = 10;
const AntsParticle = defineParticleType('Ants', 'red', 'red', function() {
  const randX = randi(1, 2);
  const randY = 1; //;randi(1, 1);
  // Try moving down
  if(this.moveIfCan(0, 1)) {
    return true;
    // Then left or right
  } else if(!(Math.random() <= 0.5 ? this.moveIfCan(-randX, 0) : this.moveIfCan(randX, 0))) {
    if(isParticle(this._x - randX, this._y, 'Solid')) {
      return this.moveIfCan(-randX, -randY);
    } else if(isParticle(this._x + randX, this._y, 'Solid')) {
      return this.moveIfCan(randX, -randY);
    }
  }
  return false;
});
AntsParticle.prototype.density = 4;

const reactions = {
  ["Solid"]: {
    ["Water"]: {
      chance: 1,
      result1: GasParticle,
      result2: GasParticle,
    }
  }
};

let currentMaterial = SandParticle;
let isMouseDown = false;
const mouse = {
  isDown: false,
  button: 0,
  prevX: 0, prevY: 0,
  x: 0, y: 0,
}
canvas.addEventListener('mousedown', event => {
  // Calculate the x and y coordinates of the click relative to the canvas
  const mx = Math.floor(event.offsetX / cellSize);
  const my = Math.floor(event.offsetY / cellSize);
  // Update a particle if it's clicked directly and the game is paused
  const particle = getParticle(mouse.x, mouse.y);
  if(paused && particle) {
    if(event.button == 0) {
      tick++;
      console.log(particle);
      particle.wake();
      particle.update();
    } else if(event.button == 2) {
      removeParticle(mx, my);
    }
  } else {
    mouse.isDown = true;
    mouse.button = event.button;
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = mx;
    mouse.y = my;
  }
});
canvas.addEventListener('mousemove', event => {
  mouse.x = Math.floor(event.offsetX / cellSize);
  mouse.y = Math.floor(event.offsetY / cellSize);
});
canvas.addEventListener('mouseup', () => mouse.isDown = false);
canvas.addEventListener("contextmenu", e => e.preventDefault());
document.getElementById('startButton').addEventListener('click', () => paused = false);
document.getElementById('stepButton').addEventListener('click', () => { update(); react(); });
document.getElementById('stopButton').addEventListener('click', () => paused = true);
document.getElementById('debugRenderButton').addEventListener('click', () => {
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if(grid[x][y]) {
        paintPixel(x, y, 'white');
        // grid[x][y].update();
      }
    }
  }
});
document.getElementById('wakeAllButton').addEventListener('click', () => {
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if(grid[x][y]) {
        // paintPixel(x, y, 'white');
        grid[x][y].wake();
        grid[x][y].update();
      }
    }
  }
});
document.getElementById('clearAllButton').addEventListener('click', () => {
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      grid[x][y] = null;
      activeParticles.clear();
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
});

const brushWidthValue = document.getElementById('brushWidthValue');
document.getElementById('brushWidthSlider').value = brushWidth;
brushWidthValue.innerText = brushWidth;
document.getElementById('brushWidthSlider').addEventListener('input', e => {
  brushWidth = parseInt(e.target.value);
  brushWidthValue.innerText = brushWidth;
});
const updateFrequencyValue = document.getElementById('updateFrequencyValue');
document.getElementById('updateFrequencySlider').value = updateFrequency;
updateFrequencyValue.innerText = updateFrequency;
document.getElementById('updateFrequencySlider').addEventListener('input', e => {
  updateFrequency = parseInt(e.target.value);
  updateFrequencyValue.innerText = updateFrequency;
});

function paintPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
}
function getParticle(x, y) {
  if(x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
    return grid[x][y];
  }
}
function isParticle(x, y, type) {
  const particle = getParticle(x, y);
  return particle?._type == type;
}
function placeParticle(x, y, particle) {
  if(x >= 0 && x < gridWidth) {
    if(y >= 0 && y < gridHeight) {
      if(!getParticle(x, y)) {
        grid[x][y] = particle || new currentMaterial(x, y, grid);
        grid[x][y].wake();
        grid[x][y].render();
      }
    }
  }
}
function removeParticle(x, y) {
  if(x >= 0 && x < gridWidth) {
    if(y >= 0 && y < gridHeight) {
      const particle = grid[x][y];
      activeParticles.delete(particle);
      paintPixel(x, y, 'black');
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
  let count = 0;
  activeParticles.forEach(particle => {
    count++;
    particle.update();
  });
  info.innerHTML = `Active particles: ${count}`;
}

function react() {
  for(let x = 0; x < gridWidth; x++) {
    for(let y = 0; y < gridHeight; y++) {
      const particle1 = getParticle(x, y);
      if(!particle1) continue;
      let reaction1 = reactions[particle1._type];
      for(let x2 = x-1; x2 <= x+1; x2++) {
        for(let y2 = y-1; y2 <= y+1; y2++) {
          const particle2 = getParticle(x2, y2);
          if(!particle2) continue;
          if(reaction1) {
            const reaction2 = reaction1[particle2._type];
            if(reaction2 && randi(1, 100) <= reaction2.chance) {
              removeParticle(x, y);
              placeParticle(x, y, new reaction2.result1(x, y, grid));
            }
          } else {
            const reaction2 = reactions[particle2._type];
            if(reaction2) {
              reaction1 = reaction2[particle1._type];
              if(reaction1 && randi(1, 100) <= reaction1.chance) {
                removeParticle(x, y);
                placeParticle(x, y, new reaction1.result1(x, y, grid));
              }
            }
          }
        }
      }
    }
  }
}

let lastUpdate = Date.now();
function gameLoop() {
  if(mouse.isDown) {
  // if(mouse.isDown && activeParticles.size == 0) {
    drawLine(mouse.prevX, mouse.prevY, mouse.x, mouse.y, brushWidth, mouse.button == 0 ? placeParticle : removeParticle);
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }
  if(!paused && (Date.now() - lastUpdate >= 1000 / updateFrequency)) {
    lastUpdate = Date.now();
    update();
    react();
  }
  // info.innerText = `${mouse.x}, ${mouse.y}`;
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
