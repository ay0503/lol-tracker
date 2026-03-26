import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export function useCosmetics() {
  const { data } = trpc.casino.shop.allEquipped.useQuery(undefined, {
    staleTime: 60_000,
  });

  const lookup = useMemo(() => {
    const map = new Map<number, { title: any; nameEffect: any }>();
    if (data) {
      for (const entry of data) {
        map.set(entry.userId, { title: entry.title, nameEffect: entry.nameEffect });
      }
    }
    return map;
  }, [data]);

  return {
    getCosmetics: (userId: number) => lookup.get(userId) ?? { title: null, nameEffect: null },
  };
}
