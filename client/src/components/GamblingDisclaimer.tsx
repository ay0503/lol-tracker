import { useTranslation } from "@/contexts/LanguageContext";

export default function GamblingDisclaimer() {
  const { language } = useTranslation();

  return (
    <p className="mt-6 text-center text-xs text-muted-foreground/60 font-mono">
      {language === "ko"
        ? "가상 화폐 전용 · 실제 돈 아님 · 놀이 목적"
        : "Virtual currency only · No real money · For entertainment"}
    </p>
  );
}
