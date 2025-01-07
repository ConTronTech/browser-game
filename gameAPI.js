class GameAPI {
    constructor() {
        this.entities = new Map();
        this.entityTypes = {
            PLAYER: 'player',
            FISH: 'fish',
            PIG: 'pig',
            COW: 'cow',
            WOLF: 'wolf'
        };
        
        // Entity settings
        this.entitySettings = {
            maxFish: 20,
            fishSpawnChance: 0.01,
            maxPigs: 15,
            pigSpawnChance: 0.01,
            maxCows: 10,
            cowSpawnChance: 0.01,
            maxWolves: 8,
            wolfSpawnChance: 0.005,
            wolfStarvationHunger: 95  // Wolves die when hunger reaches this level
        };

        this.tileTypes = {
            WATER: 0,
            GRASS: 1,
            SAND: 2,
            DARK_GRASS: 3
        };
        
        // Terrain generation settings
        this.terrainSettings = {
            scale: 0.05,         // Base scale of the noise
            waterLevel: 0.2,     // Water threshold
            sandLevel: 0.3,      // Beach threshold
            darkGrassChance: 0.6,    // Increased chance of dark grass (was 0.3)
            octaves: 3,          // Number of noise layers
            persistence: 0.5,    // How much each octave contributes
            lacunarity: 2.0,     // How much detail is added in each octave
            seed: Math.random() * 10000  // Random seed for generation
        };
        
        this.map = {
            data: [],
            width: 128,
            height: 128
        };

        // Initialize noise generator with seed
        this.noise = new PerlinNoise(this.terrainSettings.seed);
        this.generateTerrain();
        
        // Movement constants
        this.MOVEMENT_SPEEDS = {
            [this.tileTypes.GRASS]: 0.1,
            [this.tileTypes.SAND]: 0.1,
            [this.tileTypes.WATER]: 0.05
        };
        this.SPRINT_MULTIPLIER = 2.0;  // Sprint is 2x normal speed
    }

    generateTerrain() {
        const {scale, waterLevel, sandLevel, octaves, persistence, lacunarity} = this.terrainSettings;

        // Generate base terrain first
        this.map.data = new Array(this.map.height).fill(null).map((_, y) => 
            new Array(this.map.width).fill(null).map((_, x) => {
                let amplitude = 1;
                let frequency = 1;
                let noiseValue = 0;
                let maxValue = 0;

                // Combine multiple octaves of noise
                for(let i = 0; i < octaves; i++) {
                    const sampleX = x * scale * frequency;
                    const sampleY = y * scale * frequency;
                    
                    noiseValue += this.noise.noise(sampleX, sampleY) * amplitude;
                    maxValue += amplitude;
                    
                    amplitude *= persistence;
                    frequency *= lacunarity;
                }

                // Normalize the value
                noiseValue = noiseValue / maxValue;

                if (noiseValue < waterLevel) {
                    return this.tileTypes.WATER;
                } else if (noiseValue < sandLevel) {
                    return this.tileTypes.SAND;
                } else {
                    return this.tileTypes.GRASS;
                }
            })
        );

        // Add dark grass in a second pass
        this.addDarkGrass();

        // Find a valid spawn point
        this.spawnPoint = this.findSpawnPoint();
        
        // Then reset entities to valid positions
        this.resetEntities();
    }

    addDarkGrass() {
        // Create a new noise instance for dark grass distribution
        const darkGrassNoise = new PerlinNoise(this.terrainSettings.seed + 1);
        const darkGrassScale = 0.15;  // Increased scale for larger patches of dark grass

        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                // Only consider grass tiles
                if (this.map.data[y][x] === this.tileTypes.GRASS) {
                    // Check if any adjacent tile is sand
                    let adjacentToSand = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < this.map.width && ny >= 0 && ny < this.map.height) {
                                if (this.map.data[ny][nx] === this.tileTypes.SAND) {
                                    adjacentToSand = true;
                                    break;
                                }
                            }
                        }
                        if (adjacentToSand) break;
                    }

                    // If not adjacent to sand, consider making it dark grass
                    if (!adjacentToSand) {
                        const noiseValue = darkGrassNoise.noise(x * darkGrassScale, y * darkGrassScale);
                        // Modified threshold calculation for more dark grass
                        if (noiseValue > 0.4 - (this.terrainSettings.darkGrassChance * 0.4)) {
                            this.map.data[y][x] = this.tileTypes.DARK_GRASS;
                        }
                    }
                }
            }
        }
    }

    resetEntities() {
        // Use the already found spawn point for all entities
        for (let entity of this.entities.values()) {
            entity.x = this.spawnPoint.x;
            entity.y = this.spawnPoint.y;
        }
    }

    updateTerrainSettings(newSettings) {
        this.terrainSettings = {
            ...this.terrainSettings,
            ...newSettings
        };
        
        if (newSettings.seed !== undefined) {
            this.noise = new PerlinNoise(this.terrainSettings.seed);
        }
        
        this.generateTerrain();
        
        // Notify any listeners that entities have been repositioned
        if (this.onEntitiesReset) {
            this.onEntitiesReset();
        }
    }

    findSpawnPoint() {
        // Start searching from the middle of the map
        const centerX = Math.floor(this.map.width / 2);
        const centerY = Math.floor(this.map.height / 2);
        const searchRadius = 20; // Adjust this to control search area
        
        // Search in expanding squares around the center
        for (let r = 0; r < searchRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    // Check if coordinates are within map bounds
                    if (x >= 0 && x < this.map.width && y >= 0 && y < this.map.height) {
                        const tile = this.getTile(x, y);
                        if (tile === this.tileTypes.GRASS || tile === this.tileTypes.SAND) {
                            return { x, y };
                        }
                    }
                }
            }
        }
        
        // If no suitable spot found near center, search entire map
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.getTile(x, y);
                if (tile === this.tileTypes.GRASS || tile === this.tileTypes.SAND) {
                    return { x, y };
                }
            }
        }
        return { x: 1, y: 1 }; // Fallback
    }

    isWalkable(x, y) {
        const tile = this.getTile(x, y);
        return tile !== null; // Still allow walking everywhere, just spawn on land
    }

    // Map methods
    getTile(x, y) {
        // Get tile at floor of position
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);
        if (tileX < 0 || tileX >= this.map.width || tileY < 0 || tileY >= this.map.height) {
            return null;
        }
        return this.map.data[tileY][tileX];
    }

    // Entity methods
    createEntity(type, x, y) {
        const entity = {
            id: Date.now().toString(),
            type,
            x: parseFloat(x),
            y: parseFloat(y),
            velocityX: 0,
            velocityY: 0,
            isHunting: false,
            hunger: type === this.entityTypes.WOLF ? 0 : null,  // Only wolves get hungry
            fleeTarget: null,  // For prey animals to track what's chasing them
            huntTarget: null   // For wolves to track their prey
        };
        this.entities.set(entity.id, entity);
        return entity;
    }

    moveEntity(entityId, directionX, directionY, isSprinting = false) {
        const entity = this.entities.get(entityId);
        if (!entity) return false;

        // Normalize direction vector
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        if (length > 0) {
            directionX /= length;
            directionY /= length;
        }

        // Calculate new position
        const baseSpeed = this.getMovementSpeed(entity.x, entity.y);
        const speed = isSprinting ? baseSpeed * this.SPRINT_MULTIPLIER : baseSpeed;
        const newX = entity.x + directionX * speed;
        const newY = entity.y + directionY * speed;

        // Check if new position is in bounds
        if (this.getTile(newX, newY) !== null) {
            entity.x = newX;
            entity.y = newY;
            return true;
        }
        return false;
    }

    getMovementSpeed(x, y) {
        const tile = this.getTile(x, y);
        return this.MOVEMENT_SPEEDS[tile] || this.MOVEMENT_SPEEDS[this.tileTypes.GRASS];
    }

    removeEntity(entityId) {
        return this.entities.delete(entityId);
    }

    getEntitiesAt(x, y) {
        return Array.from(this.entities.values())
            .filter(entity => entity.x === x && entity.y === y);
    }

    updateEntities() {
        // Count and spawn fish
        const fishCount = Array.from(this.entities.values())
            .filter(entity => entity.type === this.entityTypes.FISH).length;
        if (fishCount < this.entitySettings.maxFish && Math.random() < this.entitySettings.fishSpawnChance) {
            this.spawnFish();
        }

        // Count and spawn pigs
        const pigCount = Array.from(this.entities.values())
            .filter(entity => entity.type === this.entityTypes.PIG).length;
        if (pigCount < this.entitySettings.maxPigs && Math.random() < this.entitySettings.pigSpawnChance) {
            this.spawnLandAnimal(this.entityTypes.PIG);
        }

        // Count and spawn cows
        const cowCount = Array.from(this.entities.values())
            .filter(entity => entity.type === this.entityTypes.COW).length;
        if (cowCount < this.entitySettings.maxCows && Math.random() < this.entitySettings.cowSpawnChance) {
            this.spawnLandAnimal(this.entityTypes.COW);
        }

        // Count and spawn wolves
        const wolfCount = Array.from(this.entities.values())
            .filter(entity => entity.type === this.entityTypes.WOLF).length;
        if (wolfCount < this.entitySettings.maxWolves && Math.random() < this.entitySettings.wolfSpawnChance) {
            this.spawnWolf();
        }

        // Update all entities
        for (let entity of this.entities.values()) {
            if (entity.type === this.entityTypes.FISH) {
                this.updateFish(entity);
            } else if (entity.type === this.entityTypes.PIG || entity.type === this.entityTypes.COW) {
                this.updateLandAnimal(entity);
            } else if (entity.type === this.entityTypes.WOLF) {
                this.updateWolf(entity);
            }
        }
    }

    spawnFish() {
        // Find a random water tile
        let attempts = 100;  // Limit attempts to prevent infinite loop
        while (attempts > 0) {
            const x = Math.floor(Math.random() * this.map.width);
            const y = Math.floor(Math.random() * this.map.height);
            
            if (this.getTile(x, y) === this.tileTypes.WATER) {
                const fish = this.createEntity(this.entityTypes.FISH, x, y);
                fish.moveTimer = Math.random() * 100;  // Random initial timer
                fish.moveDirection = Math.random() * Math.PI * 2;  // Random direction
                return fish;
            }
            attempts--;
        }
    }

    updateFish(fish) {
        // Change direction occasionally
        fish.moveTimer--;
        if (fish.moveTimer <= 0) {
            fish.moveTimer = 50 + Math.random() * 100;  // Reset timer
            fish.moveDirection = Math.random() * Math.PI * 2;  // New random direction
        }
        
        // Move in current direction
        const speed = 0.02;  // Slower than player
        const dx = Math.cos(fish.moveDirection) * speed;
        const dy = Math.sin(fish.moveDirection) * speed;
        
        // Try to move, if hit boundary or land, change direction
        const newX = fish.x + dx;
        const newY = fish.y + dy;
        
        if (this.getTile(newX, newY) === this.tileTypes.WATER) {
            fish.x = newX;
            fish.y = newY;
        } else {
            fish.moveDirection = Math.random() * Math.PI * 2;  // Change direction if blocked
        }
    }

    spawnLandAnimal(type) {
        let attempts = 100;
        while (attempts > 0) {
            const x = Math.floor(Math.random() * this.map.width);
            const y = Math.floor(Math.random() * this.map.height);
            const tile = this.getTile(x, y);
            
            if (tile !== null && tile !== this.tileTypes.WATER) {
                const animal = this.createEntity(type, x, y);
                animal.moveTimer = Math.random() * 200;
                animal.moveDirection = Math.random() * Math.PI * 2;
                return animal;
            }
            attempts--;
        }
    }

    updateLandAnimal(animal) {
        // Check if being hunted or near hungry wolf
        if (animal.fleeTarget) {
            // Calculate direction away from predator
            const dx = animal.x - animal.fleeTarget.x;
            const dy = animal.y - animal.fleeTarget.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only stop fleeing if we're very far away and the wolf isn't actively hunting
            if (distance > 15 && !animal.fleeTarget.isHunting && animal.fleeTarget.hunger < 60) {
                animal.fleeTarget = null;
            } else {
                // Flee from predator
                animal.moveDirection = Math.atan2(dy, dx);
                // Increase base speed and boost when being chased
                const baseSpeed = 0.04;
                const speedBoost = Math.max(0, (12 - distance) / 12) * 0.02;
                const speed = baseSpeed + speedBoost;
                
                const newX = animal.x + Math.cos(animal.moveDirection) * speed;
                const newY = animal.y + Math.sin(animal.moveDirection) * speed;
                
                const newTile = this.getTile(newX, newY);
                // Try to move in flee direction
                if ((animal.type === this.entityTypes.FISH && newTile === this.tileTypes.WATER) ||
                    (animal.type !== this.entityTypes.FISH && newTile !== this.tileTypes.WATER)) {
                    animal.x = newX;
                    animal.y = newY;
                } else {
                    // If blocked, try to find another escape route
                    const escapeAngles = [
                        Math.PI/6, -Math.PI/6,   // 30 degrees
                        Math.PI/4, -Math.PI/4,   // 45 degrees
                        Math.PI/3, -Math.PI/3,   // 60 degrees
                        Math.PI/2, -Math.PI/2    // 90 degrees
                    ];
                    for (let angle of escapeAngles) {
                        const newDirection = animal.moveDirection + angle;
                        const altX = animal.x + Math.cos(newDirection) * speed;
                        const altY = animal.y + Math.sin(newDirection) * speed;
                        const altTile = this.getTile(altX, altY);
                        
                        if ((animal.type === this.entityTypes.FISH && altTile === this.tileTypes.WATER) ||
                            (animal.type !== this.entityTypes.FISH && altTile !== this.tileTypes.WATER)) {
                            animal.x = altX;
                            animal.y = altY;
                            animal.moveDirection = newDirection;
                            break;
                        }
                    }
                }
                return;
            }
        }
        
        // Normal movement when not fleeing
        animal.moveTimer--;
        if (animal.moveTimer <= 0) {
            animal.moveTimer = 150 + Math.random() * 200;
            animal.moveDirection = Math.random() * Math.PI * 2;
            animal.isMoving = Math.random() < 0.7;
        }
        
        if (animal.isMoving && !animal.fleeTarget) {
            const speed = 0.015;
            const dx = Math.cos(animal.moveDirection) * speed;
            const dy = Math.sin(animal.moveDirection) * speed;
            
            const newX = animal.x + dx;
            const newY = animal.y + dy;
            
            const newTile = this.getTile(newX, newY);
            if (newTile !== null && newTile !== this.tileTypes.WATER) {
                animal.x = newX;
                animal.y = newY;
            } else {
                animal.moveDirection = Math.random() * Math.PI * 2;
            }
        }
    }

    spawnWolf() {
        let attempts = 100;
        while (attempts > 0) {
            const x = Math.floor(Math.random() * this.map.width);
            const y = Math.floor(Math.random() * this.map.height);
            const tile = this.getTile(x, y);
            
            // Wolves spawn on grass or dark grass
            if (tile === this.tileTypes.GRASS || tile === this.tileTypes.DARK_GRASS) {
                const wolf = this.createEntity(this.entityTypes.WOLF, x, y);
                wolf.moveTimer = Math.random() * 150;
                wolf.moveDirection = Math.random() * Math.PI * 2;
                wolf.isMoving = true;  // Wolves are more active
                return wolf;
            }
            attempts--;
        }
    }

    updateWolf(wolf) {
        // Update hunger (increases over time)
        wolf.hunger += 0.02;
        
        // Check for starvation
        if (wolf.hunger >= this.entitySettings.wolfStarvationHunger) {
            this.removeEntity(wolf.id);
            return;
        }
        
        // Alert nearby prey if wolf is getting hungry
        if (wolf.hunger > 60) {
            this.alertNearbyPrey(wolf);
        }
        
        // Start hunting when hungry enough
        if (wolf.hunger > 70 && !wolf.isHunting) {
            wolf.isHunting = true;
            // Clear any existing hunt target when starting a new hunt
            wolf.huntTarget = null;
        }
        
        if (wolf.isHunting) {
            // Find closest prey if we don't have a target
            if (!wolf.huntTarget) {
                wolf.huntTarget = this.findClosestPrey(wolf);
                // If no prey found and very hungry, increase search radius
                if (!wolf.huntTarget && wolf.hunger > 85) {
                    wolf.huntTarget = this.findClosestPrey(wolf, 20);  // Larger search radius when desperate
                }
            }
            
            if (wolf.huntTarget) {
                // Calculate direction to prey
                const dx = wolf.huntTarget.x - wolf.x;
                const dy = wolf.huntTarget.y - wolf.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If we caught the prey
                if (distance < 0.5) {
                    this.removeEntity(wolf.huntTarget.id);
                    wolf.hunger = 0;  // Reset hunger
                    wolf.isHunting = false;
                    wolf.huntTarget = null;
                    return;
                }
                
                // Chase the prey
                wolf.moveDirection = Math.atan2(dy, dx);
                const speed = 0.04;  // Faster when hunting
                const newX = wolf.x + Math.cos(wolf.moveDirection) * speed;
                const newY = wolf.y + Math.sin(wolf.moveDirection) * speed;
                
                // Move if the new position is valid
                if (this.getTile(newX, newY) !== null) {
                    wolf.x = newX;
                    wolf.y = newY;
                }
                
                // Alert prey that it's being hunted
                wolf.huntTarget.fleeTarget = wolf;
            }
            else {
                // If no prey found, keep moving randomly but faster
                const speed = 0.035;  // Faster searching speed when hungry
                const dx = Math.cos(wolf.moveDirection) * speed;
                const dy = Math.sin(wolf.moveDirection) * speed;
                
                const newX = wolf.x + dx;
                const newY = wolf.y + dy;
                
                if (this.getTile(newX, newY) !== null) {
                    wolf.x = newX;
                    wolf.y = newY;
                } else {
                    wolf.moveDirection = Math.random() * Math.PI * 2;
                }
            }
        } else {
            // More active movement when not hunting
            wolf.moveTimer--;
            if (wolf.moveTimer <= 0) {
                // Shorter pauses between movements
                wolf.moveTimer = 30 + Math.random() * 70;
                wolf.moveDirection = Math.random() * Math.PI * 2;
                wolf.isMoving = Math.random() < 0.8;  // 80% chance to move
            }
            
            if (wolf.isMoving) {
                const speed = 0.025;  // Normal walking speed
                const dx = Math.cos(wolf.moveDirection) * speed;
                const dy = Math.sin(wolf.moveDirection) * speed;
                
                const newX = wolf.x + dx;
                const newY = wolf.y + dy;
                
                // Wolves can move on any valid tile
                if (this.getTile(newX, newY) !== null) {
                    wolf.x = newX;
                    wolf.y = newY;
                } else {
                    wolf.moveDirection = Math.random() * Math.PI * 2;
                }
            }
        }
    }

    findClosestPrey(wolf, searchRadius = 10) {
        let closestPrey = null;
        let closestDistance = Infinity;
        
        for (let entity of this.entities.values()) {
            if (entity.type === this.entityTypes.PIG || 
                entity.type === this.entityTypes.COW || 
                entity.type === this.entityTypes.FISH) {
                
                const dx = entity.x - wolf.x;
                const dy = entity.y - wolf.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < closestDistance && distance < searchRadius) {
                    closestDistance = distance;
                    closestPrey = entity;
                }
            }
        }
        
        return closestPrey;
    }

    alertNearbyPrey(wolf) {
        const alertRadius = 8;  // How far prey can detect a hungry wolf
        
        for (let entity of this.entities.values()) {
            if (entity.type === this.entityTypes.PIG || 
                entity.type === this.entityTypes.COW || 
                entity.type === this.entityTypes.FISH) {
                
                const dx = entity.x - wolf.x;
                const dy = entity.y - wolf.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If prey is within alert radius of hungry wolf
                if (distance < alertRadius) {
                    entity.fleeTarget = wolf;
                }
            }
        }
    }
} 