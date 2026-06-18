import { getStore } from "@netlify/blobs";

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const jobId = params.get("jobId");

  if (!jobId) {
    return Response.json({ error: "Brak jobId" }, { status: 400 });
  }

  if (params.get("cancel") === "1") {
    const store = getStore("smart-jobs");
    await store.setJSON(jobId, { status: "cancelled", progress: 0 });
    return Response.json({ ok: true });
  }

  const store = getStore("smart-jobs");
  const data = await store.get(jobId, { type: "json" });

  if (data === null) {
    return Response.json({ error: "Job nie znaleziony" }, { status: 404 });
  }

  return Response.json(data);
};
