// Get the canvas element
const canvas = document.getElementById('canvas');
// Get the canvas context
const ctx = canvas.getContext('2d');
// Set the size of each cell in the grid
const cellSize = 2;
let brushWidth = 4;
let tick = 0;
const activeParticles = new Map();
// Create the grid array to store the state of each cell
let grid = [];
function resetGrid() {
  for (let x = 0; x < canvas.width / cellSize; x++) {
    grid[x] = [];
    for (let y = 0; y < canvas.height / cellSize; y++) {
      grid[x][y] = 0;
    }
  }
}
resetGrid();
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
  update() {}
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
    return this._x + dx >= 0 && 
      this._x + dx < this._grid.length && 
      this._y + dy >= 0 && 
      this._y + dy < this._grid[0].length && 
      !this._grid[this._x + dx][this._y + dy] &&
      (this._grid[this._x + dx][this._y + dy] === 0 || !this._grid[this._x + dx][this._y + dy]);
  }
  moveIfCan(dx, dy) {
    const particle = getParticle(this._x + dx, this._y + dy);
    if(particle) {
      particle.update();
    }
    if(this.canMove(dx, dy)) {
      removeParticle(this._x, this._y);
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
class SandParticle extends Particle {
  constructor(x, y, grid) {
    super(x, y, grid);
  }
  update() {
    if(this._lastUpdateTick === tick || !this._awake) return;
    this.savePosition();
    const moved = (() => {
      this._lastUpdateTick = tick;
      if(!this.moveIfCan(0, 1)) {
        const leftOrRight = randi(0, 1);
        if(leftOrRight === 0) {
          return this.moveIfCan(-1, 1);// || this.moveIfCan(1, 1);
        } else {
          return this.moveIfCan(1, 1);// || this.moveIfCan(-1, 1);
        }
        // TODO What to do when it couldn't move in the desired direction? Try again in other?
      }
      // Return true if it moved
      return true;
    })();
    if(moved) {
      this.wake();
      this.render();
    } else {
      this.sleep();
      this.render();
    }
  }
  render() {
    setPixel(this._prevX, this._prevY, 'black');
    setPixel(this._x, this._y, 'yellow');
  }
}
const water = {
  color: 'blue',
  update(grid, updatedGrid) {
    if(!(this.moveIfCan(0, 1, updatedGrid) || this.moveIfCan(-1, 1, updatedGrid) || this.moveIfCan(1, 1, updatedGrid))) {
      Math.random() <= 0.5 ? this.moveIfCan(-1, 0, updatedGrid) : this.moveIfCan(1, 0, updatedGrid);
    }
  }
};
const gas = {
  color: 'green',
  update(grid, updatedGrid) {
    if(!(this.moveIfCan(0, -1, updatedGrid) || this.moveIfCan(-1, -1, updatedGrid) || this.moveIfCan(1, -1, updatedGrid))) {
      if(Math.random() < 0.2) {
        Math.random() <= 0.5 ? this.moveIfCan(-1, 0, updatedGrid) : this.moveIfCan(1, 0, updatedGrid);
      }
    }
  }
};
const solid = {
  color: 'grey',
  update() {},
};
let currentMaterial = SandParticle;
let isMouseDown = false;
const mouse = {
  isDown: false,
  prevX: 0, prevY: 0,
  x: 0, y: 0,
}
canvas.addEventListener('mousedown', event => {
  mouse.isDown = true;
  // Calculate the x and y coordinates of the click relative to the canvas
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  mouse.x = Math.round(event.offsetX / cellSize);
  mouse.y = Math.round(event.offsetY / cellSize);
});
canvas.addEventListener('mousemove', event => {
  mouse.x = Math.round(event.offsetX / cellSize);
  mouse.y = Math.round(event.offsetY / cellSize);
});
canvas.addEventListener('mouseup', () => mouse.isDown = false);
// Add event listeners to the buttons to change the current material
document.getElementById('sandButton').addEventListener('click', () => currentMaterial = SandParticle);
document.getElementById('waterButton').addEventListener('click', () => currentMaterial = water);
document.getElementById('gasButton').addEventListener('click', () => currentMaterial = gas);
document.getElementById('solidButton').addEventListener('click', () => currentMaterial = solid);
document.getElementById('eraserButton').addEventListener('click', () => currentMaterial = eraser);
const brushWidthValue = document.getElementById('brushWidthValue');
document.getElementById('brushWidthSlider').value = brushWidth;
brushWidthValue.innerText = brushWidth;
document.getElementById('brushWidthSlider').addEventListener('input', e => {
  brushWidth = e.target.value;
  brushWidthValue.innerText = brushWidth;
});
function getParticle(x, y) {
  return x >= 0 && x < grid.length && y >= 0 && y < grid[0].length && grid[x][y];
}
function placeParticle(x, y, particle) {
  if(x > 0 && x < grid.length) {
    if(y > 0 && y < grid[0].length) {
      if(!getParticle(x, y)) {
        grid[x][y] = particle || new currentMaterial(x, y, grid);
        grid[x][y].wake();
      }
    }
  }
}
function removeParticle(x, y) {
  if(x > 0 && x < grid.length) {
    if(y > 0 && y < grid[0].length) {
      grid[x][y] = 0;
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
    drawLine(mouse.prevX, mouse.prevY, mouse.x, mouse.y, brushWidth, placeParticle);
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }
  activeParticles.forEach(particle => particle.update());
}

// Set up the game loop to update and render the game on each frame
function gameLoop() {
  update();
}

// setInterval(gameLoop, 1000); // 60 ticks per second
setInterval(gameLoop, 1000 / 60); // 60 ticks per second
