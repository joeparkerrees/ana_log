import os
import asyncio
from playwright.async_api import async_playwright

URL = "https://www.currys.co.uk/products/samsung-galaxy-s25-256-gb-blueblack-10288830.html"
FOLDER = "galaxy_s25_images"


async def download_images():
    os.makedirs(FOLDER, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-GB",
            viewport={"width": 1280, "height": 900},
        )

        page = await context.new_page()

        print("Navigating to Currys product page...")
        await page.goto(URL, wait_until="networkidle", timeout=60000)

        # Accept cookies if the banner appears
        try:
            await page.click("button:has-text('Accept')", timeout=5000)
            print("Accepted cookie banner.")
        except Exception:
            pass  # No banner, carry on

        # Wait for product images to load
        await page.wait_for_selector("img", timeout=15000)

        # Collect image URLs from all img tags (src + data-src + srcset)
        img_urls = await page.evaluate("""() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const urls = new Set();
            for (const img of imgs) {
                for (const attr of ['src', 'data-src']) {
                    const v = img.getAttribute(attr);
                    if (v && v.startsWith('http')) urls.add(v);
                }
                const srcset = img.getAttribute('srcset');
                if (srcset) {
                    for (const part of srcset.split(',')) {
                        const url = part.trim().split(' ')[0];
                        if (url.startsWith('http')) urls.add(url);
                    }
                }
            }
            return Array.from(urls);
        }""")

        # Filter for likely product images
        product_urls = [
            u for u in img_urls
            if any(kw in u.lower() for kw in ("media", "product", "s25", "galaxy", "samsung"))
        ]

        print(f"Found {len(product_urls)} candidate product image URLs.")

        count = 0
        for url in product_urls:
            print(f"Downloading: {url}")
            try:
                response = await context.request.get(url)
                if response.ok:
                    count += 1
                    filename = os.path.join(FOLDER, f"s25_blueblack_{count}.jpg")
                    with open(filename, "wb") as f:
                        f.write(await response.body())
                else:
                    print(f"  Skipped (status {response.status})")
            except Exception as e:
                print(f"  Error: {e}")

        await browser.close()

    print(f"\nDone! Downloaded {count} images to '{FOLDER}/'.")


if __name__ == "__main__":
    asyncio.run(download_images())
