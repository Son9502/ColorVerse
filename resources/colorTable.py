# named_table.py
# Requires: requests, pandas, matplotlib
# Install if needed:
# pip install requests pandas matplotlib

# Links to use used:  https://www.color-hex.com/color-names.html (Color Database)
#                     https://www.colorhexa.com/color-names
#                     https://www.color-name.com/colors
#                     https://www.color-name.com/complete-list-of-html-color-names.color
#                     https://encycolorpedia.com/named
#                     https://coolors.co/colors

import re
import requests
import pandas as pd
import string
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

color_dic = {}

link_one = "https://www.color-hex.com/color-names.html"
link_two = "https://www.colorhexa.com/color-names"
link_three = "https://www.color-name.com/colors"
link_four = "https://www.color-name.com/complete-list-of-html-color-names.color"
link_five = "https://encycolorpedia.com/named"
link_six = "https://coolors.co/colors"

colors = [
    "blue",
    "teal",
    "green",
    "yellow",
    "orange",
    "red",
    "pink",
    "purple",
    "gray",
    "silver",
    "white",
    "black",
    "gold",
    "olive",
    "khaki",
    "beige",
    "brown",
    "chocolate",
    "maroon",
    "indigo",
    "navy",
    "cyan",
    "aqua",
    "fushsia",
]

# Function to register color names and hex values
def register_color(name, hex):
    hex = hex if (hex[0] == "#") else "#" + hex
    if name in color_dic:
        if hex not in color_dic[name]:
            color_dic[name].append(hex)
    else:
        color_dic[name] = [hex]


def hex_to_rgb(hex):
    hex = hex.lstrip("#")
    return tuple(int(hex[i : i + 2], 16) for i in (0, 2, 4))



# Link 1 extraction
resp_one = requests.get(link_one)
soup_one = BeautifulSoup(resp_one.text, "html.parser")
table_one = soup_one.find("tbody")
for tr in table_one.find_all("tr"):
    cols_one = tr.find_all("td")
    name_one = cols_one[0].get_text().lower()
    name_one = re.sub(r"\s*\d+\s*$", "", name_one)
    name_one = re.sub(r"\s*\([^)]*\)", "", name_one)
    hex_one = cols_one[2].get_text().strip()
    register_color(name_one, hex_one.upper())
print(f"Link 1 done, total colors: {len(color_dic)}")

# Link 2 extraction
resp_two = requests.get(link_two)
soup_two = BeautifulSoup(resp_two.text, "html.parser")
table_two = soup_two.find("tbody")
for tr in table_two.find_all("tr"):
    cols_two = tr.find_all("td")
    name_two = cols_two[0].get_text().lower()
    name_two = re.sub(r"\s*\d+\s*$", "", name_two)
    hex_two = cols_two[1].get_text().strip()
    register_color(name_two, hex_two.upper())
print(f"Link 2 done, total colors: {len(color_dic)}")

# Link 3 extraction
for color in colors:
    resp_three = requests.get(link_three + "/" + color)
    soup_three = BeautifulSoup(resp_three.text, "html.parser")
    grid_three = soup_three.find("ul", class_="color-posts")
    for li in grid_three.find_all("li"):
        name_three = li.find("h3").get_text().lower()
        name_three = re.sub(r"\s*\([^)]*\)", "", name_three)
        name_three = re.sub(r"\s*cmyk\s*$", "", name_three)
        name_three = re.sub(r"\s*\d+\s*$", "", name_three)
        hex_three = li.find("rect")["fill"]
        if name_three != "completelistofhtmlcolornames":
            register_color(name_three, hex_three.upper())
print(f"Link 3 done, total colors: {len(color_dic)}")

# Link 4 extraction
resp_four = requests.get(link_four)
soup_four = BeautifulSoup(resp_four.text, "html.parser")
tables = soup_four.find_all("table", class_="colors-table")
for table in tables:
    table_four = table.find("tbody")
    for tr in table_four.find_all("tr")[1:]:
        cols_four = tr.find_all("td")
        name_four = cols_four[1].get_text().lower()
        hex_four = cols_four[2].get_text()
        register_color(name_four, hex_four.upper())
print(f"Link 4 done, total colors: {len(color_dic)}")

# Link 5 extraction
driver_five = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
driver_five.get(link_five)
soup_five = BeautifulSoup(driver_five.page_source, "html.parser")
driver_five.quit()
ol_five = soup_five.find("ol")
for li in ol_five.find_all("li"):
    name_five, hex_five = list(li.stripped_strings)
    name_five = name_five.lower()
    name_five = re.sub(r"\s*\([^)]*\)", "", name_five)
    name_five = re.sub(r"\s*\d+\s*$", "", name_five)
    name_five = name_five.replace('"', "").replace("'", "")
    name_five = re.sub(r"\s*color\s*$", "", name_five, flags=re.IGNORECASE)
    register_color(name_five, hex_five.upper())
print(f"Link 5 done, total colors: {len(color_dic)}")

# Link 6 extraction
driver_six = webdriver.Chrome()
driver_six.get(link_six)
time.sleep(3)  # wait for JS to render

last_height = driver_six.execute_script("return document.body.scrollHeight")

while True:
    # Scroll to bottom
    driver_six.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.5)  # Allow lazy loaded content to render

    # Check new height
    new_height = driver_six.execute_script("return document.body.scrollHeight")
    if new_height == last_height:
        break  # Reached the end
    last_height = new_height
    
html = driver_six.page_source
driver_six.quit()

soup = BeautifulSoup(html, "html.parser")
cards = soup.find_all("div", class_="color-card")
    
for card in cards:
    color_div = card.find("div", class_="color-card_color")
    hex_six = color_div.find("span").text.strip() if color_div else None

    # Extract name/info if available
    info_div = card.find("div", class_="color-card_info")
    name_six = info_div.text.strip() if info_div else None
    register_color(name_six.lower(), hex_six.upper())
print(f"Link 6 done, total colors: {len(color_dic)}")
# Save to CSV
rows = []
for raw_name, hex_list in sorted(color_dic.items()):
    names = [n for n in raw_name.split("/") if n.strip()]
    for name in names:
        name = name.translate(str.maketrans("", "", string.punctuation))
        name = name.strip()
        if not name:
            continue
        for hex in sorted(hex_list):
            r, g, b = hex_to_rgb(hex)
            rows.append({"name": name, "hex": hex, "r": r, "g": g, "b": b})
df_colors = pd.DataFrame(rows)
df_colors.to_csv("./public/named_colors.csv", index=False)



