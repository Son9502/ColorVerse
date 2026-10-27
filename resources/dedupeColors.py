# dedupeColors.py
# Collapses named_colors.csv to one hex per name.
# Requires: pandas, matplotlib
#
# Rules, per name:
#   1. CSS named color (ignoring spaces, e.g. "steel blue" -> steelblue): use the CSS value
#   2. Only one hex: keep it
#   3. Several hexes: keep the one closest to their average (averaged in linear RGB),
#      so the result is a real color from a source rather than a muddy blend
#
# Usage (from project root): python resources/dedupeColors.py

import pandas as pd
from matplotlib.colors import CSS4_COLORS

CSV_PATH = "./public/named_colors.csv"


def srgb_to_linear(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def pick_hex(name, group):
    css = CSS4_COLORS.get(name.replace(" ", ""))
    if css:
        return css.upper()
    if len(group) == 1:
        return group["hex"].iloc[0]

    linear = group[["r", "g", "b"]].apply(lambda col: col.map(srgb_to_linear))
    mean = linear.mean()
    closest = ((linear - mean) ** 2).sum(axis=1).idxmin()
    return group.loc[closest, "hex"]


def hex_to_rgb(hex_code):
    hex_code = hex_code.lstrip("#")
    return tuple(int(hex_code[i:i + 2], 16) for i in (0, 2, 4))


def dedupe(df):
    df = df.drop_duplicates(subset=["name", "hex"])
    rows = []
    for name, group in df.groupby("name", sort=True):
        hex_code = pick_hex(name, group)
        r, g, b = hex_to_rgb(hex_code)
        rows.append({"name": name, "hex": hex_code, "r": r, "g": g, "b": b})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    before = pd.read_csv(CSV_PATH, keep_default_na=False)
    after = dedupe(before)
    after.to_csv(CSV_PATH, index=False)
    print(f"{len(before)} rows -> {len(after)} rows (one per name)")
