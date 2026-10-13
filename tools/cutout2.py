# Second pass for figures GrabCut lost (sand-on-sand): seed a definite-foreground spine (head->feet) per figure.
import cv2, numpy as np
from PIL import Image
C = '/workspace/faction-concepts/'
# name: (rect, list of FG seed polylines) in 1024 display coords
JOBS = {
 'nordic-infantry-concept.jpg': {
   'n_sentinel': ((40,85,292,505), [[(165,100),(165,200),(160,300),(150,480)], [(140,230),(270,320)]]),
   'n_seer': ((262,30,495,520), [[(400,100),(400,220),(395,350),(400,490)], [(298,60),(298,300),(325,495)]]),
   'n_tallwhite': ((430,55,765,520), [[(630,75),(630,200),(620,350),(640,490)], [(715,210),(715,380)], [(560,300),(450,470)]]),
   'n_guardian': ((770,80,1000,520), [[(850,100),(850,250),(850,480)], [(940,160),(940,330)]]),
 },
 'grey-infantry-concept.jpg': {
   'g_psionic': ((330,180,495,462), [[(420,190),(420,300),(410,440)], [(380,320),(440,350)]]),
   'g_abductor': ((515,120,700,462), [[(585,140),(585,300),(580,450)], [(560,240),(630,260)], [(650,120),(700,100)]]),
   'g_crawler': ((232,446,370,512), [[(250,490),(300,470),(355,495)]]),
 },
 'nordic-craft-concept.jpg': { 'n_spire': ((640,160,760,425), [[(686,180),(686,300),(690,410)]]) },
 'grey-craft-concept.jpg': { 'g_hive': ((690,300,890,508), [[(770,330),(780,420),(790,500)], [(700,495),(880,495)]]) },
}
for f, parts in JOBS.items():
    img = cv2.imread(C + f); s = img.shape[1] / 1024
    for name, (rc, seeds) in parts.items():
        x0, y0, x1, y1 = [int(v * s) for v in rc]; mask = np.full(img.shape[:2], cv2.GC_BGD, np.uint8); mask[y0:y1, x0:x1] = cv2.GC_PR_BGD
        for pl in seeds:
            pts = np.array([(int(a * s), int(b * s)) for a, b in pl], np.int32); cv2.polylines(mask, [pts], False, cv2.GC_PR_FGD, 22); cv2.polylines(mask, [pts], False, cv2.GC_FGD, 6)
        bg, fg = np.zeros((1, 65)), np.zeros((1, 65)); cv2.grabCut(img, mask, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
        m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        if n > 1: keep = [i for i in range(1, n) if st[i, 4] > 0.08 * st[1:, 4].max()]; m = np.isin(lab, keep).astype(np.uint8) * 255
        m = cv2.GaussianBlur(m, (3, 3), 0); rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA); rgba[:, :, 3] = m
        crop = Image.fromarray(rgba[y0:y1, x0:x1]); crop = crop.crop(crop.getbbox())
        H2 = 220 if crop.height >= crop.width * 0.8 else int(220 * crop.height / crop.width * 1.6)
        big = crop.resize((max(8, int(crop.width * H2 / crop.height)), H2), Image.LANCZOS)
        big.save(f'/workspace/rts-fac/assets/{name}@2x.png'); big.resize((max(4, big.width // 2), max(4, H2 // 2)), Image.LANCZOS).save(f'/workspace/rts-fac/assets/{name}.png'); print(name, big.size)
