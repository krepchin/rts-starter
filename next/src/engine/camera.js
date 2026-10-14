export class Camera {
  constructor(map) { this.map = map; this.x = 0; this.y = 0; this.vw = 800; this.vh = 600; }
  resize(w, h) { this.vw = w; this.vh = h; this.clamp(); }
  pan(dx, dy) { this.x += dx; this.y += dy; this.clamp(); }
  centerOn(x, y) { this.x = x - this.vw / 2; this.y = y - this.vh / 2; this.clamp(); }
  clamp() { this.x = Math.max(0, Math.min(this.map.pxW - this.vw, this.x)); this.y = Math.max(0, Math.min(this.map.pxH - this.vh, this.y)); }
  toWorld(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}
