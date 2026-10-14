# v10.1: Reptilian Brood Ship + Bio-Tank cut pixel-faithful from Kent's concept sketches (GrabCut, no repaint)
import cv2, numpy as np
from PIL import Image
OUT = '/workspace/rts-fac/assets/'
JOBS = {
 'rb_brood': ('/workspace/rcon/3979b519.jpg', (0, 12, 1012, 352), 420,
   [[(390, 120), (560, 70), (700, 110), (830, 200)], [(360, 262), (470, 250), (600, 240)], [(70, 45), (250, 70), (420, 130)], [(800, 120), (900, 135), (985, 158)], [(80, 220), (250, 250), (380, 240)], [(180, 190), (300, 180)]],
   [[(250, 345), (800, 345)], [(560, 330), (700, 330)], [(430, 330), (530, 330)], [(120, 300), (200, 330)], [(90, 285), (170, 300)], [(30, 260), (110, 280)], [(200, 300), (300, 320)]]),
 'rb_tank': ('/workspace/rcon/biotank.jpg', (50, 88, 818, 440), 300,
   [[(150, 300), (300, 220), (450, 180), (600, 200), (790, 305)], [(380, 330), (410, 405)], [(210, 320), (200, 360)], [(700, 330), (720, 360)], [(60, 320), (150, 290)]],
   [[(480, 430), (600, 430)], [(250, 425), (330, 425)], [(560, 380), (640, 400)], [(100, 385), (170, 375)], [(290, 400), (340, 425)], [(440, 410), (480, 425)], [(150, 350), (190, 345)]]),
 'rb_grazer': ('/workspace/rcon/biotank.jpg', (12, 425, 395, 552), 180,
   [[(40, 520), (120, 480), (200, 455), (300, 470), (385, 495)], [(160, 520), (165, 540)], [(250, 520), (260, 540)]], []),
}
for name, (src, rc, W2, fg, bgl) in JOBS.items():
    img = cv2.imread(src); s = img.shape[1] / 1024
    x0, y0, x1, y1 = [int(v * s) for v in rc]; mask = np.full(img.shape[:2], cv2.GC_BGD, np.uint8); mask[y0:y1, x0:x1] = cv2.GC_PR_BGD
    for pl in fg: cv2.polylines(mask, [np.array([(int(a * s), int(b * s)) for a, b in pl], np.int32)], False, cv2.GC_FGD, max(4, int(8 * s)))
    for pl in bgl: cv2.polylines(mask, [np.array([(int(a * s), int(b * s)) for a, b in pl], np.int32)], False, cv2.GC_BGD, 10)
    bg, fgm = np.zeros((1, 65)), np.zeros((1, 65)); cv2.grabCut(img, mask, None, bg, fgm, 10, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8); m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: big = 1 + int(np.argmax(st[1:, 4])); m = np.where(lab == big, 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)); m = cv2.GaussianBlur(m, (3, 3), 0)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA); rgba[:, :, 3] = m
    crop = Image.fromarray(rgba[y0:y1, x0:x1]); crop = crop.crop(crop.getbbox())
    big = crop.resize((W2, int(crop.height * W2 / crop.width)), Image.LANCZOS)
    big.save(f'{OUT}{name}@2x.png'); big.resize((W2 // 2, big.height // 2), Image.LANCZOS).save(f'{OUT}{name}.png'); print(name, big.size)
    pv = Image.new('RGBA', big.size, (40, 90, 160, 255)); pv.alpha_composite(big); pv.save(f'/tmp/pv_{name}.png')
# strip leftover sand/dust (tan, desaturated, bright) from the lower part of the cuts
import colorsys
def desand(name, ymin, xmax=1.0):
    for suf in ('@2x', ''):
        im = Image.open(f'{OUT}{name}{suf}.png').convert('RGBA'); a = np.array(im).astype(float); h, w = a.shape[:2]
        r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
        sand = (mx > 120) & ((mx - mn) / (mx + 1) < 0.42) & (r >= g) & (g >= b - 5)
        yy, xx = np.mgrid[0:h, 0:w]; sand &= (yy > ymin * h) & (xx < xmax * w)
        a[..., 3][sand] = 0; Image.fromarray(a.astype(np.uint8)).save(f'{OUT}{name}{suf}.png')
    pv = Image.new('RGBA', Image.open(f'{OUT}{name}@2x.png').size, (40, 90, 160, 255)); pv.alpha_composite(Image.open(f'{OUT}{name}@2x.png')); pv.save(f'/tmp/pv_{name}.png')
desand('rb_brood', 0.55, 0.4); desand('rb_tank', 0.6)
