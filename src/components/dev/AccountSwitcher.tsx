import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type UserRole = 'student' | 'teacher' | 'staff' | 'admin';

interface RoleOption {
  role: UserRole;
  label: string;
  color: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { role: 'student', label: '生徒', color: 'bg-blue-500' },
  { role: 'teacher', label: '教員', color: 'bg-green-500' },
  { role: 'staff', label: 'スタッフ', color: 'bg-orange-500' },
  { role: 'admin', label: '管理者', color: 'bg-red-500' },
];

// アカウントスイッチが許可されたメールアドレス
const ALLOWED_EMAILS = ['ebi.sandwich.finland@gmail.com'];

/**
 * Development-only component to quickly switch between roles
 * Only accessible by specific allowed emails
 */
export function AccountSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { currentUser, userData, refreshUserData } = useAuth();

  // アクセス制限: 許可されたメールアドレスのみ表示
  if (!currentUser || !ALLOWED_EMAILS.includes(currentUser.email || '')) {
    return null;
  }

  const handleSwitchRole = async (role: UserRole) => {
    if (!currentUser) return;

    setSwitching(true);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, { role });
      await refreshUserData();
      setIsOpen(false);
    } catch (error) {
      console.error('Error switching role:', error);
      alert('ロールの切り替えに失敗しました');
    } finally {
      setSwitching(false);
    }
  };

  const currentRole = userData?.role || 'unknown';
  const currentRoleOption = ROLE_OPTIONS.find(r => r.role === currentRole);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${currentRoleOption?.color || 'bg-purple-600'} text-white px-4 py-2 rounded-full shadow-lg hover:opacity-90 transition-colors flex items-center gap-2`}
        title="開発モード: ロール切り替え"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-medium">{currentRoleOption?.label || currentRole}</span>
      </button>

      {/* Role Switcher Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl p-4 min-w-[280px] border border-gray-200">
          <div className="mb-3 pb-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 text-sm">開発モード</h3>
            <p className="text-xs text-gray-500 mt-1">ロール切り替え（{currentUser.email}）</p>
          </div>

          {/* Current Info */}
          <div className="mb-3 pb-3 border-b border-gray-200">
            <p className="text-xs text-gray-500 mb-1">現在のロール:</p>
            <div className="flex items-center gap-2">
              <span className={`${currentRoleOption?.color || 'bg-gray-500'} text-white text-xs px-2 py-1 rounded`}>
                {currentRoleOption?.label || currentRole}
              </span>
              {userData && (
                <span className="text-xs text-gray-600">{userData.username}</span>
              )}
            </div>
          </div>

          {/* Role Options */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">ロールを変更:</p>
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                onClick={() => handleSwitchRole(option.role)}
                disabled={switching || currentRole === option.role}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  currentRole === option.role
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`${option.color} w-3 h-3 rounded-full`} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                  {currentRole === option.role && (
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
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

          {switching && (
            <div className="mt-3 text-center text-xs text-gray-500">
              切り替え中...
            </div>
          )}

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
