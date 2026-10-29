export const WIDTH = 960, HEIGHT = 540, FLOOR = 500, BIRD_X = 220;
export type Pipe = { x: number; center: number; gap: number; scored: boolean };
export class Game {
  y = 265; velocity = 0; score = 0; pipes: Pipe[] = []; distance = 0; lastCenter = 265;
  reset() { this.y = 265; this.velocity = 0; this.score = 0; this.pipes = []; this.distance = 0; this.lastCenter = 265; }
  move(dt: number, target: number | null) {
    if (target !== null) { const delta = (target - this.y) * (1 - Math.exp(-dt * 15)); this.y += Math.max(-390 * dt, Math.min(390 * dt, delta)); this.velocity = 0; }
    else { this.velocity = Math.min(350, this.velocity + 570 * dt); this.y += this.velocity * dt; }
  }
  update(dt: number, target: number | null, random = Math.random): boolean {
    this.move(dt, target);
    const speed = Math.min(205, 125 + this.score * 2.5);
    this.distance += dt * speed;
    if (!this.pipes.length || this.pipes[this.pipes.length - 1].x < WIDTH - 310) {
      this.lastCenter = Math.max(170, Math.min(350, this.lastCenter + (random() - 0.5) * 150));
      this.pipes.push({ x: WIDTH + 45, center: this.lastCenter, gap: Math.max(180, 255 - this.score * 2), scored: false });
    }
    for (const pipe of this.pipes) {
      pipe.x -= speed * dt;
      if (!pipe.scored && pipe.x + 72 < BIRD_X - 12) { pipe.scored = true; this.score++; }
      if (BIRD_X + 12 > pipe.x && BIRD_X - 12 < pipe.x + 72 && (this.y - 10 < pipe.center - pipe.gap / 2 || this.y + 10 > pipe.center + pipe.gap / 2)) return false;
    }
    this.pipes = this.pipes.filter(p => p.x > -90);
    return this.y > 12 && this.y < FLOOR - 12;
  }
}
