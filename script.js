const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const downloadBtn = document.getElementById("downloadBtn");
const decryptBtn = document.getElementById("decryptBtn");
const audioPlayer = document.getElementById("audioPlayer");
const encryptionMethod = document.getElementById("encryptionMethod");

let mediaRecorder;
let audioChunks = [];
let audioBlob;
let encryptedBlob;
let rsaKeyPair;
let aesKey;
let aesIv;

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
downloadBtn.addEventListener("click", downloadRecording);
decryptBtn.addEventListener("click", decryptRecording);

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
    decryptBtn.disabled = true;
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

    if (selectedEncryptionMethod === "rsa") {
      rsaKeyPair = await generateRSAKeyPair();
      encryptedBlob = await encryptWithRSA(audioBlob, rsaKeyPair.publicKey);
    } else if (selectedEncryptionMethod === "aes") {
      const encryptionResult = await encryptWithAES(audioBlob);
      aesKey = encryptionResult.key;
      aesIv = encryptionResult.iv;
      encryptedBlob = encryptionResult.blob;
    } else {
      encryptedBlob = audioBlob;
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(encryptedBlob);
    downloadLink.download = generateFileName(selectedEncryptionMethod);
    downloadLink.click();

    decryptBtn.disabled = selectedEncryptionMethod === "none";
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

async function generateRSAKeyPair() {
  return window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptWithRSA(blob, publicKey) {
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

  return new Blob(encryptedChunks, { type: "application/octet-stream" });
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

  return {
    key: key,
    iv: iv,
    blob: new Blob([iv, encryptedData], { type: "application/octet-stream" }),
  };
}

async function decryptRecording() {
  const selectedEncryptionMethod = encryptionMethod.value;
  let decryptedBlob;

  if (selectedEncryptionMethod === "rsa") {
    decryptedBlob = await decryptWithRSA(encryptedBlob, rsaKeyPair.privateKey);
  } else if (selectedEncryptionMethod === "aes") {
    decryptedBlob = await decryptWithAES(encryptedBlob, aesKey, aesIv);
  } else {
    decryptedBlob = audioBlob;
  }

  if (decryptedBlob) {
    audioPlayer.src = URL.createObjectURL(decryptedBlob);

    const downloadLink = document.createElement("a");
    downloadLink.href = audioPlayer.src;
    downloadLink.download = generateFileName("decrypted");
    downloadLink.click();
  }
}

async function decryptWithRSA(blob, privateKey) {
  const data = await blob.arrayBuffer();
  const uint8Data = new Uint8Array(data);

  const chunkSize = 256;
  const encryptedChunks = [];
  for (let i = 0; i < uint8Data.length; i += chunkSize) {
    encryptedChunks.push(uint8Data.slice(i, i + chunkSize));
  }

  const decryptedChunks = await Promise.all(
    encryptedChunks.map((chunk) =>
      window.crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
        },
        privateKey,
        chunk
      )
    )
  );

  const decryptedData = decryptedChunks.reduce((acc, chunk) => {
    const chunkArray = new Uint8Array(chunk);
    const newArray = new Uint8Array(acc.length + chunkArray.length);
    newArray.set(acc);
    newArray.set(chunkArray, acc.length);
    return newArray;
  }, new Uint8Array());

  return new Blob([decryptedData], { type: "audio/mp3" });
}

async function decryptWithAES(blob, key, iv) {
  const data = await blob.arrayBuffer();
  const encryptedData = new Uint8Array(data, iv.byteLength);

  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedData
  );

  return new Blob([decryptedData], { type: "audio/mp3" });
}
