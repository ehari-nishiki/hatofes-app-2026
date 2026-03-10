import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { auth, db } from '@/lib/firebase'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Toast, useToast } from '@/components/ui/Toast'
import { BADGES } from '@/lib/badgeSystem'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { RoleBadge, getRoleDisplayLabel } from '@/lib/roleDisplay'
import {
  PageBackLink,
  PageEmptyState,
  PageHero,
  PageMetric,
  PageSection,
  PageSectionTitle,
  UserPageShell,
} from '@/components/layout/UserPageShell'

export default function ProfilePage() {
  const { currentUser, userData, refreshUserData } = useAuth()
  const [editingRealName, setEditingRealName] = useState(false)
  const [realName, setRealName] = useState('')
  const [savingRealName, setSavingRealName] = useState(false)
  const [editingProfileImage, setEditingProfileImage] = useState(false)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [savingProfileImage, setSavingProfileImage] = useState(false)
  const { toast, showToast, hideToast } = useToast()

  const getUserId = () => {
    if (!currentUser) return ''
    return currentUser.uid.substring(0, 8).toUpperCase()
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSaveRealName = async () => {
    if (!currentUser || !realName.trim()) return

    setSavingRealName(true)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        realName: realName.trim(),
      })
      await refreshUserData?.()
      setEditingRealName(false)
    } catch (error) {
      console.error('Error saving real name:', error)
    } finally {
      setSavingRealName(false)
    }
  }

  const handleSaveProfileImage = async () => {
    if (!currentUser) return

    setSavingProfileImage(true)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        profileImageUrl: profileImageUrl || null,
      })
      await refreshUserData?.()
      setEditingProfileImage(false)
    } catch (error) {
      console.error('Error saving profile image:', error)
      showToast('プロフィール画像の保存に失敗しました', 'error')
    } finally {
      setSavingProfileImage(false)
    }
  }

  const isStaffOrAdmin = userData?.role === 'staff' || userData?.role === 'admin'

  const formatDisplayDate = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  useEffect(() => {
    if (!editingProfileImage) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingProfileImage) {
        setEditingProfileImage(false)
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [editingProfileImage, savingProfileImage])

  if (!userData) {
    return (
      <div className="theme-bg flex min-h-screen items-center justify-center">
        <div className="theme-text">読み込み中...</div>
      </div>
    )
  }

  const earnedBadges = userData.badges || []

  return (
    <UserPageShell username={userData.username} grade={userData.grade} classNumber={userData.class}>
      {toast ? <Toast message={toast.message} type={toast.type} onClose={hideToast} /> : null}

      <PageHero
        eyebrow="Account"
        title={`Welcome, ${userData.username}`}
        description="アカウント情報、プロフィール画像、獲得バッジ、ログイン状況をここで管理します。"
        aside={<PageBackLink />}
      />

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <PageSection>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar name={userData.username} imageUrl={userData.profileImageUrl} size="xl" />
              <div className="min-w-0">
                <p className="theme-text-muted text-[11px] uppercase tracking-[0.2em]">Identity</p>
                <h2 className="theme-text mt-2 text-2xl font-semibold tracking-[-0.04em]">{userData.username}</h2>
                <p className="theme-text-secondary mt-2 text-sm">{getAffiliationLabel(userData.role, userData.grade, userData.class, userData.studentNumber)}</p>
              </div>
            </div>

            <div className="theme-bg mt-5 rounded-[1rem] border theme-border p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <InfoChip label="Grade" value={userData.grade ? `${userData.grade}年` : '-'} />
                <InfoChip label="Class" value={userData.class ? `${userData.class}組` : '-'} />
                <InfoChip label="Role" value={getRoleDisplayLabel(userData.role, userData.department)} />
                <InfoChip label="ID" value={getUserId()} />
              </div>
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Activity" title="利用状況" />
            <div className="grid gap-3 sm:grid-cols-2">
              <PageMetric label="Total Points" value={userData.totalPoints.toLocaleString()} unit="pt" tone="accent" />
              <PageMetric label="Login Streak" value={(userData.loginStreak ?? 0).toString()} unit="days" />
              <PageMetric label="Registered" value={formatDisplayDate(new Date(userData.createdAt.seconds * 1000))} />
              <PageMetric label="Last Login" value={formatDisplayDate(userData.lastLoginDate)} tone="soft" />
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle eyebrow="Actions" title="プロフィール操作" />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setProfileImageUrl(userData.profileImageUrl || '')
                  setEditingProfileImage(true)
                }}
                className="btn-main inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-medium"
              >
                プロフィール画像を変更
              </button>
              <Link
                to="/settings"
                className="inline-flex h-11 items-center justify-center rounded-[1rem] border px-4 text-sm font-medium transition-colors"
                style={{
                  borderColor: 'var(--color-border-light)',
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                設定
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex h-11 items-center justify-center rounded-[1rem] border px-4 text-sm font-medium transition-colors"
                style={{
                  borderColor: '#c95a64',
                  backgroundColor: 'rgba(226,77,77,0.12)',
                  color: '#e24d4d',
                }}
              >
                ログアウト
              </button>
            </div>
          </PageSection>
        </div>

        <div className="space-y-4">
          <PageSection>
            <PageSectionTitle eyebrow="Account Detail" title="アカウント情報" />
            <div className="space-y-3">
              <DetailRow label="メールアドレス" value={userData.email} />
              <DetailRow label="ユーザーネーム" value={userData.username} />
              <DetailRow label="所属" value={getAffiliationLabel(userData.role, userData.grade, userData.class)} />
              <div className="theme-bg rounded-[1rem] border theme-border p-4">
                <p className="theme-text-secondary text-xs">役職</p>
                <div className="mt-2">
                  <RoleBadge role={userData.role} department={userData.department} />
                </div>
              </div>
              {isStaffOrAdmin ? (
                <div className="theme-bg rounded-[1rem] border theme-border p-4">
                  <p className="theme-text-secondary text-xs">本名（通知・アンケート作成時に表示）</p>
                  {editingRealName ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={realName}
                        onChange={(event) => setRealName(event.target.value)}
                        placeholder="本名を入力"
                        className="input-field h-11 flex-1 rounded-[0.9rem] px-3 text-sm"
                      />
                      <button
                        onClick={handleSaveRealName}
                        disabled={savingRealName || !realName.trim()}
                        className="btn-main h-11 rounded-[0.9rem] px-4 text-sm font-medium disabled:opacity-50"
                      >
                        {savingRealName ? '保存中...' : '保存'}
                      </button>
                      <button
                        onClick={() => setEditingRealName(false)}
                        className="h-11 rounded-[0.9rem] border px-4 text-sm"
                        style={{
                          borderColor: 'var(--color-border-light)',
                          backgroundColor: 'var(--color-bg-card)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="theme-text text-sm">{userData.realName || '未設定'}</p>
                      <button
                        onClick={() => {
                          setRealName(userData.realName || '')
                          setEditingRealName(true)
                        }}
                        className="theme-text-secondary text-sm transition-colors hover:opacity-80"
                      >
                        編集
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </PageSection>

          <PageSection>
            <PageSectionTitle
              eyebrow="Badge Collection"
              title="獲得バッジ"
              meta={
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
                >
                  {earnedBadges.length}/{BADGES.length}
                </span>
              }
            />
            {earnedBadges.length === 0 ? (
              <PageEmptyState title="まだバッジを獲得していません" description="ログインや企画参加でバッジを集められます。" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BADGES.map((badge) => {
                  const isEarned = earnedBadges.includes(badge.id)
                  return (
                    <div
                      key={badge.id}
                      className={`rounded-[1rem] border p-4 ${isEarned ? '' : 'opacity-45'}`}
                      style={{
                        backgroundColor: isEarned ? 'var(--color-bg)' : 'var(--color-bg-card)',
                        borderColor: 'var(--color-border-light)',
                      }}
                      title={isEarned ? `${badge.name}: ${badge.description}` : '???'}
                    >
                      <span className="text-2xl">{isEarned ? badge.icon : '?'}</span>
                      <p className="theme-text mt-3 text-sm font-medium">{isEarned ? badge.name : '???'}</p>
                      <p className="theme-text-secondary mt-1 text-xs leading-5">{isEarned ? badge.description : '条件を満たすと表示されます。'}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </PageSection>
        </div>
      </div>

      {editingProfileImage ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget && !savingProfileImage) {
              setEditingProfileImage(false)
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-[1.5rem] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
            style={{
              borderColor: 'var(--color-border-light)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <h2 className="theme-text text-xl font-semibold tracking-[-0.04em]">プロフィール画像を変更</h2>

            <div className="mt-5">
              <ImageUploader
                imageUrl={profileImageUrl}
                onChange={setProfileImageUrl}
                label="プロフィール画像"
                showGoogleDrive={false}
              />
            </div>

            <p className="theme-text-secondary mt-4 text-xs">
              画像は正方形に切り抜かれて表示されます。最大500KBまでです。
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditingProfileImage(false)}
                className="flex-1 rounded-[0.95rem] border py-2.5 text-sm transition-colors"
                style={{
                  borderColor: 'var(--color-border-light)',
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveProfileImage}
                disabled={savingProfileImage}
                className="btn-main flex-1 rounded-[0.95rem] py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {savingProfileImage ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UserPageShell>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-bg-card rounded-[0.9rem] border theme-border px-3 py-3">
      <p className="theme-text-muted text-[10px] uppercase tracking-[0.2em]">{label}</p>
      <p className="theme-text mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-bg rounded-[1rem] border theme-border p-4">
      <p className="theme-text-secondary text-xs">{label}</p>
      <p className="theme-text mt-2 text-sm">{value}</p>
    </div>
  )
}

function getAffiliationLabel(
  role: string,
  grade?: number | 'teacher',
  classNumber?: string,
  studentNumber?: number | null
) {
  if (role === 'teacher') return '教員'
  if (role === 'staff') return 'スタッフ'
  if (grade && classNumber) {
    return studentNumber != null
      ? `${grade}年${classNumber}組 ${studentNumber}番`
      : `${grade}年${classNumber}組`
  }
  return '未設定'
}
