import React, { useState } from 'react';
import { X, Coins, ShieldCheck, CheckCircle2, History, CreditCard, Sparkles } from 'lucide-react';
import { CoinPackage, CoinTransaction } from '@/src/types/live';
import { Profile } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface LiveCoinStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  userCoins: number;
  packages: CoinPackage[];
  transactions: CoinTransaction[];
  onBuyCoins: (pkg: CoinPackage) => Promise<{ success: boolean; newBalance: number }>;
}

export const LiveCoinStoreModal: React.FC<LiveCoinStoreModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userCoins,
  packages,
  transactions,
  onBuyCoins,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'packages' | 'history'>('packages');
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(packages[1] || packages[0]);
  const [isConfirmedAge13, setIsConfirmedAge13] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!selectedPkg || !isConfirmedAge13) return;
    setIsProcessing(true);
    setSuccessMessage(null);

    const res = await onBuyCoins(selectedPkg);
    setIsProcessing(false);

    if (res.success) {
      setSuccessMessage(
        `Successfully added ${(selectedPkg.coins + selectedPkg.bonusCoins).toLocaleString()} Coins!`
      );
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Coins className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Live Coin Store</h3>
              <p className="text-xs text-neutral-400">Get coins to send gifts & unlock animations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Bar & Navigation Tabs */}
        <div className="px-5 py-3 bg-neutral-950/60 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-neutral-400">Current Balance:</span>
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold text-sm">
              <Coins className="w-4 h-4 fill-amber-400" />
              <span>{userCoins.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex rounded-xl bg-neutral-800 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('packages')}
              className={cn(
                'px-3 py-1 rounded-lg transition-colors',
                activeTab === 'packages' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              )}
            >
              Packages
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={cn(
                'px-3 py-1 rounded-lg transition-colors flex items-center space-x-1',
                activeTab === 'history' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center space-x-2 text-emerald-300 text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab 1: Packages */}
        {activeTab === 'packages' && (
          <div className="p-5 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {packages.map((pkg) => {
                const isSelected = selectedPkg?.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkg(pkg)}
                    className={cn(
                      'flex flex-col items-center p-3 rounded-2xl border transition-all relative group text-left cursor-pointer',
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-md shadow-amber-500/10'
                        : 'bg-neutral-800/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800'
                    )}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[9px] font-extrabold text-neutral-950 shadow">
                        POPULAR
                      </span>
                    )}

                    <div className="text-2xl mb-1 mt-1">🪙</div>

                    <div className="flex items-center space-x-1 text-white font-extrabold text-base">
                      <span>{pkg.coins.toLocaleString()}</span>
                    </div>

                    {pkg.bonusCoins > 0 ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-md mt-0.5">
                        +{pkg.bonusCoins} Bonus
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500 mt-0.5">Standard</span>
                    )}

                    <span className="mt-2 text-xs font-bold text-neutral-300 bg-neutral-900/80 px-2 py-1 rounded-lg border border-neutral-700/60 w-full text-center">
                      {pkg.priceFormatted}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Age 13+ Compliance Verification */}
            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-start space-x-2.5">
              <input
                id="ageCheckLive"
                type="checkbox"
                checked={isConfirmedAge13}
                onChange={(e) => setIsConfirmedAge13(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-700 text-amber-500 focus:ring-amber-400"
              />
              <label htmlFor="ageCheckLive" className="text-xs text-neutral-300 select-none cursor-pointer leading-relaxed">
                <span className="font-semibold text-neutral-100">13+ Age & Parental Consent: </span>
                I confirm I am at least 13 years old and have parental or legal consent to purchase virtual coins.
              </label>
            </div>

            {/* Purchase CTA */}
            <button
              type="button"
              disabled={isProcessing || !selectedPkg || !isConfirmedAge13}
              onClick={handlePurchase}
              className={cn(
                'w-full py-3 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center space-x-2',
                selectedPkg && isConfirmedAge13 && !isProcessing
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 hover:brightness-110 cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              )}
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Processing Purchase...'
                  : selectedPkg
                  ? `Confirm & Buy ${selectedPkg.coins.toLocaleString()} Coins (${selectedPkg.priceFormatted})`
                  : 'Select a Package'}
              </span>
            </button>
          </div>
        )}

        {/* Tab 2: Transaction History */}
        {activeTab === 'history' && (
          <div className="p-5 overflow-y-auto space-y-2.5 max-h-80">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                No coin transactions recorded yet.
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-neutral-200">{tx.description}</p>
                    <p className="text-[10px] text-neutral-500">
                      {new Date(tx.createdAt).toLocaleString()} · Bal: {tx.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-extrabold',
                      tx.amount > 0 ? 'text-emerald-400' : 'text-amber-400'
                    )}
                  >
                    {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
