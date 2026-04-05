import { useTranslation } from "@/contexts/LanguageContext";
import { User } from "lucide-react";
import { motion } from "framer-motion";

const CREATOR_PHOTO_FORMAL = new URL("../../../data/DSC01880.JPG", import.meta.url).href;
const CREATOR_PHOTO_TRAVEL = new URL("../../../data/20220729_171511.jpg", import.meta.url).href;
const CREATOR_PHOTO_CHAOS = new URL("../../../data/image-3.png", import.meta.url).href;

export default function About() {
  const { language } = useTranslation();

  const creatorTitle = language === "ko" ? "이 웹사이트의 제작자" : "Creator of This Website";
  const creatorSubtitle = language === "ko"
    ? "랭크 추적, 밈, 사이드 퀘스트 경제를 하나로 묶은 사람."
    : "The person who decided rank tracking, markets, memes, and side quests belonged in one website.";
  const creatorBody = language === "ko"
    ? "Andrew Youn은 친구들의 경쟁심을 그냥 두지 않고, 그것을 실시간 리그 랭크 추적기와 예측 시장, 그리고 코스메틱을 위한 카지노까지 갖춘 제품으로 키워낸 사람입니다. 이 프로젝트는 과하게 진지한 부분과 완전히 장난스러운 부분이 한데 섞여 있는데, 그 균형 자체가 Andrew의 감각에 가깝습니다."
    : "Andrew Youn is the builder behind the whole experiment: taking a friend-group obsession with League rank swings and turning it into a live tracker, a prediction market, and a cosmetics-fueled casino. The site is equal parts overengineered, competitive, and unserious in exactly the way a good group project should be.";
  const creatorBodyTwo = language === "ko"
    ? "사진 셋만 봐도 분위기가 잘 드러납니다. 어느 날은 정장 차림으로 제품 발표를 할 것 같고, 어느 날은 여행 중에도 뭔가를 만들어내며, 또 어느 날은 패치 노트보다 먼저 기절해 있습니다. 그래도 결국 다음 기능은 또 추가됩니다."
    : "The three photos more or less tell the story: one part polished operator, one part chaotic field researcher, and one part fully exhausted after shipping too much. Somehow that combination is what made this site happen.";

  const galleryItems = [
    {
      src: CREATOR_PHOTO_FORMAL,
      alt: language === "ko" ? "정장을 입은 Andrew Youn" : "Andrew Youn in a suit",
      title: "Andrew Youn",
      caption: language === "ko" ? "정식 모드" : "Serious Mode",
      className: "h-72",
    },
    {
      src: CREATOR_PHOTO_TRAVEL,
      alt: language === "ko" ? "여행 중인 Andrew Youn" : "Andrew Youn while traveling",
      title: language === "ko" ? "여행 중에도 제작 중" : "Still Building On Vacation",
      caption: language === "ko" ? "사이드 퀘스트 현장 조사" : "Side-quest field research",
      className: "h-72",
    },
    {
      src: CREATOR_PHOTO_CHAOS,
      alt: language === "ko" ? "담요에 감싸여 쉬고 있는 Andrew Youn" : "Andrew Youn wrapped in a blanket resting",
      title: language === "ko" ? "패치 후 재부팅" : "Post-Deploy Recovery",
      caption: language === "ko" ? "기능은 늘어나고 잠은 줄어듭니다" : "Features up, sleep down",
      className: "md:col-span-2 h-56",
      imageClassName: "object-contain bg-background",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 260 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_34%)]" />
          <div className="relative grid gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">
                <User className="h-3.5 w-3.5" />
                {creatorTitle}
              </div>
              <h2 className="max-w-2xl text-2xl font-bold text-foreground font-[var(--font-heading)] sm:text-3xl">
                Andrew Youn
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {creatorSubtitle}
              </p>
              <div className="mt-5 space-y-3 text-sm leading-7 text-foreground/80 sm:text-[15px]">
                <p>{creatorBody}</p>
                <p>{creatorBodyTwo}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {galleryItems.map((item) => (
                <div
                  key={item.src}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-card ${item.className}`}
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    className={`h-full w-full transition-transform duration-500 group-hover:scale-[1.03] ${(item as any).imageClassName ?? "object-cover"}`}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-4 pt-12">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-foreground/80">{item.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
