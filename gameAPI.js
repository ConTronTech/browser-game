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
        
        // Map size presets
        this.mapSizes = {
            TINY: 64,
            SMALL: 128,
            MEDIUM: 256,
            LARGE: 512,
            HUGE: 1024
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
            wolfStarvationHunger: 95,
            wolfPackChance: 0.7,
            maxPackSize: 4,
            packFollowDistance: 3,
            packSpreadDistance: 2,
            maxPackLeaders: 1  // Maximum number of pack leaders allowed
        };

        this.tileTypes = {
            WATER: 0,
            GRASS: 1,
            SAND: 2,
            DARK_GRASS: 3
        };
        
        // Foliage settings
        this.foliage = {
            trees: new Map(),  // Store tree positions
            treeChance: 0.1,   // 10% chance for a tree on valid tiles
            minTreeSpacing: 2,  // Minimum tiles between trees
            grass: new Map(),   // Store grass positions
            grassChance: 0.3,   // 30% chance for grass on valid tiles
            minGrassSpacing: 1,  // Minimum tiles between grass patches
            rocks: new Map(),
            rockChance: 0.05,    // 5% chance for rocks
            minRockSpacing: 2    // Minimum tiles between rocks
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
            width: this.mapSizes.SMALL,  // Default to 128x128
            height: this.mapSizes.SMALL
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

        // Inventory system
        this.inventoryItems = {
            MEAT: 'meat',
            FISH: 'fish',
            BONE: 'bone',
            WOOD: 'wood',
            ROCK_SHARD: 'rock_shard',
            HIDE: 'hide'
        };
        
        // Initialize inventory slots with objects that track item type and count
        this.inventory = new Array(12).fill(null).map(() => ({
            item: null,
            count: 0
        }));

        // Interaction settings
        this.interactionRange = 1.5;  // How far player can interact
        this.interactableTypes = {
            TREE: 'tree',
            ROCK: 'rock',
            GRASS: 'grass'
        };

        // Harvesting settings
        this.harvestSettings = {
            woodChance: 0.7,     // Base chance to get wood
            axeWoodBonus: 0.2,   // Additional 20% chance with axe
            axeWoodAmount: 2,    // Get 2 wood pieces when using axe
            rockChance: 0.5,     // 50% chance to get rock shard
            axeRemoveBonus: 0.2, // Additional 20% chance to remove with axe
            removeChance: 0.3,   // Base chance to remove resource
            boneChance: 0.2,     // 20% chance to get bone from prey
            hideChance: 0.4,     // 40% chance to get hide from cows
            preyDamage: 25,      // Damage dealt to prey per interaction
            preyHealth: {        // Base health for different prey types
                [this.entityTypes.FISH]: 50,
                [this.entityTypes.PIG]: 75,
                [this.entityTypes.COW]: 100
            }
        };

        // Crafting system
        this.craftingRecipes = {
            'rope': {
                ingredients: { 'hide': 1 },
                result: 'rope',
                count: 2
            },
            'stone_axe': {
                ingredients: {
                    'wood': 2,
                    'rock_shard': 3,
                    'rope': 1
                },
                result: 'stone_axe',
                count: 1
            }
        };
    }

    setMapSize(size) {
        this.map.width = size;
        this.map.height = size;
        
        // Clear all existing entities except player
        for (let [id, entity] of this.entities.entries()) {
            if (entity.type !== this.entityTypes.PLAYER) {
                this.entities.delete(id);
            }
        }
        
        // Regenerate noise with current seed
        this.noise = new PerlinNoise(this.terrainSettings.seed);
        
        this.generateTerrain();
        
        // Find new spawn point and move player there
        const player = Array.from(this.entities.values())
            .find(entity => entity.type === this.entityTypes.PLAYER);
        if (player) {
            player.x = this.spawnPoint.x;
            player.y = this.spawnPoint.y;
        }
        
        if (this.onEntitiesReset) {
            this.onEntitiesReset();
        }
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

        // Generate grass patches before trees
        this.generateGrass();
        
        // Generate rocks
        this.generateRocks();
        
        // Generate trees after terrain is complete
        this.generateTrees();

        // Find a valid spawn point
        this.spawnPoint = this.findSpawnPoint();
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

    generateGrass() {
        // Clear existing grass
        this.foliage.grass.clear();
        
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.map.data[y][x];
                
                // Only place grass on dark grass tiles
                if (tile === this.tileTypes.DARK_GRASS && 
                    Math.random() < this.foliage.grassChance) {
                    
                    // Check minimum spacing from other grass
                    let canPlaceGrass = true;
                    const spacing = this.foliage.minGrassSpacing;
                    
                    for (let dy = -spacing; dy <= spacing; dy++) {
                        for (let dx = -spacing; dx <= spacing; dx++) {
                            const checkX = x + dx;
                            const checkY = y + dy;
                            if (this.foliage.grass.has(`${checkX},${checkY}`)) {
                                canPlaceGrass = false;
                                break;
                            }
                        }
                        if (!canPlaceGrass) break;
                    }
                    
                    if (canPlaceGrass) {
                        this.foliage.grass.set(`${x},${y}`, {
                            x: x,
                            y: y,
                            type: Math.floor(Math.random() * 3)  // Random grass variant (0-2)
                        });
                    }
                }
            }
        }
    }

    // Helper to check if a position has grass
    hasGrass(x, y) {
        return this.foliage.grass.has(`${Math.floor(x)},${Math.floor(y)}`);
    }

    // Get grass data at position
    getGrass(x, y) {
        return this.foliage.grass.get(`${Math.floor(x)},${Math.floor(y)}`);
    }

    generateRocks() {
        // Clear existing rocks
        this.foliage.rocks.clear();
        
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.map.data[y][x];
                
                // Place rocks on any tile except water
                if (tile !== this.tileTypes.WATER && 
                    Math.random() < this.foliage.rockChance) {
                    
                    // Check minimum spacing from other rocks
                    let canPlaceRock = true;
                    const spacing = this.foliage.minRockSpacing;
                    
                    for (let dy = -spacing; dy <= spacing; dy++) {
                        for (let dx = -spacing; dx <= spacing; dx++) {
                            const checkX = x + dx;
                            const checkY = y + dy;
                            if (this.foliage.rocks.has(`${checkX},${checkY}`)) {
                                canPlaceRock = false;
                                break;
                            }
                        }
                        if (!canPlaceRock) break;
                    }
                    
                    if (canPlaceRock) {
                        this.foliage.rocks.set(`${x},${y}`, {
                            x: x,
                            y: y,
                            type: Math.floor(Math.random() * 3)  // Random rock variant (0-2)
                        });
                    }
                }
            }
        }
    }

    // Helper to check if a position has a rock
    hasRock(x, y) {
        return this.foliage.rocks.has(`${Math.floor(x)},${Math.floor(y)}`);
    }

    // Get rock data at position
    getRock(x, y) {
        return this.foliage.rocks.get(`${Math.floor(x)},${Math.floor(y)}`);
    }

    generateTrees() {
        // Clear existing trees
        this.foliage.trees.clear();
        
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.map.data[y][x];
                
                // Only place trees on grass or dark grass
                if ((tile === this.tileTypes.GRASS || tile === this.tileTypes.DARK_GRASS) && 
                    Math.random() < this.foliage.treeChance) {
                    
                    // Check minimum spacing from other trees
                    let canPlaceTree = true;
                    const spacing = this.foliage.minTreeSpacing;
                    
                    for (let dy = -spacing; dy <= spacing; dy++) {
                        for (let dx = -spacing; dx <= spacing; dx++) {
                            const checkX = x + dx;
                            const checkY = y + dy;
                            if (this.foliage.trees.has(`${checkX},${checkY}`)) {
                                canPlaceTree = false;
                                break;
                            }
                        }
                        if (!canPlaceTree) break;
                    }
                    
                    if (canPlaceTree) {
                        this.foliage.trees.set(`${x},${y}`, {
                            x: x,
                            y: y,
                            type: Math.floor(Math.random() * 4)  // Random tree variant (0-3)
                        });
                    }
                }
            }
        }
    }

    // Helper to check if a position has a tree
    hasTree(x, y) {
        return this.foliage.trees.has(`${Math.floor(x)},${Math.floor(y)}`);
    }

    // Get tree data at position
    getTree(x, y) {
        return this.foliage.trees.get(`${Math.floor(x)},${Math.floor(y)}`);
    }

    resetEntities() {
        // Use the already found spawn point for all entities
        for (let entity of this.entities.values()) {
            entity.x = this.spawnPoint.x;
            entity.y = this.spawnPoint.y;
        }
    }

    updateTerrainSettings(newSettings) {
        // Update terrain settings
        Object.assign(this.terrainSettings, newSettings);
        
        // Regenerate terrain with new settings
        this.generateTerrain();
        
        // Clear all existing entities except player
        for (let [id, entity] of this.entities.entries()) {
            if (entity.type !== this.entityTypes.PLAYER) {
                this.entities.delete(id);
            }
        }
        
        // Find new spawn point and move player there
        this.spawnPoint = this.findSpawnPoint();
        const player = Array.from(this.entities.values())
            .find(entity => entity.type === this.entityTypes.PLAYER);
        if (player) {
            player.x = this.spawnPoint.x;
            player.y = this.spawnPoint.y;
        }
        
        // Notify game to update camera
        if (this.onEntitiesReset) this.onEntitiesReset();
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
        // Check if position is within map bounds
        if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) {
            return null;
        }
        
        const entity = {
            id: Date.now().toString(),
            type,
            x: parseFloat(x),
            y: parseFloat(y),
            health: this.harvestSettings.preyHealth[type] || null,  // Set initial health for prey
            velocityX: 0,
            velocityY: 0,
            isHunting: false,
            hunger: type === this.entityTypes.WOLF ? 0 : null,
            fleeTarget: null,
            huntTarget: null,
            packLeader: null,
            packMembers: [],
            wantsPack: false,
            isPackLeader: false,
            spottedPrey: null,
            alertedPrey: null
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
            // Keep spawns well within map boundaries
            const safeMargin = 5;  // Larger margin to keep mobs away from edges
            const x = safeMargin + Math.floor(Math.random() * (this.map.width - safeMargin * 2));
            const y = safeMargin + Math.floor(Math.random() * (this.map.height - safeMargin * 2));
            
            const tile = this.getTile(x, y);
            
            // Double check that position is valid and within bounds
            if (x >= 0 && x < this.map.width && 
                y >= 0 && y < this.map.height && 
                tile !== null && 
                tile !== this.tileTypes.WATER) {
                const animal = this.createEntity(type, x, y);
                if (animal) {
                    animal.moveTimer = Math.random() * 200;
                    animal.moveDirection = Math.random() * Math.PI * 2;
                    return animal;
                }
            }
            attempts--;
        }
        
        // If no valid spawn found after all attempts, try center of map
        const centerX = Math.floor(this.map.width / 2);
        const centerY = Math.floor(this.map.height / 2);
        if (this.getTile(centerX, centerY) !== this.tileTypes.WATER) {
            const animal = this.createEntity(type, centerX, centerY);
            if (animal) {
                animal.moveTimer = Math.random() * 200;
                animal.moveDirection = Math.random() * Math.PI * 2;
                return animal;
            }
        }
        return null;  // Return null if no valid spawn position found
    }

    updateLandAnimal(animal) {
        // Boundary margin
        const margin = 2;
        
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
                
                let newX = animal.x + Math.cos(animal.moveDirection) * speed;
                let newY = animal.y + Math.sin(animal.moveDirection) * speed;
                
                // Keep within map boundaries
                newX = Math.max(margin, Math.min(this.map.width - margin, newX));
                newY = Math.max(margin, Math.min(this.map.height - margin, newY));
                
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
                        let altX = animal.x + Math.cos(newDirection) * speed;
                        let altY = animal.y + Math.sin(newDirection) * speed;
                        
                        // Keep alternate positions within boundaries too
                        altX = Math.max(margin, Math.min(this.map.width - margin, altX));
                        altY = Math.max(margin, Math.min(this.map.height - margin, altY));
                        
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
            let newX = animal.x + Math.cos(animal.moveDirection) * speed;
            let newY = animal.y + Math.sin(animal.moveDirection) * speed;
            
            // Keep within map boundaries
            newX = Math.max(margin, Math.min(this.map.width - margin, newX));
            newY = Math.max(margin, Math.min(this.map.height - margin, newY));
            
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
            
            if (tile === this.tileTypes.GRASS || tile === this.tileTypes.DARK_GRASS) {
                const wolf = this.createEntity(this.entityTypes.WOLF, x, y);
                wolf.moveTimer = Math.random() * 150;
                wolf.moveDirection = Math.random() * Math.PI * 2;
                wolf.isMoving = true;
                wolf.wantsPack = Math.random() < this.entitySettings.wolfPackChance;
                return wolf;
            }
            attempts--;
        }
    }

    updateWolf(wolf) {
        // Helper function to find distance to nearest land
        const findDistanceToLand = (x, y, maxSearch = 5) => {
            let minDistance = Infinity;
            let nearestLandX = null;
            let nearestLandY = null;
            
            for (let dx = -maxSearch; dx <= maxSearch; dx++) {
                for (let dy = -maxSearch; dy <= maxSearch; dy++) {
                    const checkX = Math.floor(x + dx);
                    const checkY = Math.floor(y + dy);
                    const tile = this.getTile(checkX, checkY);
                    if (tile !== null && tile !== this.tileTypes.WATER) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestLandX = checkX;
                            nearestLandY = checkY;
                        }
                    }
                }
            }
            return { distance: minDistance, x: nearestLandX, y: nearestLandY };
        };

        // Check for nearby prey and alert pack
        if (!wolf.isHunting && wolf.packLeader) {
            const nearbyPrey = this.findClosestPrey(wolf, 15);  // Larger search radius for spotting
            if (nearbyPrey && nearbyPrey !== wolf.packLeader.huntTarget) {
                wolf.spottedPrey = nearbyPrey;
                wolf.packLeader.alertedPrey = nearbyPrey;
            } else {
                wolf.spottedPrey = null;
            }
        }
        
        // Try to join or create a pack if wolf wants one
        this.findOrCreatePack(wolf);
        
        // Pack leader recruitment behavior
        if (wolf.isPackLeader && wolf.hunger < 40 && wolf.packMembers.length < this.entitySettings.maxPackSize) {
            this.seekPackMembers(wolf);
        }

        // Update hunger (increases over time)
        wolf.hunger += 0.02;
        
        // Check for starvation
        if (wolf.hunger >= this.entitySettings.wolfStarvationHunger) {
            // If this wolf dies, update pack relationships
            if (wolf.isPackLeader) {
                // Dissolve the pack if leader dies
                for (let member of wolf.packMembers) {
                    member.packLeader = null;
                    member.wantsPack = Math.random() < this.entitySettings.wolfPackChance;
                }
            } else if (wolf.packLeader) {
                // Remove from pack if member dies
                const index = wolf.packLeader.packMembers.indexOf(wolf);
                if (index > -1) {
                    wolf.packLeader.packMembers.splice(index, 1);
                }
            }
            this.removeEntity(wolf.id);
            return;
        }

        // Pack behavior
        if (wolf.packLeader) {
            // Follow pack leader
            this.followPackLeader(wolf);
            // Share hunting target with pack
            if (wolf.packLeader.huntTarget) {
                wolf.huntTarget = wolf.packLeader.huntTarget;
                wolf.isHunting = true;
            }
        } else if (wolf.isPackLeader && wolf.packMembers.length > 0) {
            // Pack leaders coordinate hunting
            if (wolf.isHunting && wolf.huntTarget) {
                // Spread pack members around the target
                this.coordinatePackHunt(wolf);
            }
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
            // Regularly check for closer prey, especially when very hungry
            if (!wolf.huntTarget || Math.random() < 0.05) {
                // Check alerted prey first if leader
                if (wolf.isPackLeader && wolf.alertedPrey) {
                    wolf.huntTarget = wolf.alertedPrey;
                    wolf.alertedPrey = null;
                } else {
                    wolf.huntTarget = this.findClosestPrey(wolf);
                }
                // If no prey found and very hungry, increase search radius
                if (!wolf.huntTarget && wolf.hunger > 85) {
                    wolf.huntTarget = this.findClosestPrey(wolf, 20);
                }
            }
            
            if (wolf.huntTarget) {
                // Verify target still exists (hasn't been eaten by another wolf)
                if (!this.entities.has(wolf.huntTarget.id)) {
                    wolf.huntTarget = null;
                    return;
                }
                
                // Calculate direction to prey
                const dx = wolf.huntTarget.x - wolf.x;
                const dy = wolf.huntTarget.y - wolf.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Switch targets if current target is too far away
                if (distance > 15) {  // If target is too far
                    const closerPrey = this.findClosestPrey(wolf, 10);  // Look for closer prey
                    if (closerPrey) {
                        wolf.huntTarget = closerPrey;
                        return;  // Restart the hunt with new target
                    }
                }
                
                // If we caught the prey
                if (distance < 0.5) {
                    this.removeEntity(wolf.huntTarget.id);
                    // Clear hunt target before resetting hunger
                    const target = wolf.huntTarget;
                    wolf.huntTarget = null;
                    wolf.isHunting = false;
                    
                    // Share food with pack
                    if (wolf.isPackLeader) {
                        // Reset leader and all pack members' hunger
                        wolf.hunger = 0;
                        for (let member of wolf.packMembers) {
                            member.hunger = 0;
                            member.isHunting = false;
                            member.huntTarget = null;
                        }
                    } else if (wolf.packLeader) {
                        // Reset leader and all pack members' hunger
                        wolf.packLeader.hunger = 0;
                        wolf.packLeader.isHunting = false;
                        wolf.packLeader.huntTarget = null;
                        wolf.hunger = 0;
                        for (let member of wolf.packLeader.packMembers) {
                            member.hunger = 0;
                            member.isHunting = false;
                            member.huntTarget = null;
                        }
                    } else {
                        // Lone wolf just resets own hunger
                        wolf.hunger = 0;
                    }
                    return;
                }
                
                // Chase the prey
                wolf.moveDirection = Math.atan2(dy, dx);
                const baseSpeed = 0.04;
                const hungerBoost = (wolf.hunger / 100) * 0.02;
                const speed = baseSpeed + hungerBoost;
                
                const newX = wolf.x + Math.cos(wolf.moveDirection) * speed;
                const newY = wolf.y + Math.sin(wolf.moveDirection) * speed;
                
                // Check distance to nearest land from new position
                const landInfo = findDistanceToLand(newX, newY);
                
                const currentTile = this.getTile(wolf.x, wolf.y);
                const newTile = this.getTile(newX, newY);
                const targetTile = this.getTile(wolf.huntTarget.x, wolf.huntTarget.y);
                
                // Allow water movement if:
                // 1. Hunting water prey OR
                // 2. Close to land (within 3 tiles) OR
                // 3. Very hungry (>80) and prey is in sight
                const canMoveInWater = 
                    (targetTile === this.tileTypes.WATER && wolf.huntTarget) ||
                    landInfo.distance <= 3 ||
                    (wolf.hunger > 80 && distance < 5);
                
                if (newTile !== null && (newTile !== this.tileTypes.WATER || canMoveInWater)) {
                    wolf.x = newX;
                    wolf.y = newY;
                } else {
                    // If in water and far from land, move towards nearest land
                    if (currentTile === this.tileTypes.WATER) {
                        const nearestLand = findDistanceToLand(wolf.x, wolf.y);
                        if (nearestLand.x !== null) {
                            // Move towards nearest land
                            const dx = nearestLand.x - wolf.x;
                            const dy = nearestLand.y - wolf.y;
                            wolf.moveDirection = Math.atan2(dy, dx);
                            const escapeSpeed = 0.05;  // Slightly faster to escape water
                            wolf.x += Math.cos(wolf.moveDirection) * escapeSpeed;
                            wolf.y += Math.sin(wolf.moveDirection) * escapeSpeed;
                        } else {
                            // If no land found in search radius, pick a random direction
                            wolf.moveDirection = Math.random() * Math.PI * 2;
                        }
                    } else {
                        // If blocked by terrain, try to find a new target
                        wolf.huntTarget = this.findClosestPrey(wolf);
                    }
                }
                
                // Try to get back to land if too far from shore
                if (currentTile === this.tileTypes.WATER && 
                    (!wolf.huntTarget || targetTile !== this.tileTypes.WATER) &&
                    findDistanceToLand(wolf.x, wolf.y) > 3) {
                    // Look for nearby land
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                        const checkX = wolf.x + Math.cos(angle) * speed * 2;
                        const checkY = wolf.y + Math.sin(angle) * speed * 2;
                        const checkTile = this.getTile(checkX, checkY);
                        if (checkTile !== null && checkTile !== this.tileTypes.WATER) {
                            wolf.x = checkX;
                            wolf.y = checkY;
                            break;
                        }
                    }
                }
                
                // Alert prey that it's being hunted
                if (wolf.huntTarget) {
                    wolf.huntTarget.fleeTarget = wolf;
                }
            }
            else {
                // If no target found, move randomly but faster
                const speed = 0.035;
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
            // Normal movement (when not hunting)
            wolf.moveTimer--;
            if (wolf.moveTimer <= 0) {
                wolf.moveTimer = 30 + Math.random() * 70;
                wolf.moveDirection = Math.random() * Math.PI * 2;
                wolf.isMoving = Math.random() < 0.8;
            }
            
            if (wolf.isMoving) {
                const speed = 0.025;  // Normal walking speed
                const dx = Math.cos(wolf.moveDirection) * speed;
                const dy = Math.sin(wolf.moveDirection) * speed;
                
                const newX = wolf.x + dx;
                const newY = wolf.y + dy;
                
                const currentTile = this.getTile(wolf.x, wolf.y);
                const newTile = this.getTile(newX, newY);
                const landInfo = findDistanceToLand(newX, newY);
                
                // If currently in water, actively seek land
                if (currentTile === this.tileTypes.WATER) {
                    const nearestLand = findDistanceToLand(wolf.x, wolf.y, 10); // Increased search radius
                    if (nearestLand.x !== null) {
                        // Move directly towards nearest land
                        const dx = nearestLand.x - wolf.x;
                        const dy = nearestLand.y - wolf.y;
                        wolf.moveDirection = Math.atan2(dy, dx);
                        const escapeSpeed = 0.04; // Faster movement to escape water
                        wolf.x += Math.cos(wolf.moveDirection) * escapeSpeed;
                        wolf.y += Math.sin(wolf.moveDirection) * escapeSpeed;
                    }
                } else if (newTile !== null && newTile !== this.tileTypes.WATER) {
                    wolf.x = newX;
                    wolf.y = newY;
                } else {
                    // If would move into water, change direction
                    wolf.moveDirection = Math.random() * Math.PI * 2;
                }
            }
        }
    }

    findClosestPrey(wolf, searchRadius = 10) {
        let closestPrey = null;
        let closestDistance = Infinity;
        let waterPrey = null;
        let waterPreyDistance = Infinity;
        
        for (let entity of this.entities.values()) {
            if (entity.type === this.entityTypes.PIG || 
                entity.type === this.entityTypes.COW || 
                entity.type === this.entityTypes.FISH) {
                
                const dx = entity.x - wolf.x;
                const dy = entity.y - wolf.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Check if prey is in water
                const preyInWater = this.getTile(entity.x, entity.y) === this.tileTypes.WATER;
                
                if (distance < searchRadius && distance < closestDistance) {
                    // Always track the absolute closest prey
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

    findOrCreatePack(wolf) {
        if (!wolf.wantsPack || wolf.packLeader || wolf.isPackLeader) return;

        // Count current pack leaders
        let currentLeaders = Array.from(this.entities.values())
            .filter(entity => entity.type === this.entityTypes.WOLF && entity.isPackLeader)
            .length;

        // Look for existing packs that aren't full
        for (let entity of this.entities.values()) {
            if (entity.type === this.entityTypes.WOLF && 
                entity.isPackLeader && 
                entity.packMembers.length < this.entitySettings.maxPackSize) {
                
                const dx = entity.x - wolf.x;
                const dy = entity.y - wolf.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Join nearby pack if found
                if (distance < 10) {
                    wolf.packLeader = entity;
                    entity.packMembers.push(wolf);
                    return;
                }
            }
        }

        // If no suitable pack found, maybe become a pack leader (more likely when few leaders exist)
        const leaderChance = 0.3 * (1 - (currentLeaders / this.entitySettings.maxPackLeaders));
        if (Math.random() < leaderChance && currentLeaders < this.entitySettings.maxPackLeaders) {
            wolf.isPackLeader = true;
            wolf.packMembers = [];
        }
    }

    followPackLeader(wolf) {
        const leader = wolf.packLeader;
        const dx = leader.x - wolf.x;
        const dy = leader.y - wolf.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.entitySettings.packFollowDistance) {
            // Calculate position in formation
            const index = wolf.packLeader.packMembers.indexOf(wolf);
            const angle = (Math.PI * 2 * index) / wolf.packLeader.packMembers.length;
            // Follow behind the leader in a V formation
            const targetX = leader.x - Math.cos(leader.moveDirection) * this.entitySettings.packFollowDistance
                           + Math.cos(angle) * this.entitySettings.packSpreadDistance;
            const targetY = leader.y - Math.sin(leader.moveDirection) * this.entitySettings.packFollowDistance
                           + Math.sin(angle) * this.entitySettings.packSpreadDistance;

            // Move toward formation position
            const toTargetX = targetX - wolf.x;
            const toTargetY = targetY - wolf.y;
            const targetDistance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);
            
            if (targetDistance > 0.1) {
                const speed = 0.04;  // Slightly faster to keep up with leader
                const newX = wolf.x + (toTargetX / targetDistance) * speed;
                const newY = wolf.y + (toTargetY / targetDistance) * speed;
                
                if (this.getTile(newX, newY) !== null) {
                    wolf.x = newX;
                    wolf.y = newY;
                    // Match leader's direction when close to formation position
                    if (targetDistance < 1) {
                        wolf.moveDirection = leader.moveDirection;
                    }
                }
            }
        }
    }

    coordinatePackHunt(leader) {
        const target = leader.huntTarget;
        if (!target) return;

        // Spread pack members around the prey
        leader.packMembers.forEach((member, index) => {
            const angle = (Math.PI * 2 * index) / leader.packMembers.length;
            member.preferredAngle = angle;  // Store preferred attack angle
        });
    }

    seekPackMembers(leader) {
        const recruitRadius = 12;  // How far to look for potential members
        
        for (let entity of this.entities.values()) {
            if (entity.type === this.entityTypes.WOLF && 
                entity.wantsPack && 
                !entity.packLeader && 
                !entity.isPackLeader) {
                
                const dx = entity.x - leader.x;
                const dy = entity.y - leader.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If found a potential member within range
                if (distance < recruitRadius) {
                    // Move towards the potential member
                    leader.moveDirection = Math.atan2(dy, dx);
                    const speed = 0.03;
                    const newX = leader.x + Math.cos(leader.moveDirection) * speed;
                    const newY = leader.y + Math.sin(leader.moveDirection) * speed;
                    
                    if (this.getTile(newX, newY) !== null) {
                        leader.x = newX;
                        leader.y = newY;
                        
                        // If close enough, recruit the wolf
                        if (distance < 2) {
                            entity.packLeader = leader;
                            leader.packMembers.push(entity);
                            return;  // Only recruit one wolf at a time
                        }
                    }
                    return;  // Focus on moving towards this potential member
                }
            }
        }
    }

    addToInventory(item) {
        // First try to find an existing stack of the same item
        const existingStack = this.inventory.find(slot => slot.item === item);
        if (existingStack) {
            existingStack.count++;
            this.updateInventoryDisplay();
            return true;
        }
        
        // If no existing stack, find first empty slot
        const emptySlot = this.inventory.findIndex(slot => slot.item === null);
        if (emptySlot !== -1) {
            this.inventory[emptySlot] = {
                item: item,
                count: 1
            };
            this.updateInventoryDisplay();
            return true;
        }
        return false;  // Inventory is full
    }

    removeFromInventory(slot) {
        if (slot >= 0 && slot < this.inventory.length) {
            const slotData = this.inventory[slot];
            if (slotData.count > 1) {
                slotData.count--;
            } else {
                this.inventory[slot] = {
                    item: null,
                    count: 0
                };
            }
            this.updateInventoryDisplay();
            return slotData.item;
        }
        return null;
    }

    updateInventoryDisplay() {
        const slots = document.querySelectorAll('.inventory-slot');
        this.inventory.forEach((slotData, index) => {
            const slot = slots[index];
            // Make slot droppable
            slot.setAttribute('draggable', 'true');
            slot.dataset.slotIndex = index;
            
            // Add drag and drop event listeners
            slot.ondragstart = (e) => this.handleDragStart(e, index);
            slot.ondragover = (e) => this.handleDragOver(e);
            slot.ondrop = (e) => this.handleDrop(e, index);
            
            if (slotData.item) {
                // Clear any existing content
                slot.textContent = '';
                slot.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                
                // Create container for item and tooltip
                const container = document.createElement('div');
                container.style.position = 'relative';
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.pointerEvents = 'none';  // Allow drag events to pass through to slot
                
                // Create and add item image
                const img = document.createElement('img');
                img.src = `assets/objects/items/${slotData.item}.png`;
                img.style.width = '16px';
                img.style.height = '16px';
                img.style.display = 'block';
                img.style.margin = '7px auto';
                
                img.onerror = () => {
                    console.log(`Failed to load image for ${slotData.item}`);
                    slot.textContent = slotData.item;
                };
                
                container.appendChild(img);
                
                // Add count display if more than 1
                if (slotData.count > 1) {
                    const countDisplay = document.createElement('div');
                    countDisplay.textContent = slotData.count;
                    countDisplay.style.position = 'absolute';
                    countDisplay.style.bottom = '2px';
                    countDisplay.style.right = '2px';
                    countDisplay.style.fontSize = '10px';
                    countDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    countDisplay.style.color = 'white';
                    countDisplay.style.padding = '1px 3px';
                    countDisplay.style.borderRadius = '3px';
                    container.appendChild(countDisplay);
                }
                
                // Add tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = this.formatItemName(slotData.item);
                container.appendChild(tooltip);
                
                slot.appendChild(container);
            } else {
                slot.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                slot.textContent = '';
            }
        });
    }

    // Helper function to format item names
    formatItemName(item) {
        return item
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    tryInteract(x, y) {
        // Check if position has any interactable objects
        const tree = this.getTree(x, y);
        const rock = this.getRock(x, y);
        const grass = this.getGrass(x, y);
        const entities = Array.from(this.entities.values())
            .filter(e => Math.floor(e.x) === x && Math.floor(e.y) === y);
        
        // Get player position
        const player = Array.from(this.entities.values())
            .find(entity => entity.type === this.entityTypes.PLAYER);
        
        if (!player) return;
        
        // Calculate distance to interaction point
        const dx = x - player.x;
        const dy = y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if within interaction range
        if (distance <= this.interactionRange) {
            // Check for prey interactions first
            for (const entity of entities) {
                if (entity.health !== null) {  // If entity has health, it's prey
                    // Damage the prey
                    entity.health -= this.harvestSettings.preyDamage;
                    
                    // If prey is killed
                    if (entity.health <= 0) {
                        // Add meat to inventory
                        this.addToInventory(this.inventoryItems.MEAT);
                        
                        // Special drops for cows
                        if (entity.type === this.entityTypes.COW) {
                            // Chance to get hide from cows
                            if (Math.random() < this.harvestSettings.hideChance) {
                                this.addToInventory(this.inventoryItems.HIDE);
                            }
                        }
                        
                        // Chance to get bone
                        if (Math.random() < this.harvestSettings.boneChance) {
                            this.addToInventory(this.inventoryItems.BONE);
                        }
                        
                        // Remove the dead prey
                        this.removeEntity(entity.id);
                    }
                    return;  // Stop checking other interactions if we hit prey
                }
            }

            // Tree interaction
            if (tree) {
                // Check if player has an axe
                const hasAxe = this.hasToolInInventory('stone_axe');
                
                // Calculate wood drop chance with axe bonus
                const woodChance = this.harvestSettings.woodChance + 
                    (hasAxe ? this.harvestSettings.axeWoodBonus : 0);
                
                // Try to harvest wood from tree
                if (Math.random() < woodChance) {
                    // Add more wood if using axe
                    const woodAmount = hasAxe ? this.harvestSettings.axeWoodAmount : 1;
                    for (let i = 0; i < woodAmount; i++) {
                        this.addToInventory(this.inventoryItems.WOOD);
                    }
                    
                    // Calculate remove chance with axe bonus
                    const removeChance = this.harvestSettings.removeChance +
                        (hasAxe ? this.harvestSettings.axeRemoveBonus : 0);
                    
                    // Chance to remove the tree
                    if (Math.random() < removeChance) {
                        this.foliage.trees.delete(`${x},${y}`);
                    }
                }
            }
            // Rock interaction
            if (rock) {
                // Try to harvest rock shard
                if (Math.random() < this.harvestSettings.rockChance) {
                    this.addToInventory(this.inventoryItems.ROCK_SHARD);
                    
                    // Chance to remove the rock
                    if (Math.random() < this.harvestSettings.removeChance) {
                        this.foliage.rocks.delete(`${x},${y}`);
                    }
                }
            }
            if (grass) {
                console.log('Interacting with grass');
                // Add grass interaction logic here
            }
        }
    }

    canCraft(recipe) {
        const ingredients = this.craftingRecipes[recipe].ingredients;
        return Object.entries(ingredients).every(([item, required]) => {
            const slot = this.inventory.find(slot => slot.item === item);
            return slot && slot.count >= required;
        });
    }

    craft(recipe) {
        if (!this.canCraft(recipe)) return false;
        
        // Remove ingredients
        const ingredients = this.craftingRecipes[recipe].ingredients;
        Object.entries(ingredients).forEach(([item, required]) => {
            for (let i = 0; i < required; i++) {
                const slot = this.inventory.find(slot => slot.item === item);
                if (slot) this.removeFromInventory(this.inventory.indexOf(slot));
            }
        });
        
        // Add crafted item
        const result = this.craftingRecipes[recipe].result;
        const count = this.craftingRecipes[recipe].count;
        for (let i = 0; i < count; i++) {
            this.addToInventory(result);
        }
        
        return true;
    }

    handleDragStart(e, fromIndex) {
        // Only start drag if slot has an item
        if (this.inventory[fromIndex].item) {
            e.dataTransfer.setData('text/plain', fromIndex);
            e.target.style.opacity = '0.4';
        } else {
            e.preventDefault();
        }
    }

    handleDragOver(e) {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e, toIndex) {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        
        // Don't do anything if dropping on the same slot
        if (fromIndex === toIndex) {
            return;
        }
        
        // Swap inventory slots
        const temp = this.inventory[fromIndex];
        this.inventory[fromIndex] = this.inventory[toIndex];
        this.inventory[toIndex] = temp;
        
        // Reset opacity and update display
        document.querySelectorAll('.inventory-slot').forEach(slot => {
            slot.style.opacity = '1';
        });
        this.updateInventoryDisplay();
    }

    hasToolInInventory(toolName) {
        return this.inventory.some(slot => slot.item === toolName);
    }
} 