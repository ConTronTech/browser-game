// Simplified Perlin noise implementation
class PerlinNoise {
    constructor(seed = Math.random() * 10000) {
        this.seed = seed;
        this.permutation = this.generatePermutation();
        this.p = [...this.permutation, ...this.permutation];
    }

    generatePermutation() {
        const perm = new Array(256).fill(0).map((_, i) => i);
        
        // Seeded random number generator
        const random = () => {
            this.seed = (this.seed * 16807) % 2147483647;
            return (this.seed - 1) / 2147483646;
        };

        // Fisher-Yates shuffle with seeded random
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        
        return perm;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const grad2 = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [1, 0], [-1, 0],
            [0, 1], [0, -1], [0, 1], [0, -1],
            [1, 1], [-1, 1], [1, -1], [-1, -1]
        ];
        const [gradX, gradY] = grad2[h];
        return gradX * x + gradY * y;
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;

        return this.lerp(v,
            this.lerp(u,
                this.grad(this.p[A], x, y),
                this.grad(this.p[B], x - 1, y)
            ),
            this.lerp(u,
                this.grad(this.p[A + 1], x, y - 1),
                this.grad(this.p[B + 1], x - 1, y - 1)
            )
        );
    }
} 