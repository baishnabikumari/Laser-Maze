const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.game-container');
const levelIndicator = document.getElementById('level-indicator');
const messageBox = document.getElementById('game-message');

const BASE_TILE_SIZE = 70;
let TILE_SIZE = 70;
const BLOCK_HEIGHT = 12;
let gridOffsetX = 0;
let gridOffsetY = 0;

const COLORS = {
    bgGradientStart: '#1a5068',
    bgGradientEnd: '#0f2b38',
    gridBorder: '#000000',
    gridFill: '#134B5F',
    gridHighlength: 'rgba(255,255,255,0.2)',
    blockTop: '#ecf0f1',
    blockSide: '#bdc3c7',
    wallTop: '#34495e',
    wallSide: '#2c3e50',
    mirrorFace: '#3498db',
    splitterFace: '#9b59b6',
    laserCore: '#ffffff',
    laserMid: '#ff3333',
    laserGlow: '#ff0000',
    source: '#e74c3c',
    target: '#f1c40f',
    targetActive: '#ffffff',
    selection: '#2ecc71',
    dragShadow: 'rgba(0,0,0,0.5)'
};

const TYPE = { EMPTY: 0, WALL: 1, MIRROR: 2, SOURCE: 4, TARGET: 5, SPLITTER: 6};
const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3};

let currentLevelIdx = 0;
let levelMap = [];
let objects = [];
let lasers = [];
let particles = [];

//animate
let currentLaserLength = 0;
let totalCalculatedLength = 0;
let animationFrameId;

//drag
let isDragging = false;
let dragObj = null;
let dragOffset = {x: 0, y: 0};
let dragPos = {x: 0, y: 0};

const asciiLevels = [
    [
        ".......",
        ".>.....",
        ".......",
        "....T..",
        ".......",
        "  /    ",
    ],
    [
        ".......",
        ".v.....",
        ".......",
        "....T..",
        ".......",
        "  /    "
    ],
];

function parseLevel(asciiGrid) {
    const rows = asciiGrid.length;
    const cols = asciiGrid.length;
    let map = [], objs = [];
    for(let y = 0; y < rows; y++){
        let mapRow = [];
        let rowStr = asciiGrid[y];
        for(let x = 0; x < cols; x++){
            let char = rowStr[x] || ' ';
            if(char === ' '){ mapRow.push(0); continue; } else { mapRow.push(1); }
            let obj = null;
            if (char === 'W') obj = { type: TYPE.WALL, locked: true };
            else if (char === 'T') obj = { type: TYPE.TARGET, locked: true};
            else if (char === '^') obj = { type: TYPE.SOURCE, dir: DIR.UP, locked: true};
            else if (char === '>') obj = { type: TYPE.SOURCE, dir: DIR.RIGHT, locked: true};
            else if (char === '<') obj = { type: TYPE.SOURCE, dir: DIR.DOWN, locked: true};
            else if (char === '/') obj = { type: TYPE.MIRROR, rot: 0, locked: false};
            else if (char === '\\') obj = { type: TYPE.MIRROR, rot: 1, locked: false};
            else if (char === '%') obj = { type: TYPE.SPLITTER, rot: 0, locked: false};
            if(obj) { obj.x = x; obj.y = y; objs.push(objs);}
        }
        map.push(mapRow);
    }
    return { map, objs };
}

function resizeCanvas(){
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (levelMap.length > 0) {
        const mapH = levelMap.length;
        const mapW = levelMap[0].length;
        const maxTileW = (canvas.width - 40) / napW;
        const maxTileH = (canvas.height - 40) / mapH;
        TILE_SIZE = Math.min(BASE_TILE_SIZE, maxTileW, maxTileH);
        gridOffsetX = (canvas.width - (mapW * TILE_SIZE)) / 2;
        gridOffsetY = (canvas.height - (mapH * TILE_SIZE)) / 2;
    }
    draw();
}
window.addEventListener('resize', resizeCanvas);

function initLevel(idx){
    if(idx >= asciiLevels.length) idx = 0;
    currentLevelIdx = idx;
    levelIndicator.innerText = (currentLevelIdx + 1).toString().padStart(2, '0');
    messageBox.classList.add('hidden');
    isLevelComplete = false;
    selectedObj = null;
    isDragging = false;
    dragObj = null;
    const parsed = parseLevel(asciiLevels[currentLevelIdx]);
    levelMap = parsed.map;
    objects = parsed.objs;
    particles = [];
    resizeCanvas();
    calculateLaser();
    if(!animationFrameId) renderLoop();
}

function calculateLaser(){
    lasers = [];
    objects.filter(o => o.type === TYPE.TARGET).forEach(t => t.active = false);
    const activeObjects = objects.filter(o => o !== dragObj);

    let beams = activeObjects.filter(o => o.type === TYPE.SOURCE).map(s => ({
        x: s.x, y: s.y, dir: s.dir
    }));

    let processedSteps = 0;
    while(beams.length > 0 && processedSteps < 100){
        let beam = beams.shift();
        processedSteps++;
        let currX = beam.x, currY = beam.y;
        let dx = 0, dy = 0;

        if(beam.dir === DIR.UP) dy = -1;
        else if(beam.dir === DIR.RIGHT) dx = 1;
        else if(beam.dir === DIR.DOWN) dy = 1;
        else if(beam.dir === DIR.LEFT) dx = -1;

        let hitObject = null, hitEdge = false, steps = 0;

        while(true) {
            let nextX = currX + dx;
            let nextY = currY + dy;
            if(nextY < 0 || nextY >= levelMap.length || nextX < 0 || nextX >= levelMap[0].length || levelMap[nextY][nextX] !== 1){
                hitEdge = true; break;
            }
            currX = nextX; currY = nextY; steps++;
            let obj = activeObjects.find(o => o.x === currX && o.y === currY);
            if(obj) {
                if(obj.type === TYPE.TARGET) { obj.active = true; }
                else { hitObject = obj; break; }
            }
        }
        if(steps > 0 || hitObject || hitEdge){
            let segment = { x1: beam.x, y: beam.y, x2: currX, y2: currY, dir: beam.dir, edge: hitEdge, hitObject };
            lasers.push(segment);
            if(hitObject){
                if(hitObject.type === TYPE.MIRROR){
                    let newDir = reflect(beam.dir, hitObject.rot);
                    if(newDir !== -1) beams.push({x: currX, y: currY, dir: newDir});
                } else if(hitObject.type === TYPE.SPLITTER){
                    beams.push({ x: currX, y: currY, dir: beam.dir});
                    let newDir = reflect(beam.dir, hitObject.rot);
                    if(newDir !== -1) beams.push({x: currX, y: currY, dir: newDir});
                }
            }
        }
    }
    totalCalculatedLength = 0;
    lasers.forEach(l => {
        const c = getVisualCoords(l);
        totalCalculatedLength += Math.sqrt(Math.pow(c.x2-c.x1, 2) + Math.pow(c.y2-c.y1, 2));
    });
    currentLaserLength = 0;
    if (totalCalculatedLength === 0) totalCalculatedLength = 1;
    if(!isDragging) checkWin();
}