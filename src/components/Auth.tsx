'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Registration successful! You are now logged in.');
      }
    } catch (error: any) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-container max-w-sm w-full mx-auto">
      <h2 className="mb-4 text-center">{isLogin ? 'Log In' : 'Register Account'}</h2>
      <p className="text-sm text-text-secondary text-center mb-6">
        {isLogin ? 'Welcome back! Please enter your details.' : 'Create an account to book a vehicle.'}
      </p>
      
      <form onSubmit={handleAuth}>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            required
            minLength={6}
          />
        </div>
        
        <button className="btn btn-primary w-full mt-2" type="submit" disabled={loading}>
          {loading ? 'Processing...' : isLogin ? 'Log In' : 'Register'}
        </button>
      </form>
      
      <div className="text-center mt-6 text-sm">
        <span className="text-text-secondary">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
        </span>
        <button 
          className="text-accent-color font-bold hover:underline"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? 'Register' : 'Log In'}
        </button>
      </div>
    </div>
  );
}
