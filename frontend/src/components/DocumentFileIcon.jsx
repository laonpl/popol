import { FileText, Globe, Image, PenLine, ScrollText } from 'lucide-react';
import './DocumentFileIcon.css';

const formats = {
  pdf: { id: 'pdf', label: 'PDF', src: '/brand-icons/pdf.svg' },
  ppt: { id: 'powerpoint', label: 'PPT', src: '/brand-icons/powerpoint.svg' },
  pptx: { id: 'powerpoint', label: 'PPTX', src: '/brand-icons/powerpoint.svg' },
  hwp: { id: 'hwp', label: 'HWP', src: '/brand-icons/hwp.svg' },
  hwpx: { id: 'hwp', label: 'HWPX', src: '/brand-icons/hwp.svg' },
  doc: { id: 'google-docs', label: 'DOC', src: '/brand-icons/google-docs.svg' },
  docx: { id: 'google-docs', label: 'DOCX', src: '/brand-icons/google-docs.svg' },
  xls: { id: 'excel', label: 'XLS', src: '/brand-icons/excel.svg' },
  xlsx: { id: 'excel', label: 'XLSX', src: '/brand-icons/excel.svg' },
  csv: { id: 'excel', label: 'CSV', src: '/brand-icons/excel.svg' },
};
const mimeExtensions = {
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/x-hwp': 'hwp', 'application/haansofthwp': 'hwp', 'application/vnd.hancom.hwp': 'hwp',
  'application/hwp+zip': 'hwpx', 'application/vnd.hancom.hwpx': 'hwpx', 'application/x-hwpx': 'hwpx',
};

export function documentFilePresentation(file = {}, kind = '') {
  const extensionOf = value => {
    let name = String(value || '').split(/[?#]/)[0].trim();
    try { name = decodeURIComponent(name); } catch { /* Keep filenames containing a literal %. */ }
    return name.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  };
  const mimeType = String(file.mimeType || file.type || '').split(';')[0].trim().toLowerCase();
  const extension = extensionOf(file.name) || extensionOf(file.originalName) || extensionOf(file.filename) || extensionOf(file.url) || mimeExtensions[mimeType];
  if (formats[extension]) return formats[extension];
  if (extension) return { id: 'file', label: extension.toUpperCase(), Icon: /^(png|jpe?g|gif|webp|svg)$/.test(extension) ? Image : FileText };
  if (kind === 'ppt') return formats.ppt;
  if (kind === 'notion') return { id: 'notion', label: '노션형', src: '/brand-icons/notion.svg' };
  if (kind === 'web') return { id: 'web', label: '홈페이지', stamp: 'WEB', Icon: Globe };
  if (kind === 'cover') return { id: 'cover', label: '작성 문서', stamp: '자소서', Icon: PenLine };
  if (kind === 'resume') return { id: 'resume', label: '작성 문서', stamp: '이력서', Icon: ScrollText };
  return { id: 'file', label: '문서', stamp: '문서', Icon: FileText };
}

export default function DocumentFileIcon({ file, kind, presentation, className = '' }) {
  const format = presentation || documentFilePresentation(file, kind);
  const Icon = format.Icon || FileText;
  return <span className={`document-file-icon document-file-icon--${format.id} ${className}`} data-file-format={format.id} role="img" aria-label={`${format.stamp || format.label} 아이콘`}>
    {format.src ? <img src={format.src} alt="" draggable="false" /> : <span className="document-file-sheet"><Icon size={23} strokeWidth={1.6} /><b>{format.stamp || format.label}</b></span>}
  </span>;
}
