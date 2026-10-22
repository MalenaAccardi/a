const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const store = getStore("survey-responses");
  const data = (await store.get("all_responses", { type: "json" })) || [];

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  if (method === "GET") {
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (method === "POST") {
    const { userId, expected } = body;
    const existingIndex = data.findIndex((r) => r.userId === userId);

    if (existingIndex >= 0) {
      data[existingIndex].expected = expected;
    } else {
      data.push({ userId, expected, real: null, t: Date.now() });
    }

    await store.setJSON("all_responses", data);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  if (method === "PUT") {
    const { userId, real } = body;
    const existingIndex = data.findIndex((r) => r.userId === userId);

    if (existingIndex >= 0) {
      data[existingIndex].real = real;
      await store.setJSON("all_responses", data);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 444, headers, body: JSON.stringify({ error: "Usuario no encontrado" }) };
  }

  if (method === "DELETE") {
    const { userId } = body;
    const newData = data.filter((r) => r.userId !== userId);
    await store.setJSON("all_responses", newData);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 405, headers, body: "Método no permitido" };
};