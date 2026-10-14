# v10.3: saucers + orb cut pixel-faithful from grey-craft-concept.jpg (GrabCut, no repaint)
import cv2, numpy as np
from PIL import Image
img = cv2.imread('/workspace/faction-concepts/grey-craft-concept.jpg'); s = img.shape[1] / 1024; OUT = '/workspace/rts-fac/assets/'
JOBS = { 'gs_mother': ((216, 82, 846, 300), [[(240, 235), (530, 150), (820, 235)], [(400, 120), (650, 120)]], [[(470, 300), (600, 300)], [(330, 300), (720, 300)]]),
         'gs_saucer': ((36, 68, 284, 168), [[(50, 125), (160, 95), (270, 125)]], [[(140, 168), (180, 168)]]),
         'gs_small':  ((840, 252, 976, 312), [[(850, 285), (905, 268), (965, 285)]], []),
         'gs_scout':  ((736, 90, 824, 128), [[(745, 110), (780, 100), (815, 110)]], []),
         'gs_orb':    ((84, 240, 176, 332), [[(100, 285), (130, 260), (160, 290)], [(130, 260), (130, 315)]], []) }
for name, (rc, fg, bgl) in JOBS.items():
    x0, y0, x1, y1 = [int(v * s) for v in rc]; mask = np.full(img.shape[:2], cv2.GC_BGD, np.uint8); mask[y0:y1, x0:x1] = cv2.GC_PR_BGD
    for pl in fg: pts = np.array([(int(a * s), int(b * s)) for a, b in pl], np.int32); cv2.polylines(mask, [pts], False, cv2.GC_FGD, max(3, int(6 * s)))
    for pl in bgl: pts = np.array([(int(a * s), int(b * s)) for a, b in pl], np.int32); cv2.polylines(mask, [pts], False, cv2.GC_BGD, 10)
    bg, fgm = np.zeros((1, 65)), np.zeros((1, 65)); cv2.grabCut(img, mask, None, bg, fgm, 10, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8); m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: big = 1 + int(np.argmax(st[1:, 4])); m = np.where(lab == big, 255, 0).astype(np.uint8)
    m = cv2.GaussianBlur(m, (3, 3), 0); rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA); rgba[:, :, 3] = m
    crop = Image.fromarray(rgba[y0:y1, x0:x1]); crop = crop.crop(crop.getbbox())
    W2 = 360 if name == 'gs_mother' else 160; big = crop.resize((W2, max(4, int(crop.height * W2 / crop.width))), Image.LANCZOS)
    big.save(f'{OUT}{name}@2x.png'); big.resize((W2 // 2, max(2, big.height // 2)), Image.LANCZOS).save(f'{OUT}{name}.png'); print(name, big.size)
    pv = Image.new('RGBA', big.size, (30, 80, 30, 255)); pv.alpha_composite(big); pv.save(f'/tmp/pv_{name}.png')
