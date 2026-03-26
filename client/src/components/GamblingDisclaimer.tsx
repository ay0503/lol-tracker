import { useTranslation } from "@/contexts/LanguageContext";

export default function GamblingDisclaimer() {
  const { language } = useTranslation();

  return (
    <div className="mt-6 pt-4 border-t border-zinc-800/50">
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3 space-y-2">
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          <span className="font-bold text-zinc-300">
            {language === "ko" ? "책임감 있는 게임:" : "Responsible Gambling:"}
          </span>{" "}
          {language === "ko"
            ? "이 카지노는 가상 화폐만 사용하는 놀이용입니다. 실제 돈은 사용되지 않습니다. 도박 문제로 어려움을 겪고 계신다면 도움을 받으실 수 있습니다."
            : "This is a virtual casino using play money only. No real money is wagered or won. However, if you or someone you know struggles with gambling, help is available."}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-500">
          <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors underline underline-offset-2">
            {language === "ko" ? "미국 도박문제 위원회" : "National Council on Problem Gambling"}
          </a>
          <span>
            {language === "ko" ? "상담전화: " : "Helpline: "}
            <a href="tel:1-800-522-4700" className="font-mono hover:text-zinc-300 transition-colors underline underline-offset-2">1-800-522-4700</a>
          </span>
          <span>
            {language === "ko" ? "문자: " : "Text: "}
            <span className="font-mono">HOME to 741741</span>
          </span>
        </div>
        <p className="text-[8px] text-zinc-600">
          {language === "ko" ? "24시간 운영 · 비밀 보장 · 무료" : "Available 24/7. Confidential. Free."}
        </p>
      </div>
    </div>
  );
}
