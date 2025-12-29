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
    
]