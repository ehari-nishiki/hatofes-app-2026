import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
getFirestore(app);

/**
 * Script to promote a user to admin role
 * Run with: npm run create-admin <email>
 * Example: npm run create-admin user@g.nagano-c.ed.jp
 */
async function createAdminAccount() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: npm run create-admin <email>');
    console.log('Example: npm run create-admin user@g.nagano-c.ed.jp');
    process.exit(1);
  }

  if (!email.endsWith('@g.nagano-c.ed.jp')) {
    console.error('❌ Error: Email must be from @g.nagano-c.ed.jp domain');
    process.exit(1);
  }

  try {
    console.log(`🔍 Searching for user: ${email}...`);

    // Note: In a real implementation, you would need to use Firebase Admin SDK
    // to search for users by email. This is a simplified version.
    // For now, you need to provide the user ID manually.

    console.log('\n⚠️  Note: This script requires Firebase Admin SDK to search users by email.');
    console.log('Please find the user ID from Firebase Console and update the user document manually.');
    console.log('\nSteps:');
    console.log('1. Go to Firebase Console > Authentication');
    console.log(`2. Find user with email: ${email}`);
    console.log('3. Copy the User UID');
    console.log('4. Go to Firestore > users collection');
    console.log('5. Update the document with that UID:');
    console.log('   { "role": "admin" }');

    // If you have the user ID, you can uncomment and use this:
    // const userId = 'USER_ID_HERE';
    // const userRef = doc(db, 'users', userId);
    // const userSnap = await getDoc(userRef);
    //
    // if (!userSnap.exists()) {
    //   console.error('❌ Error: User not found in Firestore');
    //   process.exit(1);
    // }
    //
    // await updateDoc(userRef, { role: 'admin' });
    // console.log('✅ User promoted to admin successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
createAdminAccount();
