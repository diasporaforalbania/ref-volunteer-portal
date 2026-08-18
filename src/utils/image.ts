export function shrinkImage(file: File, maxSide: number, quality = 0.86): Promise<File> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 900 * 1024) {
        URL.revokeObjectURL(url);
        return resolve(file);
      }
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return resolve(file);
      }
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(
        b => {
          URL.revokeObjectURL(url);
          resolve(b ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
