class IsometricGame {
    constructor() {
        // Load textures
        this.textures = {
            water: this.loadTexture('assets/textures/water.png'),
            grass: this.loadTexture('assets/textures/grass.png'),
            sand: this.loadTexture('assets/textures/sand.png'),
            darkGrass: this.loadTexture('assets/textures/dark_grass.png')
        };
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Tile dimensions
        this.tileWidth = 32;    // Width of tile in world space
        this.tileHeight = 16;   // Height of tile in world space
        this.textureSize = 16;  // Size of the texture (16x16)
        
        // Camera settings
        this.camera = {
            x: this.canvas.width / 2,
            y: 100,
            zoom: 1.0,
            dragStart: null,
            isDragging: false
        };
        
        // Initialize game API
        this.gameAPI = new GameAPI();
        
        // Set up callback for entity reset
        this.gameAPI.onEntitiesReset = () => {
            const iso = this.toIsometric(this.player.x, this.player.y);
            this.centerCameraOn(iso.x, iso.y);
        };
        
        // Create player at valid spawn point
        const spawn = this.gameAPI.spawnPoint;
        this.player = this.gameAPI.createEntity('player', spawn.x, spawn.y);
        
        // Center camera on spawn point
        const spawnIso = this.toIsometric(spawn.x, spawn.y);
        this.centerCameraOn(spawnIso.x, spawnIso.y);
        
        // Add movement state
        this.movement = {
            up: false,
            down: false,
            left: false,
            right: false,
            sprint: false
        };
        
        // Add debug state
        this.debug = {
            enabled: false,
            showTileInfo: false,
            showGrid: false,
            showNextTarget: true,    // Default to on
            showMobTiles: true,      // Default to on
            showPlayerTile: false     // New setting, default to on
        };
        
        this.init();
        
        this.setupTerrainControls();
        this.setupDebugControls();
    }
    
    init() {
        this.setupControls();
        this.setupCameraControls();
        this.gameLoop();
    }
    
