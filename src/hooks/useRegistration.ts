import { useState, useCallback } from 'react'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { RegistrationState, RegistrationStep, RegistrationData } from '@/types/auth'
import { generateUsername } from '@/mocks/wordLists'
import type { User } from '../types/firestore'

const initialState: RegistrationState = {
  step: 'google-auth',
  data: {},
}

export function useRegistration() {
  const [state, setState] = useState<RegistrationState>(initialState)

  // ステップを進める（教員の場合はクラス・名簿番号をスキップ）
  const getNextStep = useCallback((currentStep: RegistrationStep, isTeacher: boolean): RegistrationStep => {
    const studentSteps: RegistrationStep[] = [
      'initial',
      'google-auth',
      'grade',
      'class',
      'student-number',
      'word1',
      'word2',
      'word3',
      'loading',
      'success',
    ]

    const teacherSteps: RegistrationStep[] = [
      'initial',
      'google-auth',
      'grade',
      'word1',  // クラス・名簿番号をスキップ
      'word2',
      'word3',
      'loading',
      'success',
    ]

    const steps = isTeacher ? teacherSteps : studentSteps
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex < steps.length - 1) {
      return steps[currentIndex + 1]
    }
    return currentStep
  }, [])

  // ステップを戻る
  const getPrevStep = useCallback((currentStep: RegistrationStep, isTeacher: boolean): RegistrationStep => {
    const studentSteps: RegistrationStep[] = [
      'google-auth',
      'grade',
      'class',
      'student-number',
      'word1',
      'word2',
      'word3',
    ]

    const teacherSteps: RegistrationStep[] = [
      'google-auth',
      'grade',
      'word1',
      'word2',
      'word3',
    ]

    const steps = isTeacher ? teacherSteps : studentSteps
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      return steps[currentIndex - 1]
    }
    return currentStep
  }, [])

  const nextStep = useCallback(() => {
    const isTeacher = state.data.grade === 'teacher'
    const next = getNextStep(state.step, isTeacher)
    setState(prev => ({ ...prev, step: next }))
  }, [state.step, state.data.grade, getNextStep])

  const prevStep = useCallback(() => {
    const isTeacher = state.data.grade === 'teacher'
    const prevStepValue = getPrevStep(state.step, isTeacher)
    setState(s => ({ ...s, step: prevStepValue }))
  }, [state.step, state.data.grade, getPrevStep])

  // 特定のステップに移動
  const goToStep = useCallback((step: RegistrationStep) => {
    setState(prev => ({ ...prev, step }))
  }, [])

  // データを更新
  const updateData = useCallback((data: Partial<RegistrationData>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...data },
    }))
  }, [])

  // 学年を設定して次へ
  const setGrade = useCallback((grade: number | 'teacher') => {
    setState(prev => {
      const newData = { ...prev.data, grade }
      const isTeacher = grade === 'teacher'
      // 教員の場合はクラス・名簿番号をデフォルト設定
      if (isTeacher) {
        newData.classNumber = '-'
        newData.studentNumber = 0
      }
      const nextStepValue = getNextStep('grade', isTeacher)
      return {
        ...prev,
        data: newData,
        step: nextStepValue,
      }
    })
  }, [getNextStep])

  // クラスを設定して次へ
  const setClass = useCallback((classNumber: string) => {
    updateData({ classNumber })
    nextStep()
  }, [updateData, nextStep])

  // 名簿番号を設定して次へ
  const setStudentNumber = useCallback((studentNumber: number) => {
    updateData({ studentNumber })
    nextStep()
  }, [updateData, nextStep])

  // 単語1を設定して次へ
  const setWord1 = useCallback((word1: string) => {
    updateData({ word1 })
    nextStep()
  }, [updateData, nextStep])

  // 単語2を設定して次へ
  const setWord2 = useCallback((word2: string) => {
    updateData({ word2 })
    nextStep()
  }, [updateData, nextStep])

  // 単語3を設定して登録処理へ
  const setWord3 = useCallback((word3: string) => {
    const word1 = state.data.word1 || ''
    const word2 = state.data.word2 || ''
    const username = generateUsername(word1, word2, word3)
    setState(prev => ({
      ...prev,
      data: { ...prev.data, word3, username },
      step: 'loading',
    }))
  }, [state.data])

  // 登録処理を実行
  const submitRegistration = useCallback(async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser || !currentUser.email) {
        throw new Error('ログインしているユーザーが見つかりません')
      }

      // Prepare user data
      const { grade, classNumber, studentNumber, username } = state.data

      // Determine user role
      let role: 'student' | 'teacher' | 'staff' | 'admin' = 'student'
      if (grade === 'teacher') {
        role = 'teacher'
      }

      // Get today's date in YYYY-MM-DD format (JST)
      const today = new Date()
      const jstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
      const lastLoginDate = jstDate.toISOString().split('T')[0]

      // Create user document
      const userData: User = {
        email: currentUser.email,
        username: username || '',
        role,
        totalPoints: 0,
        createdAt: Timestamp.now(),
        lastLoginDate,
      }

      // Add grade, class, and studentNumber for students
      if (role === 'student' && typeof grade === 'number') {
        userData.grade = grade
        userData.class = classNumber
        userData.studentNumber = studentNumber
      }

      // Save to Firestore
      const userDocRef = doc(db, 'users', currentUser.uid)
      await setDoc(userDocRef, userData)

      // Success
      goToStep('success')
    } catch (error) {
      console.error('Registration failed:', error)
      setState(prev => ({
        ...prev,
        step: 'error',
        error: '登録に失敗しました。もう一度お試しください。',
      }))
    }
  }, [state.data, goToStep])

  // リセット
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  // 進捗率を計算
  const getProgress = useCallback((): number => {
    const isTeacher = state.data.grade === 'teacher'

    if (isTeacher) {
      const progressMap: Record<RegistrationStep, number> = {
        'initial': 0,
        'google-auth': 0,
        'grade': 20,
        'class': 20,
        'student-number': 20,
        'word1': 40,
        'word2': 60,
        'word3': 80,
        'loading': 100,
        'success': 100,
        'error': 0,
      }
      return progressMap[state.step] || 0
    } else {
      const progressMap: Record<RegistrationStep, number> = {
        'initial': 0,
        'google-auth': 0,
        'grade': 15,
        'class': 30,
        'student-number': 45,
        'word1': 60,
        'word2': 75,
        'word3': 90,
        'loading': 100,
        'success': 100,
        'error': 0,
      }
      return progressMap[state.step] || 0
    }
  }, [state.step, state.data.grade])

  return {
    state,
    nextStep,
    prevStep,
    goToStep,
    updateData,
    setGrade,
    setClass,
    setStudentNumber,
    setWord1,
    setWord2,
    setWord3,
    submitRegistration,
    reset,
    getProgress,
  }
}
