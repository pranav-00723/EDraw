/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type { StudentProfileSummary } from './studentAuthValidation';

export interface FirestoreStudentRecord {
  uid: string;
  edrawId: string;
  name: string;
  email: string;
  college: string;
  studentDetails: string;
  registrationStatus: 'verified';
  verified: true;
  emailVerifiedAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export async function syncVerifiedStudentToFirestore(
  student: StudentProfileSummary
): Promise<{ synced: boolean; skippedUnverifiedClaim?: boolean; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser || !student.uid || !student.edrawId) {
    return { synced: false, error: 'Authenticated Firebase session is required for Firestore sync.' };
  }
  if (!currentUser.emailVerified) {
    return { synced: false, skippedUnverifiedClaim: true };
  }

  const uid = currentUser.uid;
  if (uid !== student.uid) {
    return { synced: false, error: 'Authenticated UID does not match student profile.' };
  }

  const docPath = `students/${uid}`;
  const studentRef = doc(db, 'students', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(studentRef);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, docPath);
    } catch (wrappedError) {
      return {
        synced: false,
        error: wrappedError instanceof Error ? wrappedError.message : 'Firestore read failed.',
      };
    }
  }

  if (!existingSnap.exists()) {
    const payload: FirestoreStudentRecord = {
      uid,
      edrawId: student.edrawId,
      name: student.name.trim().slice(0, 80),
      email: student.gmail.trim().toLowerCase().slice(0, 120),
      college: student.college.trim().slice(0, 120),
      studentDetails: (student.studentDetails || '').trim().slice(0, 120),
      registrationStatus: 'verified',
      verified: true,
      emailVerifiedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(studentRef, payload);
      return { synced: true };
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      } catch (wrappedError) {
        return {
          synced: false,
          error: wrappedError instanceof Error ? wrappedError.message : 'Firestore create failed.',
        };
      }
    }
  }

  try {
    await updateDoc(studentRef, {
      name: student.name.trim().slice(0, 80),
      college: student.college.trim().slice(0, 120),
      studentDetails: (student.studentDetails || '').trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    });
    return { synced: true };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    } catch (wrappedError) {
      return {
        synced: false,
        error: wrappedError instanceof Error ? wrappedError.message : 'Firestore update failed.',
      };
    }
  }
}

export async function fetchStudentFromFirestore(
  uid: string
): Promise<Partial<FirestoreStudentRecord> | null> {
  const docPath = `students/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'students', uid));
    return snap.exists() ? (snap.data() as Partial<FirestoreStudentRecord>) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}
