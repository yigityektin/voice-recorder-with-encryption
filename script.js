const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const downloadBtn = document.getElementById("downloadBtn");
const audioPlayer = document.getElementById("audioPlayer");
const encryptionMethod = document.getElementById("encryptionMethod");

let mediaRecorder;
let audioChunks = [];
let audioBlob;

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
downloadBtn.addEventListener("click", downloadRecording);

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
      audioPlayer.src = URL.createObjectURL(audioBlob);
      downloadBtn.disabled = false;
    };

    mediaRecorder.start();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    downloadBtn.disabled = true;
  });
}

function stopRecording() {
  if (mediaRecorder.state === "recording") {
    mediaRecorder.stop();

    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

async function downloadRecording() {
  if (audioBlob) {
    const selectedEncryptionMethod = encryptionMethod.value;
    let encryptedBlob;

    if (selectedEncryptionMethod === "rsa") {
      encryptedBlob = await encryptWithRSA(audioBlob);
    } else if (selectedEncryptionMethod === "aes") {
      encryptedBlob = await encryptWithAES(audioBlob);
    } else {
      encryptedBlob = audioBlob;
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(encryptedBlob);
    downloadLink.download = generateFileName(selectedEncryptionMethod);
    downloadLink.click();
  }
}

function generateFileName(encryptionMethod) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${hours}-${minutes}.${day}_${month}_${year}_${encryptionMethod}.mp3`;
}

async function encryptWithRSA(blob) {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = keyPair.publicKey;
  const data = await blob.arrayBuffer();

  const chunkSize = 190;
  const dataChunks = [];
  const uint8Data = new Uint8Array(data);

  for (let i = 0; i < uint8Data.length; i += chunkSize) {
    dataChunks.push(uint8Data.slice(i, i + chunkSize));
  }

  const encryptedChunks = await Promise.all(
    dataChunks.map((chunk) =>
      window.crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
        },
        publicKey,
        chunk
      )
    )
  );

  const encryptedData = new Blob(encryptedChunks, {
    type: "application/octet-stream",
  });
  return encryptedData;
}

async function encryptWithAES(blob) {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = await blob.arrayBuffer();
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );

  const keyData = await window.crypto.subtle.exportKey("raw", key);
  const result = new Uint8Array(
    iv.byteLength + keyData.byteLength + encryptedData.byteLength
  );
  result.set(new Uint8Array(iv), 0);
  result.set(new Uint8Array(keyData), iv.byteLength);
  result.set(new Uint8Array(encryptedData), iv.byteLength + keyData.byteLength);

  return new Blob([result], { type: "application/octet-stream" });
}
