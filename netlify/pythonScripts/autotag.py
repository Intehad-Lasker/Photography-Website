import os, io, json, sqlite3
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.service_account import Credentials
from transformers import CLIPProcessor, CLIPModel
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image

# ------------------ Load Models ------------------
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

caption_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
caption_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

# ------------------ Google Drive Auth ------------------
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
creds = Credentials.from_service_account_file("bazzFinal-service.json", scopes=SCOPES)
service = build('drive', 'v3', credentials=creds)

# ------------------ Candidate Tags ------------------
CANDIDATE_TAGS = [
    "car", "sports car", "truck", "bus", "taxi", "motorcycle", "bicycle",
    "airplane", "helicopter", "boat", "ship", "train", "subway",
    "forest", "tree", "palm tree", "pine tree", "mountain", "hill", "desert",
    "beach", "coast", "river", "lake", "ocean", "waterfall",
    "snow", "rain", "clouds", "sky", "storm", "lightning", "sunset", "sunrise",
    "stars", "moon", "night sky", "flowers", "grass", "sand", "rock",
    "building", "skyscraper", "apartment", "bridge", "tower", "street",
    "streetlights", "road", "highway", "sidewalk", "park", "plaza",
    "monument", "statue", "fountain", "sign", "billboard", "traffic light",
    "man", "woman", "child", "crowd", "friends", "family",
    "walking", "running", "cycling", "driving", "swimming",
    "dog", "cat", "horse", "bird", "duck", "fish", "butterfly",
    "bench", "chair", "table", "lamp", "boat dock", "bridge cables",
    "mountain trail", "tent", "backpack", "camera",
    "fireworks", "lantern", "graffiti", "window", "door",
]

# ------------------ Helpers ------------------
def generate_caption(image):
    inputs = caption_processor(images=image, return_tensors="pt")
    out = caption_model.generate(**inputs, max_length=20)
    return caption_processor.decode(out[0], skip_special_tokens=True)

# ------------------ SQLite Setup ------------------
conn = sqlite3.connect("photos.db")
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    tags TEXT,
    caption TEXT,
    link TEXT
)
""")
conn.commit()

# ------------------ Main Script ------------------
results = []
query = f"mimeType contains 'image/' and trashed = false"

files = service.files().list(
    q=query,
    fields="files(id, name, mimeType, webViewLink)"
).execute().get('files', [])

for file in files:
    print(f"Analyzing {file['name']}...")

    request = service.files().get_media(fileId=file['id'])
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)

    try:
        image = Image.open(fh).convert("RGB")

        # CLIP tags
        inputs = clip_processor(text=CANDIDATE_TAGS, images=image, return_tensors="pt", padding=True)
        outputs = clip_model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0]
        top_tags = [CANDIDATE_TAGS[i] for i in probs.topk(5).indices]

        # BLIP caption
        caption = generate_caption(image)

        # Save JSON
        results.append({
            "filename": file['name'],
            "tags": top_tags,
            "caption": caption,
            "link": file['webViewLink']
        })

        # Save SQLite
        cur.execute("INSERT INTO photos (filename, tags, caption, link) VALUES (?, ?, ?, ?)",
                    (file['name'], ", ".join(top_tags), caption, file['webViewLink']))
        conn.commit()

    except Exception as e:
        print(f"Skipping {file['name']} (unsupported format): {e}")

# Save JSON backup too
with open("photos.json", "w") as f:
    json.dump(results, f, indent=2)

conn.close()
print("Tagged + captioned photos saved to photos.db and photos.json")