    setupCameraControls() {
        // Mouse drag for camera movement
        this.canvas.addEventListener('mousedown', (e) => {
            this.camera.dragStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
            this.camera.isDragging = true;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.camera.isDragging) {
                this.camera.x = e.clientX - this.camera.dragStart.x;
                this.camera.y = e.clientY - this.camera.dragStart.y;
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.camera.isDragging = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.camera.isDragging = false;
        });
        
        // Zoom with mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const oldZoom = this.camera.zoom;
            
            // Calculate mouse position relative to canvas
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Zoom in or out
            if (e.deltaY < 0) {
                this.camera.zoom = Math.min(3.0, this.camera.zoom + zoomSpeed);
            } else {
                this.camera.zoom = Math.max(0.1, this.camera.zoom - zoomSpeed);
            }
            
            // Adjust camera position to zoom toward mouse position
            const zoomRatio = this.camera.zoom / oldZoom;
            this.camera.x = mouseX - (mouseX - this.camera.x) * zoomRatio;
            this.camera.y = mouseY - (mouseY - this.camera.y) * zoomRatio;
        });
    }
    
    setupControls() {
        // Handle keydown
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'arrowup':
                case 'w':
                    this.movement.up = true;
                    break;
                case 'arrowdown':
                case 's':
                    this.movement.down = true;
                    break;
                case 'arrowleft':
                case 'a':
                    this.movement.left = true;
                    break;
                case 'arrowright':
                case 'd':
                    this.movement.right = true;
                    break;
                case 'shift':
                    this.movement.sprint = true;
                    break;
            }
        });

        // Handle keyup
        document.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'arrowup':
                case 'w':
                    this.movement.up = false;
                    break;
                case 'arrowdown':
                case 's':
                    this.movement.down = false;
                    break;
                case 'arrowleft':
                case 'a':
                    this.movement.left = false;
                    break;
                case 'arrowright':
                case 'd':
                    this.movement.right = false;
                    break;
                case 'shift':
                    this.movement.sprint = false;
                    break;
            }
        });
    }
    
    updatePlayerMovement() {
        let directionX = 0;
        let directionY = 0;

        if (this.movement.up) directionY -= 1;
        if (this.movement.down) directionY += 1;
        if (this.movement.left) directionX -= 1;
        if (this.movement.right) directionX += 1;

        if (directionX !== 0 || directionY !== 0) {
            if (this.gameAPI.moveEntity(
                this.player.id, 
                directionX, 
                directionY, 
                this.movement.sprint
            )) {
                const iso = this.toIsometric(this.player.x, this.player.y);
                this.centerCameraOn(iso.x, iso.y);
            }
        }
    }
    
    centerCameraOn(x, y) {
        // Center the camera on the isometric position
        this.camera.x = this.canvas.width / 2 - x * this.camera.zoom;
        this.camera.y = this.canvas.height / 2 - y * this.camera.zoom;
    }
    
    gameLoop() {
        this.updatePlayerMovement();
        this.gameAPI.updateEntities();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    toIsometric(x, y) {
        return {
            x: (x - y) * this.tileWidth / 2,
            y: (x + y) * this.tileHeight / 2
        };
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply camera transform
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // Draw map
        for(let y = 0; y < this.gameAPI.map.height; y++) {
            for(let x = 0; x < this.gameAPI.map.width; x++) {
                this.drawTile(x, y);
            }
        }
        
        // Draw entities
        this.drawEntities();
        
        this.ctx.restore();
    }
    
    drawTile(x, y) {
        const iso = this.toIsometric(x, y);
        const tileType = this.gameAPI.getTile(x, y);
        
        // Skip drawing tiles that are outside the view
        const screenX = iso.x * this.camera.zoom + this.camera.x;
        const screenY = iso.y * this.camera.zoom + this.camera.y;
        if (screenX < -100 || screenX > this.canvas.width + 100 ||
            screenY < -100 || screenY > this.canvas.height + 100) {
            return;
        }

        // Save context for tile transform
        this.ctx.save();
        
        // Move to tile position
        this.ctx.translate(iso.x, iso.y);
        
        // Select texture based on tile type
        let texture;
        switch(tileType) {
            case this.gameAPI.tileTypes.WATER:
                texture = this.textures.water;
                break;
            case this.gameAPI.tileTypes.SAND:
                texture = this.textures.sand;
                break;
            case this.gameAPI.tileTypes.GRASS:
                texture = this.textures.grass;
                break;
            case this.gameAPI.tileTypes.DARK_GRASS:
                texture = this.textures.darkGrass;
                break;
        }
        
        // Draw the texture if loaded
        if (texture && texture.complete) {
            // Set up the isometric transform
            this.ctx.transform(1, 0.5, -1, 0.5, 0, 0);
            
            // Draw the texture centered on the tile
            this.ctx.drawImage(
                texture,
                -this.textureSize/2,
                -this.textureSize/2,
                this.textureSize,
                this.textureSize
            );
        } else {
            // Fallback to colored tiles if texture not loaded
            this.ctx.beginPath();
            this.ctx.moveTo(0, -this.tileHeight/2);
            this.ctx.lineTo(this.tileWidth/2, 0);
            this.ctx.lineTo(0, this.tileHeight/2);
            this.ctx.lineTo(-this.tileWidth/2, 0);
            this.ctx.closePath();
            
            // Use original colors as fallback
            switch(tileType) {
                case this.gameAPI.tileTypes.WATER:
                    this.ctx.fillStyle = '#4444ff';
                    break;
                case this.gameAPI.tileTypes.SAND:
                    this.ctx.fillStyle = '#e6d5ac';
                    break;
                case this.gameAPI.tileTypes.GRASS:
                    this.ctx.fillStyle = '#50C878';
                    break;
                case this.gameAPI.tileTypes.DARK_GRASS:
                    this.ctx.fillStyle = '#2E5931';
                    break;
                default:
                    this.ctx.fillStyle = '#e0e0e0';
            }
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();

        // Debug info drawing - after restoring the context
        if (this.debug.showGrid) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.font = '8px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${x},${y}`, iso.x, iso.y + this.tileHeight/2);
        }

        // Get all entities on this tile
        const entitiesHere = Array.from(this.gameAPI.entities.values())
            .filter(entity => Math.floor(entity.x) === x && Math.floor(entity.y) === y);
        
        // Get the first entity that isn't the player
        const mobEntity = entitiesHere.find(entity => entity.type !== this.gameAPI.entityTypes.PLAYER);
        const playerEntity = entitiesHere.find(entity => entity.type === this.gameAPI.entityTypes.PLAYER);
        
        // Show tile info based on debug settings
        if (this.debug.showTileInfo || (this.debug.showMobTiles && mobEntity)) {
            // Get the first entity that isn't the player
            const entity = this.debug.showTileInfo ? (playerEntity || mobEntity) : mobEntity;
            
            if (entity) {
                this.ctx.beginPath();
                this.ctx.moveTo(iso.x, iso.y - this.tileHeight/2);
                this.ctx.lineTo(iso.x + this.tileWidth/2, iso.y);
                this.ctx.lineTo(iso.x, iso.y + this.tileHeight/2);
                this.ctx.lineTo(iso.x - this.tileWidth/2, iso.y);
                this.ctx.closePath();
                
                // Set color based on entity type
                if (entity.type === this.gameAPI.entityTypes.PLAYER) {
                    this.ctx.strokeStyle = '#800000';  // Dark red for player
                } else if (entity.type === this.gameAPI.entityTypes.FISH) {
                    this.ctx.strokeStyle = '#4477ff';  // Blue for fish
                } else if (entity.type === this.gameAPI.entityTypes.WOLF) {
                    this.ctx.strokeStyle = '#666666';  // Grey for wolves
                } else {
                    this.ctx.strokeStyle = '#00ff00';  // Green for other animals
                }

                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                // Only show text info if showTileInfo is enabled
                if (this.debug.showTileInfo) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    this.ctx.fillRect(iso.x - 40, iso.y - 30, 80, 20);
                    this.ctx.font = '12px Arial';
                    this.ctx.textAlign = 'center';
                    
                    // Set text color based on entity type
                    if (entity.type === this.gameAPI.entityTypes.PLAYER) {
                        this.ctx.fillStyle = '#ff0000';  // Red text for player
                    } else if (entity.type === this.gameAPI.entityTypes.FISH) {
                        this.ctx.fillStyle = '#4477ff';  // Blue text for fish
                    } else if (entity.type === this.gameAPI.entityTypes.WOLF) {
                        this.ctx.fillStyle = '#666666';  // Grey text for wolves
                    } else {
                        this.ctx.fillStyle = '#008000';  // Green text for other animals
                    }
                    
                    this.ctx.fillText(
                        `${entity.type} (${x},${y})`,
                        iso.x,
                        iso.y - 15
                    );
                }
            }
        }

        // Show player tile highlight
        if (this.debug.showPlayerTile) {
            const playerX = Math.floor(this.player.x);
            const playerY = Math.floor(this.player.y);
            
            if (x === playerX && y === playerY) {
                this.ctx.beginPath();
                this.ctx.moveTo(iso.x, iso.y - this.tileHeight/2);
                this.ctx.lineTo(iso.x + this.tileWidth/2, iso.y);
                this.ctx.lineTo(iso.x, iso.y + this.tileHeight/2);
                this.ctx.lineTo(iso.x - this.tileWidth/2, iso.y);
                this.ctx.closePath();
                this.ctx.strokeStyle = '#ff0000';  // Red outline for player tile
                this.ctx.setLineDash([3, 3]);     // Dashed line for distinction
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                this.ctx.lineWidth = 1;
            }
        }
    }
    
    drawEntities() {
        // Draw all entities first
        for (let entity of this.gameAPI.entities.values()) {
            const iso = this.toIsometric(entity.x, entity.y);
            const tileType = this.gameAPI.getTile(entity.x, entity.y);
            
            // Get the tile center position
            const screenX = iso.x;
            const screenY = iso.y - this.tileHeight/2;
            
            this.ctx.beginPath();
            
            if (entity.type === this.gameAPI.entityTypes.PLAYER) {
                if (tileType === this.gameAPI.tileTypes.WATER) {
                    // Draw player as half-circle when in water
                    this.ctx.arc(screenX, screenY, 6, 0, Math.PI, false);
                    this.ctx.lineTo(screenX - 6, screenY);
                    // Add wave line
                    this.ctx.moveTo(screenX - 8, screenY);
                    this.ctx.quadraticCurveTo(screenX - 6, screenY - 3, screenX, screenY);
                    this.ctx.quadraticCurveTo(screenX + 6, screenY + 3, screenX + 8, screenY);
                } else {
                    // Normal circle on land
                    this.ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
                }
            } else if (entity.type === this.gameAPI.entityTypes.FISH) {
                // Draw fish as a small oval
                this.ctx.save();
                this.ctx.translate(screenX, screenY);
                this.ctx.rotate(entity.moveDirection);
                this.ctx.scale(1, 0.5);
                this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
                this.ctx.restore();
            } else if (entity.type === this.gameAPI.entityTypes.PIG) {
                // Draw pig as a rounded rectangle
                this.ctx.save();
                this.ctx.translate(screenX, screenY);
                this.ctx.rotate(entity.moveDirection);
                this.roundRect(-5, -3, 10, 6, 2);
                this.ctx.restore();
            } else if (entity.type === this.gameAPI.entityTypes.COW) {
                // Draw cow as a larger rounded rectangle
                this.ctx.save();
                this.ctx.translate(screenX, screenY);
                this.ctx.rotate(entity.moveDirection);
                this.roundRect(-6, -4, 12, 8, 2);
                this.ctx.restore();
            } else if (entity.type === this.gameAPI.entityTypes.WOLF) {
                // Draw wolf as a pointed triangle
                this.ctx.save();
                
                // Draw pack connection lines first (before any wolf shapes)
                if (entity.packLeader) {
                    const leaderPos = this.toIsometric(entity.packLeader.x, entity.packLeader.y);
                    this.ctx.beginPath();
                    this.ctx.moveTo(screenX, screenY - this.tileHeight/2);
                    this.ctx.lineTo(leaderPos.x, leaderPos.y - this.tileHeight/2);
                    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';  // Black with 60% opacity
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.lineWidth = 1.5;  // Slightly thicker line
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    this.ctx.lineWidth = 1;  // Reset line width
                } else if (entity.wantsPack) {
                    // Draw lines to nearby pack leaders that this wolf might join
                    for (let other of this.gameAPI.entities.values()) {
                        if (other.type === this.gameAPI.entityTypes.WOLF && 
                            other.isPackLeader && 
                            other.packMembers.length < this.gameAPI.entitySettings.maxPackSize) {
                            
                            const dx = other.x - entity.x;
                            const dy = other.y - entity.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // Only show connection possibility if within joining range
                            if (distance < 10) {
                                const otherPos = this.toIsometric(other.x, other.y);
                                this.ctx.beginPath();
                                this.ctx.moveTo(screenX, screenY - this.tileHeight/2);
                                this.ctx.lineTo(otherPos.x, otherPos.y - this.tileHeight/2);
                                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';  // Subtle white line
                                this.ctx.setLineDash([2, 4]);  // Shorter, more frequent dashes
                                this.ctx.lineWidth = 0.5;
                                this.ctx.stroke();
                                this.ctx.setLineDash([]);
                                this.ctx.lineWidth = 1;
                            }
                        }
                    }
                }
                
                // Now draw the wolf shape
                this.ctx.translate(screenX, screenY);
                this.ctx.rotate(entity.moveDirection);
                
                // Draw triangle pointing in movement direction
                this.ctx.beginPath();
                this.ctx.moveTo(6, 0);
                this.ctx.lineTo(-4, -4);
                this.ctx.lineTo(-4, 4);
                this.ctx.closePath();
                this.ctx.fillStyle = entity.isHunting ? '#884444' : '#666666';
                this.ctx.strokeStyle = '#000000';
                this.ctx.lineWidth = 1;
                this.ctx.fill();
                this.ctx.stroke();
                
                // Draw yellow dot for pack leader (after wolf shape)
                if (entity.isPackLeader) {
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 2, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.strokeStyle = '#000000';  // Add black outline
                    this.ctx.fill();
                    this.ctx.stroke();
                }
                
                // Draw hunger bar above wolf
                if (entity.hunger !== null) {
                    // Color changes based on hunger level
                    let hungerColor;
                    if (entity.hunger > 85) {
                        hungerColor = '#ff0000';  // Red when close to death
                    } else if (entity.isHunting) {
                        hungerColor = '#ff6600';  // Orange when hunting
                    } else {
                        hungerColor = '#00ff00';  // Green when satisfied
                    }
                    this.ctx.fillStyle = hungerColor;
                    this.ctx.fillRect(-5, -8, 10 * (entity.hunger / 100), 2);
                    this.ctx.strokeStyle = '#000000';
                    this.ctx.strokeRect(-5, -8, 10, 2);
                }

                this.ctx.restore();
            }
            
            // Color based on entity type
            if (entity.type === this.gameAPI.entityTypes.PLAYER) {
                this.ctx.fillStyle = tileType === this.gameAPI.tileTypes.WATER ? '#ff6666' : '#ff0000';
            } else if (entity.type === this.gameAPI.entityTypes.FISH) {
                this.ctx.fillStyle = '#4477ff';
            } else if (entity.type === this.gameAPI.entityTypes.PIG) {
                this.ctx.fillStyle = '#FFC0CB';
            } else if (entity.type === this.gameAPI.entityTypes.COW) {
                this.ctx.fillStyle = '#000000';
            } else if (entity.type === this.gameAPI.entityTypes.WOLF) {
                this.ctx.fillStyle = entity.isHunting ? '#884444' : '#666666';  // Redder when hunting
            } else {
                this.ctx.fillStyle = '#00ff00';
            }
            
            this.ctx.fill();
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // Draw target indicators after entities if debug option is enabled
        if (this.debug.showNextTarget) {
            for (let entity of this.gameAPI.entities.values()) {
                if (entity.type === this.gameAPI.entityTypes.WOLF) {
                    // Find potential target with unlimited range
                    const potentialTarget = this.gameAPI.findClosestPrey(entity, Infinity);
                    if (potentialTarget) {
                        const wolfPos = this.toIsometric(entity.x, entity.y);
                        const targetPos = this.toIsometric(potentialTarget.x, potentialTarget.y);
                        
                        // Draw line from wolf to target
                        this.ctx.beginPath();
                        this.ctx.moveTo(wolfPos.x, wolfPos.y - this.tileHeight/2);
                        this.ctx.lineTo(targetPos.x, targetPos.y - this.tileHeight/2);
                        
                        // Color based on wolf's state
                        if (entity.isHunting) {
                            this.ctx.strokeStyle = '#ff0000';  // Red line when actively hunting
                        } else if (entity.hunger > 60) {
                            this.ctx.strokeStyle = '#ff9900';  // Orange line when getting hungry
                        } else {
                            this.ctx.strokeStyle = '#666666';  // Grey line when not hungry
                        }
                        
                        this.ctx.lineWidth = 1;
                        this.ctx.setLineDash([5, 5]);  // Dashed line
                        this.ctx.stroke();
                        this.ctx.setLineDash([]);  // Reset dash pattern
                        
                        // Draw distance text
                        const dx = potentialTarget.x - entity.x;
                        const dy = potentialTarget.y - entity.y;
                        const distance = Math.sqrt(dx * dx + dy * dy).toFixed(1);
                        
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        this.ctx.font = '10px Arial';
                        this.ctx.textAlign = 'center';
                        const midX = (wolfPos.x + targetPos.x) / 2;
                        const midY = (wolfPos.y + targetPos.y) / 2 - this.tileHeight/2;
                        this.ctx.fillText(`${distance}`, midX, midY);
                    }
                }
            }
        }

        // Draw pack alert lines after entities
        for (let entity of this.gameAPI.entities.values()) {
            if (entity.type === this.gameAPI.entityTypes.WOLF) {
                // Draw line from pack member to spotted prey
                if (entity.spottedPrey && entity.packLeader) {
                    const wolfPos = this.toIsometric(entity.x, entity.y);
                    const preyPos = this.toIsometric(entity.spottedPrey.x, entity.spottedPrey.y);
                    const leaderPos = this.toIsometric(entity.packLeader.x, entity.packLeader.y);
                    
                    // Calculate distances to compare
                    const distToSpottedPrey = Math.sqrt(
                        Math.pow(entity.spottedPrey.x - entity.packLeader.x, 2) +
                        Math.pow(entity.spottedPrey.y - entity.packLeader.y, 2)
                    );
                    
                    const distToCurrentTarget = entity.packLeader.huntTarget ? Math.sqrt(
                        Math.pow(entity.packLeader.huntTarget.x - entity.packLeader.x, 2) +
                        Math.pow(entity.packLeader.huntTarget.y - entity.packLeader.y, 2)
                    ) : Infinity;
                    
                    // Only show alert if this prey is closer than current target
                    if (!entity.packLeader.huntTarget || distToSpottedPrey < distToCurrentTarget) {
                        this.ctx.beginPath();
                        // Line from wolf to prey
                        this.ctx.moveTo(wolfPos.x, wolfPos.y - this.tileHeight/2);
                        this.ctx.lineTo(preyPos.x, preyPos.y - this.tileHeight/2);
                        // Line from prey to leader
                        this.ctx.lineTo(leaderPos.x, leaderPos.y - this.tileHeight/2);
                        
                        // Make line more visible when prey is closer
                        const opacity = 0.3 + (0.4 * (1 - distToSpottedPrey/20));  // Increase opacity for closer prey
                        this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                        this.ctx.setLineDash([3, 3]);
                        this.ctx.lineWidth = 0.5;
                        this.ctx.stroke();
                        this.ctx.setLineDash([]);
                        this.ctx.lineWidth = 1;
                    }
                }
                
                // Draw line from leader to alerted prey
                if (entity.isPackLeader && entity.alertedPrey) {
                    const leaderPos = this.toIsometric(entity.x, entity.y);
                    const preyPos = this.toIsometric(entity.alertedPrey.x, entity.alertedPrey.y);
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(leaderPos.x, leaderPos.y - this.tileHeight/2);
                    this.ctx.lineTo(preyPos.x, preyPos.y - this.tileHeight/2);
                    
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.lineWidth = 0.8;
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                    this.ctx.lineWidth = 1;
                }
            }
        }
    }
    
    setupTerrainControls() {
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.id = 'terrainControls';

        // Add section headers
        const terrainHeader = document.createElement('div');
        terrainHeader.style.fontWeight = 'bold';
        terrainHeader.style.marginBottom = '10px';
        terrainHeader.textContent = 'Terrain Settings';
        controls.appendChild(terrainHeader);

        // Add map size selector
        const mapSizeContainer = document.createElement('div');
        mapSizeContainer.style.marginBottom = '15px';
        
        const mapSizeLabel = document.createElement('div');
        mapSizeLabel.textContent = 'Map Size:';
        mapSizeContainer.appendChild(mapSizeLabel);
        
        const mapSizeSelect = document.createElement('select');
        mapSizeSelect.style.width = '100%';
        mapSizeSelect.style.marginTop = '5px';
        
        const sizes = {
            '64 x 64 (Tiny)': 64,
            '128 x 128 (Default)': 128,
            '256 x 256 (Medium)': 256,
            '512 x 512 (Large)': 512,
            '1024 x 1024 (Huge)': 1024
        };
        
        Object.entries(sizes).forEach(([label, value]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            if (value === this.gameAPI.map.width) {
                option.selected = true;
            }
            mapSizeSelect.appendChild(option);
        });
        
        mapSizeSelect.onchange = () => {
            const newSize = parseInt(mapSizeSelect.value);
            this.gameAPI.setMapSize(newSize);
        };
        
        mapSizeContainer.appendChild(mapSizeSelect);
        controls.appendChild(mapSizeContainer);

        const settings = this.gameAPI.terrainSettings;
        const inputs = {
            scale: this.createSlider('Scale', 0.01, 0.2, settings.scale, 0.01),
            waterLevel: this.createSlider('Water Level', 0, 1, settings.waterLevel, 0.05),
            sandLevel: this.createSlider('Beach Size', 0, 1, settings.sandLevel, 0.05),
            darkGrassChance: this.createSlider('Dark Grass', 0, 1, settings.darkGrassChance, 0.05),
            octaves: this.createSlider('Detail Layers', 1, 5, settings.octaves, 1),
            persistence: this.createSlider('Detail Strength', 0, 1, settings.persistence, 0.1),
            lacunarity: this.createSlider('Detail Scale', 1, 4, settings.lacunarity, 0.1)
        };

        Object.values(inputs).forEach(input => {
            input.oninput = () => {
                this.gameAPI.updateTerrainSettings(
                    Object.fromEntries(
                        Object.entries(inputs).map(([key, input]) => [key, parseFloat(input.value)])
                    )
                );
            };
            controls.appendChild(input.parentElement);
        });

        const regenerateButton = document.createElement('button');
        regenerateButton.textContent = 'New Seed';
        regenerateButton.style.width = '100%';
        regenerateButton.style.marginBottom = '20px';
        regenerateButton.onclick = () => {
            this.gameAPI.updateTerrainSettings({
                seed: Math.random() * 10000,
                ...Object.fromEntries(
                    Object.entries(inputs).map(([key, input]) => [key, parseFloat(input.value)])
                )
            });
        };
        controls.appendChild(regenerateButton);

        // Add Debug Settings section
        const debugHeader = document.createElement('div');
        debugHeader.style.fontWeight = 'bold';
        debugHeader.style.marginBottom = '10px';
        debugHeader.textContent = 'Debug Settings';
        controls.appendChild(debugHeader);
        
        // Create debug checkboxes
        const debugSettings = {
            showTileInfo: this.createCheckbox('Show Tile Info', this.debug.showTileInfo),
            showGrid: this.createCheckbox('Show Grid', this.debug.showGrid),
            showNextTarget: this.createCheckbox('Show Next Target', this.debug.showNextTarget),
            showMobTiles: this.createCheckbox('Show Mob Tiles', this.debug.showMobTiles),
            showPlayerTile: this.createCheckbox('Show Player Tile', this.debug.showPlayerTile)
        };

        Object.entries(debugSettings).forEach(([key, checkbox]) => {
            checkbox.addEventListener('change', () => {
                this.debug[key] = checkbox.checked;
            });
            controls.appendChild(checkbox.parentElement);
        });

        document.body.appendChild(controls);
        
        // Setup separate mob controls
        this.setupMobControls();
    }

    setupMobControls() {
        const mobControls = document.createElement('div');
        mobControls.className = 'controls';
        mobControls.id = 'mobControls';

        // Add mob settings header
        const mobHeader = document.createElement('div');
        mobHeader.style.fontWeight = 'bold';
        mobHeader.style.marginBottom = '10px';
        mobHeader.textContent = 'Mob Settings';
        mobControls.appendChild(mobHeader);

        // Create sections for different mob types
        const sections = {
            'Fish': {
                maxFish: this.createSlider('Maximum', 10, 100, this.gameAPI.entitySettings.maxFish, 1),
                fishSpawnChance: this.createSlider('Spawn Rate', 0, 0.1, this.gameAPI.entitySettings.fishSpawnChance, 0.001)
            },
            'Land Animals': {
                maxPigs: this.createSlider('Max Pigs', 5, 50, this.gameAPI.entitySettings.maxPigs, 1),
                pigSpawnChance: this.createSlider('Pig Spawn Rate', 0, 0.1, this.gameAPI.entitySettings.pigSpawnChance, 0.001),
                maxCows: this.createSlider('Max Cows', 5, 50, this.gameAPI.entitySettings.maxCows, 1),
                cowSpawnChance: this.createSlider('Cow Spawn Rate', 0, 0.1, this.gameAPI.entitySettings.cowSpawnChance, 0.001)
            },
            'Predators': {
                maxWolves: this.createSlider('Max Wolves', 1, 20, this.gameAPI.entitySettings.maxWolves, 1),
                wolfSpawnChance: this.createSlider('Wolf Spawn Rate', 0, 0.1, this.gameAPI.entitySettings.wolfSpawnChance, 0.001),
                maxPackLeaders: this.createSlider('Max Pack Leaders', 1, 5, this.gameAPI.entitySettings.maxPackLeaders, 1)
            }
        };

        // Add each section
        for (const [sectionName, controls] of Object.entries(sections)) {
            const section = document.createElement('div');
            section.style.marginBottom = '20px';

            const sectionHeader = document.createElement('div');
            sectionHeader.style.fontWeight = 'bold';
            sectionHeader.style.marginBottom = '5px';
            sectionHeader.textContent = sectionName;
            section.appendChild(sectionHeader);

            Object.entries(controls).forEach(([key, input]) => {
                input.oninput = (e) => {
                    const newValue = parseFloat(e.target.value);
                    // Update both the game settings and the display
                    this.gameAPI.entitySettings[key] = parseFloat(input.value);
                    input.valueDisplay.textContent = newValue;
                };
                section.appendChild(input.parentElement);
            });

            mobControls.appendChild(section);
        }

        document.body.appendChild(mobControls);
    }

    createSlider(label, min, max, value, step) {
        const container = document.createElement('div');
        container.style.marginBottom = '5px';
        
        const labelElement = document.createElement('label');
        labelElement.textContent = `${label}: `;
        
        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.value = value;
        input.step = step;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = value;
        
        // Store the display element so we can update it
        input.valueDisplay = valueDisplay;
        
        container.appendChild(labelElement);
        container.appendChild(input);
        container.appendChild(valueDisplay);
        
        return input;
    }

    createCheckbox(label, initialValue) {
        const container = document.createElement('div');
        container.style.marginBottom = '5px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = initialValue;
        checkbox.style.marginRight = '8px';
        
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        
        return checkbox;
    }

    loadTexture(path) {
        const image = new Image();
        image.src = path;
        return image;
    }

    // Helper method for drawing rounded rectangles
    roundRect(x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
    }
}

// Start the game when the page loads
window.onload = () => {
    new IsometricGame();
}; 