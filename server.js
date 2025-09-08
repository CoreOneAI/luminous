async function extractPaletteFromFile(file, maxColors = 5) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    const w = 200; const h = Math.round((img.height / img.width) * w) || 200;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Simple quantization: bucket to 32 levels per channel, count freq
    const bucket = (v) => (v >> 3) << 3; // 0..255 -> steps of 8
    const counts = new Map();
    for (let p = 0; p < data.length; p += 4) {
      const r = bucket(data[p]), g = bucket(data[p + 1]), b = bucket(data[p + 2]);
      const a = data[p + 3];
      if (a < 200) continue; // ignore mostly transparent
      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([k]) => {
        const [r, g, b] = k.split(',').map(Number);
        return `rgb(${r}, ${g}, ${b})`;
      });
    return top;
  } finally {
    URL.revokeObjectURL(url);
  }
}
