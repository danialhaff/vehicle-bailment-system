'use client';

import React, { useState, useEffect } from 'react';
import WizardForm from '../components/WizardForm';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <main className="main-container text-center">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="main-container">
      {/* Dynamic Background Effects */}
      <div className="bg-effect effect-1"></div>
      <div className="bg-effect effect-2"></div>
      
      {session && (
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="absolute top-4 right-4 text-sm font-semibold text-text-secondary hover:text-error-color transition-colors"
        >
          Log Out
        </button>
      )}

      <div className="header-container">
        <h1 className="title">
          Vehicle Bailment System
        </h1>
        <p className="subtitle">Secure Car Sharing Verification & Document Management</p>
      </div>

      {!session ? <Auth /> : <WizardForm />}
    </main>
  );
}
