import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface TestAccount {
  id: string;
  email: string;
  role: string;
  label: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    id: 'test-student-001',
    email: 'student@g.nagano-c.ed.jp',
    role: 'student',
    label: '生徒',
  },
  {
    id: 'test-teacher-001',
    email: 'teacher@g.nagano-c.ed.jp',
    role: 'teacher',
    label: '教員',
  },
  {
    id: 'test-admin-001',
    email: 'admin@g.nagano-c.ed.jp',
    role: 'admin',
    label: '管理者',
  },
];

/**
 * Development-only component to quickly switch between test accounts
 * Only visible when import.meta.env.DEV is true
 */
export function AccountSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, userData } = useAuth();

  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleSwitchAccount = (account: TestAccount) => {
    console.log('Switching to account:', account);
    // Note: Actual implementation would require Firebase Admin SDK
    // or a backend endpoint to switch accounts securely
    alert(
      `アカウント切り替え機能は未実装です。\n\n` +
        `現在のユーザー: ${currentUser?.email || 'なし'}\n` +
        `切り替え先: ${account.email}\n\n` +
        `実装するには:\n` +
        `1. Firebase Console で ${account.email} のアカウントを作成\n` +
        `2. 通常のログインフローでログイン`
    );
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        title="開発モード: アカウント切り替え"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        {userData?.role || 'Guest'}
      </button>

      {/* Account List */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl p-4 min-w-[280px] border border-gray-200">
          <div className="mb-3 pb-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 text-sm">開発モード</h3>
            <p className="text-xs text-gray-500 mt-1">アカウント切り替え</p>
          </div>

          {/* Current Account */}
          {currentUser && (
            <div className="mb-3 pb-3 border-b border-gray-200">
              <p className="text-xs text-gray-500 mb-1">現在のアカウント:</p>
              <p className="text-sm font-medium text-gray-900">{currentUser.email}</p>
              <p className="text-xs text-gray-600 capitalize">{userData?.role || 'loading...'}</p>
            </div>
          )}

          {/* Test Accounts */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">テストアカウント:</p>
            {TEST_ACCOUNTS.map((account) => (
              <button
                key={account.id}
                onClick={() => handleSwitchAccount(account)}
                disabled={currentUser?.email === account.email}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  currentUser?.email === account.email
                    ? 'bg-purple-100 text-purple-900 cursor-not-allowed'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{account.label}</p>
                    <p className="text-xs text-gray-500">{account.email}</p>
                  </div>
                  {currentUser?.email === account.email && (
                    <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-700 py-2"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}
