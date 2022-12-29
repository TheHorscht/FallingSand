// Get the canvas element
const canvas = document.getElementById('canvas');
// Get the canvas context
const ctx = canvas.getContext('2d');
// Set the size of each cell in the grid
const cellSize = 2;
let brushWidth = 4;
let tick = 0;
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
class Particle {
  constructor(x, y, grid) {
    this._x = x;
    this._y = y;
    this._grid = grid;
    this._lastUpdateTick = 0;
  }
  update() {}
  render() {}
  // wake() {
  //   activeParticles[this] = this;
  // }
  // sleep() {
  //   activeParticles[this] = null;
  // }
  getParticleAt(x, y) {
    return x >= 0 && 
      x < this._grid.length && 
      y >= 0 && 
      y < this._grid[0].length && 
      this._grid[x][y];
    // return this._grid[x][y]
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
    const particle = this.getParticleAt(this._x + dx, this._y + dy);
    if(particle) {
      particle.update();
    }
    if(this.canMove(dx, dy)) {
      removeParticle(this._x, this._y);
      // this._grid[this._x][this._y] = 0;
      this._x += dx;
      this._y += dy;
      // this._grid[this._x][this._y] = this;
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
    if(this._lastUpdateTick === tick) return false;
    this._lastUpdateTick = tick;
    if(!this.moveIfCan(0, 1)) {
      const leftOrRight = randi(0, 1);
      if(leftOrRight === 0) {
        return this.moveIfCan(-1, 1);
      } else {
        return this.moveIfCan(1, 1);
      }
      // return this.moveIfCan(-1, 1) || this.moveIfCan(1, 1);
    }
    return true;
    //this.moveIfCan(0, 1) || this.moveIfCan(-1, 1) || this.moveIfCan(1, 1);
  }
  render(ctx, x, y, cellSize) {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
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

function placeParticle(x, y, particle) {
  if(x > 0 && x < grid.length) {
    if(y > 0 && y < grid[0].length) {
      grid[x][y] = particle || new currentMaterial(x, y, grid);
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

// Define the update function
function update() {
  tick++;
  if(mouse.isDown) {
    // Add a new particle to the grid at the clicked location
    // const placeParticle = (x, y) => {
    //   if(x < 0 || x > grid.length || y < 0 || y > grid[0].length) return;
    //   grid[x][y] = {
    //     update() {},
    //     render(ctx, x, y, cellSize) {
    //       ctx.fillStyle = 'yellow';
    //       ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    //     }
    //   }
    // };
    // resetGrid();
    drawLine(mouse.prevX, mouse.prevY, mouse.x, mouse.y, brushWidth, placeParticle);
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }

  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[0].length; y++) {
      const particle = grid[x][y];
      if (particle) {
        particle.update();
      }
    }
  }
}

function render() {
  // Clear the canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Render the particles
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[0].length; y++) {
      const particle = grid[x][y];
      if (particle) {
        particle.render(ctx, x, y, cellSize);
      }
    }
  }
}

// Set up the game loop to update and render the game on each frame
function gameLoop() {
  update();
  render();
}

// setInterval(gameLoop, 1000); // 60 ticks per second
setInterval(gameLoop, 1000 / 60); // 60 ticks per second
