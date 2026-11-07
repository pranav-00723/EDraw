async function sendToOCRTrainer(imageBlob) {
    const formData = new FormData();
    formData.append("file", imageBlob, "edraw_canvas.png");

    try {
        // If running locally, point to your ocr-trainer server URL
        const response = await fetch("http://localhost:8000/api/parse-projection", {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        if (result.status === "success") {
            console.log("Parsed Engineering Data:", result);
            // Render the recognized text labels and projection lines onto the Edraw canvas automatically
            renderParsedElementsToCanvas(result);
        }
    } catch (error) {
        console.error("OCR Trainer connection failed:", error);
    }
}

function renderParsedElementsToCanvas(data) {
    // Logic to draw labels like a', b', c' and projection lines in your Edraw canvas workspace
}
