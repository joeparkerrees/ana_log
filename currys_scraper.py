import os
import requests
from bs4 import BeautifulSoup

# The Currys product URL
URL = "https://www.currys.co.uk/products/samsung-galaxy-s25-256-gb-blueblack-10288830.html"

# Headers to make the scraper look like a real web browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9"
}

def download_images():
    # 1. Create a folder to save the images locally
    folder_name = "galaxy_s25_images"
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)

    # 2. Fetch the webpage
    print("Fetching the webpage from Currys...")
    response = requests.get(URL, headers=HEADERS)

    if response.status_code != 200:
        print(f"Failed to retrieve page. Status code: {response.status_code}")
        print("Currys might be blocking the request with Cloudflare.")
        return

    # 3. Parse the HTML content
    soup = BeautifulSoup(response.text, "html.parser")

    # 4. Find all image tags
    img_tags = soup.find_all("img")
    print(f"Found {len(img_tags)} total images on the page. Filtering for product images...")

    count = 1
    for img in img_tags:
        # Many modern sites use 'data-src' or 'srcset' for lazy loading, so we check multiple attributes
        img_url = img.get("src") or img.get("data-src")

        # Filter for valid URLs that are likely to be high-res product photos
        if img_url and img_url.startswith("http"):
            # We want to skip small UI icons, logos, or tracking pixels
            if "media" in img_url.lower() or "product" in img_url.lower():
                print(f"Downloading: {img_url}")
                try:
                    # Download the actual image file
                    img_data = requests.get(img_url, headers=HEADERS).content
                    filename = f"{folder_name}/s25_blueblack_{count}.jpg"

                    with open(filename, "wb") as file:
                        file.write(img_data)
                    count += 1
                except Exception as e:
                    print(f"Could not download {img_url}: {e}")

    print(f"\nSuccess! Downloaded {count - 1} images to the '{folder_name}' folder.")

if __name__ == "__main__":
    download_images()
