import { useState, useEffect, useCallback } from 'react';
import { Profile } from '../types';
import { CoinPackage, CoinTransaction, COIN_PACKAGES } from '../types/live';
import { LiveStorageService } from '../lib/live/live-storage';

export function useLiveCoins(user: Profile | null) {
  const [balance, setBalance] = useState<number>(1200);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(false);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [lastPurchasedPackage, setLastPurchasedPackage] = useState<CoinPackage | null>(null);

  const refreshCoins = useCallback(() => {
    if (!user) return;
    const stats = LiveStorageService.getStats(user.id);
    setBalance(stats.coinsBalance);
    setTransactions(LiveStorageService.getTransactions(user.id));
  }, [user]);

  useEffect(() => {
    refreshCoins();
  }, [refreshCoins]);

  const buyCoins = async (pkg: CoinPackage): Promise<{ success: boolean; newBalance: number }> => {
    if (!user) return { success: false, newBalance: balance };
    setIsPurchasing(true);

    try {
      // Simulate secure payment processing gateway
      await new Promise((res) => setTimeout(res, 900));

      // Call API
      const res = await fetch('/api/live/coins/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          packageId: pkg.id,
          coins: pkg.coins,
          bonusCoins: pkg.bonusCoins,
        }),
      });

      const data = await res.json();
      const totalCoins = pkg.coins + pkg.bonusCoins;

      // Update local storage and stats
      const newBal = LiveStorageService.creditCoins(
        user.id,
        totalCoins,
        `Purchased ${pkg.coins.toLocaleString()} Coins (+${pkg.bonusCoins} bonus)`
      );

      setBalance(newBal);
      setLastPurchasedPackage(pkg);
      refreshCoins();
      setIsPurchasing(false);
      return { success: true, newBalance: newBal };
    } catch (e) {
      setIsPurchasing(false);
      // Fallback credit locally
      const totalCoins = pkg.coins + pkg.bonusCoins;
      const newBal = LiveStorageService.creditCoins(user.id, totalCoins, `Purchased ${pkg.coins} Coins`);
      setBalance(newBal);
      refreshCoins();
      return { success: true, newBalance: newBal };
    }
  };

  const deductCoinsForGift = (amount: number, description: string): boolean => {
    if (!user) return false;
    const res = LiveStorageService.deductCoins(user.id, amount, description);
    if (res.success) {
      setBalance(res.newBalance);
      refreshCoins();
      return true;
    }
    return false;
  };

  return {
    balance,
    transactions,
    packages: COIN_PACKAGES,
    isStoreOpen,
    setIsStoreOpen,
    isPurchasing,
    lastPurchasedPackage,
    buyCoins,
    deductCoinsForGift,
    refreshCoins,
  };
}
