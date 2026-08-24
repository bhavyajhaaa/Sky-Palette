export type ProcessedImage = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  colors: string[];
};
const hex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
const rgb = (h: string) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5), 16),
];
const light = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  return Math.max(r, g, b) + Math.min(r, g, b);
};
const hue = (h: string) => {
  const [r, g, b] = rgb(h),
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  if (!d) return 0;
  return (
    (60 *
      ((mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d) +
        6)) %
    360
  );
};
export function sortColors(c: string[]) {
  return [...c].sort((a, b) => hue(a) - hue(b) || light(a) - light(b));
}
export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const originalWidth = bitmap.width,
    originalHeight = bitmap.height;
  const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale),
    height = Math.round(bitmap.height * scale),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const sample = document.createElement("canvas");
  sample.width = 100;
  sample.height = 100;
  const sc = sample.getContext("2d")!;
  sc.drawImage(canvas, 0, 0, 100, 100);
  const data = sc.getImageData(0, 0, 100, 100).data,
    pts: number[][] = [];
  for (let i = 0; i < data.length; i += 16)
    if (data[i + 3] > 200) pts.push([data[i], data[i + 1], data[i + 2]]);
  let centers = Array.from(
    { length: 12 },
    (_, i) => pts[Math.floor(((i + 0.5) * pts.length) / 12)] || [128, 128, 128],
  ).map((x) => [...x]);
  for (let n = 0; n < 10; n++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let k = 0,
        d = Infinity;
      centers.forEach((c, j) => {
        const q = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (q < d) {
          d = q;
          k = j;
        }
      });
      sums[k][0] += p[0];
      sums[k][1] += p[1];
      sums[k][2] += p[2];
      sums[k][3]++;
    }
    centers = centers.map((c, i) =>
      sums[i][3]
        ? [
            sums[i][0] / sums[i][3],
            sums[i][1] / sums[i][3],
            sums[i][2] / sums[i][3],
          ]
        : c,
    );
  }
  const colors = sortColors([
    ...new Set(centers.map((c) => hex(c[0], c[1], c[2]))),
  ]);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(Error("WebP unavailable"))),
      "image/webp",
      0.72,
    ),
  );
  return {
    blob,
    url: URL.createObjectURL(blob),
    width,
    height,
    originalWidth,
    originalHeight,
    colors,
  };
}
