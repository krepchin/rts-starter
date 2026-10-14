// v9 painted look: grade the original steel-blue sprite art into gritty dark gray / olive (matches the painted preview).
// Runs once per sprite at load. Team 1 gets a rust-red wash so factions stay distinct.
export function paintGrade(canvas, team = 0) {
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d'); let id;
  try { id = ctx.getImageData(0, 0, w, h); } catch { return canvas; }
  const d = id.data, tint = team === 1 ? [1.18, 0.82, 0.70] : [1.0, 0.98, 0.84];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b;
    const glow = g > 150 && g > r * 1.3 && g > b * 1.1; // keep bright green tiberium/lights
    const k = glow ? 0.75 : 0.22; // how much original colour survives
    let v = l * 0.82 + 8; v = (v - 110) * 1.12 + 104; // slight contrast, darker overall
    d[i] = Math.max(0, Math.min(255, v * tint[0] * (1 - k) + r * k));
    d[i + 1] = Math.max(0, Math.min(255, v * tint[1] * (1 - k) + g * k));
    d[i + 2] = Math.max(0, Math.min(255, v * tint[2] * (1 - k) * 0.92 + b * k * 0.8));
  }
  ctx.putImageData(id, 0, 0); return canvas;
}
