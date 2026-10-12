import { useState } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

export const JOB_SITES = [
  {
    name: "잡코리아",
    domain: "jobkorea.co.kr",
    color: "bg-blue-500",
    url: "https://www.jobkorea.co.kr/starter/calendar",
  },
  {
    name: "사람인",
    domain: "saramin.co.kr",
    color: "bg-green-500",
    url: "https://calendar.saramin.co.kr",
  },
  {
    name: "자소설닷컴",
    domain: "jasoseol.com",
    color: "bg-purple-500",
    url: "https://jasoseol.com/recruit",
  },
];

export default function JobSiteLinks({ className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative flex justify-center ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-bluewood-400 border border-surface-200 rounded-lg hover:border-bluewood-300 hover:text-bluewood-700 bg-white transition-colors"
      >
        <Search size={13} /> 지원할 공고 찾아보기{" "}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 bg-white border border-surface-200 rounded-xl shadow-lg z-10 py-1 min-w-[200px]">
          {JOB_SITES.map((site) => (
            <a
              key={site.name}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 text-[13px] text-bluewood-700 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${site.color}`} />
              {site.name} 공채달력
              <ExternalLink size={12} className="text-bluewood-300 ml-auto" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
