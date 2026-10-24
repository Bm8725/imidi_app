'use client'; 

import { useState } from 'react'; 

export default function SimpleUsbWriter() {
const [progress, setProgress] = useState(0);
const [message, setMessage] = useState('Conectați cablul și apăsați butonul de mai jos.'); 

const pornesteScrierea = async () => {
try {
setMessage('Alegeți folderul unității hardware...');
const root = await window.showDirectoryPicker({ mode: 'readwrite' }); 

setMessage('Se scrie pachetul direct prin USB...');
setProgress(0);

const fileHandle = await root.getFileHandle('PACKAGE.JBB', { create: true });
const writable = await fileHandle.createWritable();

const bucati = 10;
for (let i = 1; i <= bucati; i++) {
const date fictive = new Uint8Array(1024 * 1024); // 1 MB per bucată
await writable.write(date fictive);
setProgress(Math.round((i / bucati) * 100));
await new Promise((r) => setTimeout(r, 200)); // Delay scriere
}

await writable.close();
setMessage('✓ Finalizat! Pachetul a fost scris corect.');
} catch (err: any) {
if (err.name !== 'AbortError') {
setMessage(Eroare: ${err.message || 'Scriere eșuată'});
} else {
setMessage('Scriere anulată.');
}
setProgress(0);
}

}; 

return ( 

);
}