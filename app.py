import json
import os
from pathlib import Path
import uuid
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

# Taslakların kaydedileceği klasör
BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "documents"
os.makedirs(STORAGE_DIR, exist_ok=True)


@app.route("/")
def index():
    return send_from_directory(BASE_DIR / "templates", "index.html")



# 1. Tüm belgeleri listele (Sol menü için)
@app.route("/api/docs", methods=["GET"])
def list_docs():
    docs = []
    for filepath in STORAGE_DIR.glob("*.json"):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                docs.append(
                    {
                        "id": filepath.stem,
                        "title": data.get("seo", {}).get("h1")
                        or data.get("title")
                        or "İsimsiz Taslak",
                        "updated_at": os.path.getmtime(filepath),
                    }
                )
        except Exception:
            continue

    # En son güncelleneni en üste getir
    docs.sort(key=lambda x: x["updated_at"], reverse=True)
    return jsonify(docs)


# 2. Belge Kaydet / Güncelle (Otokayıt)
@app.route("/api/save", methods=["POST"])
def save_doc():
    data = request.json or {}
    doc_id = data.get("id") or str(uuid.uuid4())
    data["id"] = doc_id

    filepath = STORAGE_DIR / f"{doc_id}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return jsonify(
        {"status": "success", "id": doc_id, "message": "Buluta Kaydedildi"}
    )


# 3. Belge Detayını Getir
@app.route("/api/doc/<doc_id>", methods=["GET"])
def get_doc(doc_id):
    filepath = STORAGE_DIR / f"{doc_id}.json"
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"error": "Belge bulunamadı"}), 404


# 4. Belge Sil
@app.route("/api/doc/<doc_id>", methods=["DELETE"])
def delete_doc(doc_id):
    filepath = STORAGE_DIR / f"{doc_id}.json"
    if filepath.exists():
        os.remove(filepath)
        return jsonify({"status": "success"})
    return jsonify({"error": "Bulunamadı"}), 404


if __name__ == "__main__":
    app.run(debug=True, port=5213)