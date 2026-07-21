export async function fetchDocListApi() {
  try {
    const res = await fetch("/api/docs");
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) return null;

    return await res.json();
  } catch (e) {
    console.log("Local ortamsınız, sunucu bağlantısı atlandı.");
    return null;
  }
}

export async function fetchDocApi(id) {
  const res = await fetch(`/api/doc/${id}`);
  if (!res.ok) throw new Error("Belge bulunamadı");
  return await res.json();
}

export async function saveDocApi(payload) {
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function deleteDocApi(id) {
  const res = await fetch(`/api/doc/${id}`, { method: "DELETE" });
  return await res.json();
}
