import sqlite3

# Connect to database
conn = sqlite3.connect("photos.db")
cur = conn.cursor()

# Example search terms
keywords = ["car", "sunset"]

# NEW: Allow both "AND" (strict) and "OR" (broad) searches
# Change this variable to "AND" or "OR"
search_mode = "OR"   # try "AND" if you want strict matches

# Build WHERE clause dynamically
where_clause = f" {search_mode} ".join([
    f"(tags LIKE '%{kw}%' OR caption LIKE '%{kw}%')" for kw in keywords
])

query = f"SELECT filename, tags, caption, link FROM photos WHERE {where_clause} LIMIT 10"
cur.execute(query)

rows = cur.fetchall()

if not rows:
    print("❌ No matches found. Try changing search_mode or keywords.")
else:
    for row in rows:
        print("📸 Photo:", row)
