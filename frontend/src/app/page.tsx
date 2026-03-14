"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import AuthScreen from '@/components/AuthScreen';
import DashboardScreen from '@/components/DashboardScreen';
import BookSession from '@/components/BookSession';

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentBook, setCurrentBook] = useState<{ id: string, name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Set this to your local running Uvicorn server, or via process.env.NEXT_PUBLIC_API_URL
  const backendUrl = "http://localhost:8080";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setCurrentBook(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF7F2]">
        <div className="gen-spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {!userId ? (
        <AuthScreen onLogin={(uid) => setUserId(uid)} />
      ) : !currentBook ? (
        <DashboardScreen
          userId={userId}
          backendUrl={backendUrl}
          onLogout={handleLogout}
          onContinueSession={(bookId, name) => setCurrentBook({ id: bookId, name })}
        />
      ) : (
        <BookSession
          userId={userId}
          bookId={currentBook.id}
          storytellerName={currentBook.name}
          backendUrl={backendUrl}
          onBackToBooks={() => setCurrentBook(null)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
