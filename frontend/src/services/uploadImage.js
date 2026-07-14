/**
 * uploadImage.js
 * 이미지 파일을 Canvas로 리사이즈한 뒤 Firebase Storage(/api/upload/image)에 올리고
 * 공개 URL을 돌려준다.
 *
 * 과거에는 이미지를 base64 data URL로 변환해 포트폴리오 문서에 그대로 저장했는데,
 * 이미지가 몇 장만 쌓여도 Firestore 문서 1MB 한도를 넘겨 저장(PATCH)이 500으로 실패했다.
 * 이제 이미지는 항상 Storage에 올리고 문서에는 URL만 보관한다.
 */
import api from './api';

// 파일 → 리사이즈된 JPEG Blob. (긴 변 maxPx 이하로 축소)
export function resizeImageToBlob(file, maxPx = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (!width || !height) { reject(new Error('이미지 크기를 읽지 못했습니다')); return; }
      const scale = Math.min(maxPx / width, maxPx / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => blob ? resolve({ blob, width, height }) : reject(new Error('이미지 변환에 실패했습니다')),
          'image/jpeg',
          quality,
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지를 불러오지 못했습니다')); };
    img.src = objectUrl;
  });
}

// 파일 업로드 → { url, filename, width, height }
export async function uploadImageFile(file, maxPx = 1200, quality = 0.8) {
  const { blob, width, height } = await resizeImageToBlob(file, maxPx, quality);
  const fd = new FormData();
  fd.append('file', blob, 'image.jpg');
  const { data } = await api.post('/upload/image', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return { url: data.url, filename: data.filename, width, height };
}

// 호출부 호환용: 업로드 후 URL 문자열만 반환. (기존 resizeToBase64 자리 그대로 대체)
export async function uploadImageUrl(file, maxPx = 1200, quality = 0.8) {
  const { url } = await uploadImageFile(file, maxPx, quality);
  return url;
}

// 레거시 포트폴리오/경험에 남아 있는 data:image Base64도 같은 업로드 경로로 이전한다.
export async function uploadImageDataUrl(dataUrl, maxPx = 1200, quality = 0.8) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl || '';
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('기존 이미지 데이터를 읽지 못했습니다');
  const blob = await response.blob();
  const extension = blob.type?.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const file = new File([blob], `legacy-image.${extension}`, { type: blob.type || 'image/jpeg' });
  return uploadImageUrl(file, maxPx, quality);
}
