# Cut faction sprites out of the concept sheets with OpenCV GrabCut. Rects are in 1024-wide display coords.
import cv2, numpy as np
from PIL import Image
C = '/workspace/faction-concepts/'
JOBS = {
 'nordic-infantry-concept.jpg': {'n_sentinel': (40,90,290,505), 'n_seer': (262,35,495,520), 'n_tallwhite': (430,60,765,520), 'n_guardian': (770,85,1000,520)},
 'grey-infantry-concept.jpg': {'g_drone': (12,168,122,470), 'g_psionic': (318,118,498,465), 'g_abductor': (512,88,812,468), 'g_hybrid': (812,78,1002,472), 'g_crawler': (228,442,372,512)},
 'nordic-craft-concept.jpg': {'n_lightship': (18,62,645,240), 'n_lightcraft': (250,243,560,332), 'n_skiff': (100,348,460,505), 'n_spire': (636,155,762,425), 'n_crystal': (752,66,912,465)},
 'grey-craft-concept.jpg': {'g_mothership': (212,78,848,325), 'g_saucer': (36,68,288,168), 'g_orb': (82,238,178,335), 'g_dome': (105,285,400,508), 'g_hive': (688,296,892,508)},
}
for f, parts in JOBS.items():
    img = cv2.imread(C + f); s = img.shape[1] / 1024
    for name, (x0, y0, x1, y1) in parts.items():
        r = tuple(int(v * s) for v in (x0, y0, x1 - x0, y1 - y0)); mask = np.zeros(img.shape[:2], np.uint8)
        bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(img, mask, r, bg, fg, 6, cv2.GC_INIT_WITH_RECT)
        m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)  # keep the largest blobs only
        if n > 1: keep = [i for i in range(1, n) if st[i, 4] > 0.04 * st[1:, 4].max()]; m = np.isin(lab, keep).astype(np.uint8) * 255
        m = cv2.GaussianBlur(m, (3, 3), 0)
        rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA); rgba[:, :, 3] = m
        x, y, w, h = r; crop = Image.fromarray(rgba[y:y + h, x:x + w]); crop = crop.crop(crop.getbbox())
        H2 = 220 if crop.height >= crop.width * 0.8 else int(220 * crop.height / crop.width * 1.6)
        W2 = max(8, int(crop.width * H2 / crop.height)); big = crop.resize((W2, H2), Image.LANCZOS)
        big.save(f'/workspace/rts-fac/assets/{name}@2x.png'); big.resize((max(4, W2 // 2), max(4, H2 // 2)), Image.LANCZOS).save(f'/workspace/rts-fac/assets/{name}.png')
        print(name, big.size)
