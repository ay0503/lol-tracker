export default function GamblingDisclaimer() {
  return (
    <div className="mt-6 pt-4 border-t border-zinc-800/50">
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3 space-y-2">
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          <span className="font-bold text-zinc-300">Responsible Gambling:</span>{" "}
          This is a virtual casino using play money only. No real money is wagered or won.
          However, if you or someone you know struggles with gambling, help is available.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-500">
          <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors underline underline-offset-2">
            National Council on Problem Gambling
          </a>
          <span>
            Helpline: <a href="tel:1-800-522-4700" className="font-mono hover:text-zinc-300 transition-colors underline underline-offset-2">1-800-522-4700</a>
          </span>
          <span>
            Text: <span className="font-mono">HOME to 741741</span>
          </span>
        </div>
        <p className="text-[8px] text-zinc-600">
          Available 24/7. Confidential. Free.
        </p>
      </div>
    </div>
  );
}
