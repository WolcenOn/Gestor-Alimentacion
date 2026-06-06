export async function scanBarcodeOnce() {
  if (!("BarcodeDetector" in window)) {
    throw new Error("BarcodeDetector no está disponible. Usa entrada manual.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("La cámara no está disponible. Usa entrada manual.");
  }
  const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 700));
    const codes = await detector.detect(video);
    if (!codes.length) throw new Error("No se detectó ningún código. Prueba de nuevo o introdúcelo manualmente.");
    return codes[0].rawValue;
  } finally {
    stream.getTracks().forEach(track => track.stop());
  }
}
