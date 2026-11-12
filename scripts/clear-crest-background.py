"""Make the near-white background connected to the image border transparent.
Usage: python3 -I scripts/clear-crest-background.py public/crests/<id>.png ..."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

TOL_MIN = 205   # min channel >= this counts as background candidate
TOL_SAT = 40    # max-min channel spread allowed

for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    rgb = a[..., :3].astype(int)
    mn, mx = rgb.min(2), rgb.max(2)
    cand = (mn >= TOL_MIN) & (mx - mn <= TOL_SAT) | (a[..., 3] < 10)
    lab, n = ndimage.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    ring = ndimage.binary_dilation(bg, iterations=1) & ~bg
    alpha = a[..., 3].astype(float)
    alpha[bg] = 0
    # soft edge: lighter ring pixels become partly transparent
    soft = np.clip((250 - mn) / 70.0, 0, 1)
    alpha[ring] = np.minimum(alpha[ring], 255 * np.maximum(soft[ring], 0.25))
    a[..., 3] = alpha.astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    Image.fromarray(a, "RGBA").save(path, optimize=True)
    print(path, "cleared", int(bg.sum()), "px")
