import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

// Firebase configuration - load from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Seed script to populate Firestore with test data
 * Run with: npm run seed
 */
async function seedFirestore() {
  console.log('🌱 Starting Firestore seed...\n');

  try {
    // 1. Create classes (1-A through 3-H)
    console.log('📚 Creating class documents...');
    const grades = [1, 2, 3];
    const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    for (const grade of grades) {
      for (const className of classes) {
        const classId = `${grade}-${className}`;
        await setDoc(doc(db, 'classes', classId), {
          grade,
          className,
          totalPoints: 0,
          memberCount: 0,
        });
        console.log(`  ✓ Created class: ${classId}`);
      }
    }

    // 2. Create test users
    console.log('\n👥 Creating test users...');

    // Test student
    const studentId = 'test-student-001';
    await setDoc(doc(db, 'users', studentId), {
      email: 'student@g.nagano-c.ed.jp',
      username: 'テスト生徒',
      grade: 2,
      class: 'A',
      studentNumber: 1,
      role: 'student',
      totalPoints: 100,
      createdAt: Timestamp.now(),
      lastLoginDate: new Date().toISOString().split('T')[0],
    });
    console.log(`  ✓ Created test student`);

    // Test teacher
    const teacherId = 'test-teacher-001';
    await setDoc(doc(db, 'users', teacherId), {
      email: 'teacher@g.nagano-c.ed.jp',
      username: 'テスト教員',
      role: 'teacher',
      totalPoints: 50,
      createdAt: Timestamp.now(),
      lastLoginDate: new Date().toISOString().split('T')[0],
    });
    console.log(`  ✓ Created test teacher`);

    // Test admin
    const adminId = 'test-admin-001';
    await setDoc(doc(db, 'users', adminId), {
      email: 'admin@g.nagano-c.ed.jp',
      username: 'テスト管理者',
      role: 'admin',
      totalPoints: 500,
      createdAt: Timestamp.now(),
      lastLoginDate: new Date().toISOString().split('T')[0],
    });
    console.log(`  ✓ Created test admin`);

    // 3. Create sample point history for test student
    console.log('\n💰 Creating point history...');
    const reasons = ['login_bonus', 'survey', 'admin_grant'];
    for (let i = 0; i < 5; i++) {
      const historyId = `history-${studentId}-${i}`;
      const reason = reasons[i % reasons.length];
      const points = reason === 'login_bonus' ? 10 : 20;

      await setDoc(doc(db, 'pointHistory', historyId), {
        userId: studentId,
        points,
        reason,
        details: `テストポイント履歴 ${i + 1}`,
        grantedBy: adminId,
        createdAt: Timestamp.fromDate(new Date(Date.now() - i * 86400000)),
      });
      console.log(`  ✓ Created point history entry ${i + 1}`);
    }

    // 4. Create test surveys
    console.log('\n📋 Creating test surveys...');

    const survey1Id = 'survey-001';
    await setDoc(doc(db, 'surveys', survey1Id), {
      title: '鳩祭理解度クイズ',
      description: '鳩祭について簡単なクイズに答えてポイントをゲット！',
      questions: [
        {
          type: 'multiple_choice',
          question: '鳩祭の開催日はいつですか？',
          options: ['6月1日', '7月1日', '8月1日', '9月1日'],
          required: true,
        },
        {
          type: 'text',
          question: '鳩祭で楽しみなことを教えてください',
          required: false,
        },
      ],
      points: 20,
      startDate: Timestamp.fromDate(new Date(Date.now() - 7 * 86400000)),
      endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 86400000)),
      status: 'active',
      createdBy: adminId,
    });
    console.log(`  ✓ Created survey: 鳩祭理解度クイズ`);

    const survey2Id = 'survey-002';
    await setDoc(doc(db, 'surveys', survey2Id), {
      title: 'グッズ投票アンケート',
      description: '鳩祭のグッズについてのアンケートです',
      questions: [
        {
          type: 'multiple_choice',
          question: 'どのグッズが欲しいですか？',
          options: ['Tシャツ', 'タオル', 'ステッカー', 'トートバッグ'],
          required: true,
        },
      ],
      points: 15,
      startDate: Timestamp.fromDate(new Date(Date.now() - 3 * 86400000)),
      endDate: Timestamp.fromDate(new Date(Date.now() + 20 * 86400000)),
      status: 'active',
      createdBy: adminId,
    });
    console.log(`  ✓ Created survey: グッズ投票アンケート`);

    console.log('\n✨ Seed completed successfully!');
    console.log('\nTest accounts created:');
    console.log('  Student: student@g.nagano-c.ed.jp (ID: test-student-001)');
    console.log('  Teacher: teacher@g.nagano-c.ed.jp (ID: test-teacher-001)');
    console.log('  Admin:   admin@g.nagano-c.ed.jp (ID: test-admin-001)');
    console.log('\nNote: You still need to create these users in Firebase Authentication manually.');
  } catch (error) {
    console.error('\n❌ Error seeding Firestore:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seed function
seedFirestore();
